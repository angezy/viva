const crypto = require("crypto");
const sql = require("mssql");
const { getPool } = require("./dbConnection");
const { recordSecurityEvent } = require("./securityAudit");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value) {
  try {
    return new URL(String(value || "").trim()).origin;
  } catch (_error) {
    return null;
  }
}

function configuredOrigins() {
  return [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || "").split(",")]
    .map(normalizeOrigin)
    .filter(Boolean);
}

function requestOriginIsAllowed(req, origins = configuredOrigins()) {
  const origin = normalizeOrigin(req.headers?.origin);
  if (!origin) return false;
  if (origins.includes(origin)) return true;
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(req.headers?.host || "").trim();
  const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (req.secure ? "https" : "http");
  return Boolean(host && origin === normalizeOrigin(`${protocol}://${host}`));
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || "").toUpperCase())) return next();
  if (req.path === "/api/telegram/webhook" || req.path === "/api/payment/webhook") return next();

  const hasCookieAuth = Boolean(req.cookies?.viva_admin_token || req.cookies?.viva_customer_token);
  const hasBearerAuth = /^Bearer\s+\S+/i.test(String(req.headers?.authorization || ""));
  if (!hasCookieAuth || hasBearerAuth) return next();

  if (!requestOriginIsAllowed(req)) {
    return res.status(403).json({ error: "Request origin could not be verified" });
  }
  return next();
}

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (String(_req.path || "").startsWith("/api/")) res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

function parseBoundedInteger(value, { min = 0, max = 99 } = {}) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function rateLimitKey(req, policyName) {
  const identity = req.user?.id || req.dashboardUser?.sub || req.ip || req.socket?.remoteAddress || "unknown";
  const pepper = process.env.RATE_LIMIT_KEY_SECRET || process.env.JWT_SECRET || "development-only";
  return crypto.createHmac("sha256", pepper).update(`${policyName}:${identity}`).digest("hex");
}

async function consumeDatabaseLimit({ key, policy, limit, windowMs }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("BucketKey", sql.Char(64), key)
    .input("Policy", sql.NVarChar(80), policy)
    .input("WindowSeconds", sql.Int, Math.ceil(windowMs / 1000))
    .query(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();
      DECLARE @ResetAt DATETIME2(3);
      DECLARE @HitCount INT;

      SELECT @ResetAt = reset_at, @HitCount = hit_count
      FROM [Security].[RateLimitBuckets] WITH (UPDLOCK, HOLDLOCK)
      WHERE bucket_key = @BucketKey AND policy = @Policy;

      IF @ResetAt IS NULL OR @ResetAt <= @Now
      BEGIN
        SET @ResetAt = DATEADD(SECOND, @WindowSeconds, @Now);
        SET @HitCount = 1;
        MERGE [Security].[RateLimitBuckets] WITH (HOLDLOCK) AS target
        USING (SELECT @BucketKey AS bucket_key, @Policy AS policy) AS source
          ON target.bucket_key = source.bucket_key AND target.policy = source.policy
        WHEN MATCHED THEN UPDATE SET hit_count = 1, reset_at = @ResetAt, updated_at = @Now
        WHEN NOT MATCHED THEN INSERT (bucket_key, policy, hit_count, reset_at, updated_at)
          VALUES (@BucketKey, @Policy, 1, @ResetAt, @Now);
      END
      ELSE
      BEGIN
        SET @HitCount = @HitCount + 1;
        UPDATE [Security].[RateLimitBuckets]
        SET hit_count = @HitCount, updated_at = @Now
        WHERE bucket_key = @BucketKey AND policy = @Policy;
      END;
      COMMIT TRANSACTION;
      SELECT @HitCount AS hit_count, @ResetAt AS reset_at;
    `);
  const row = result.recordset?.[0] || {};
  return { count: Number(row.hit_count) || 1, resetAt: new Date(row.reset_at) };
}

function createDatabaseRateLimiter({ policy, limit, windowMs, matches, consume = consumeDatabaseLimit }) {
  return async function databaseRateLimit(req, res, next) {
    if (!matches(req)) return next();
    try {
      const state = await consume({ key: rateLimitKey(req, policy), policy, limit, windowMs });
      const remaining = Math.max(0, limit - state.count);
      res.setHeader("RateLimit-Limit", String(limit));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(Math.max(0, Math.ceil((state.resetAt.getTime() - Date.now()) / 1000))));
      if (state.count > limit) {
        await recordSecurityEvent({ eventType: "abuse.rate_limit_block", severity: "warning", actor: req.user?.id || req.ip, resourceType: "rate_limit", resourceId: policy, metadata: { policy, count: state.count, limit } });
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((state.resetAt.getTime() - Date.now()) / 1000))));
        return res.status(429).json({ error: "Too many requests. Try again later." });
      }
      return next();
    } catch (error) {
      console.error(`Rate limiter '${policy}' unavailable:`, error?.message || error);
      await recordSecurityEvent({ eventType: "abuse.rate_limit_unavailable", severity: "high", resourceType: "rate_limit", resourceId: policy, metadata: { policy, code: String(error?.code || "database_error") } });
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({ error: "Security controls are temporarily unavailable" });
      }
      res.setHeader("RateLimit-Policy", `${policy}; unavailable-in-development`);
      return next();
    }
  };
}

module.exports = {
  configuredOrigins,
  createDatabaseRateLimiter,
  csrfProtection,
  parseBoundedInteger,
  requestOriginIsAllowed,
  securityHeaders,
};
