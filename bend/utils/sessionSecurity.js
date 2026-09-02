const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const { getPool } = require("./dbConnection");
const {
  ADMIN_AUTH_COOKIE_NAME,
  CUSTOMER_AUTH_COOKIE_NAME,
} = require("./cookieOptions");
const { recordSecurityEvent } = require("./securityAudit");
const { isStaffRole, normalizeRole } = require("./roles");

const SESSION_TTL_SECONDS = 60 * 60;
let developmentFallbackWarned = false;

function missingSessionSchemaInDevelopment(error) {
  const number = Number(error?.number ?? error?.originalError?.info?.number);
  return process.env.NODE_ENV !== "production" && (
    number === 208 ||
    /Invalid object name.*AuthSessions|apply migrations through 011/i.test(String(error?.message || ""))
  );
}

function warnDevelopmentFallback() {
  if (developmentFallbackWarned) return;
  developmentFallbackWarned = true;
  console.warn("Security migration 011 is not applied; using development-only JWT compatibility until the local database is migrated");
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function requestFingerprint(value) {
  if (!value) return null;
  const key = String(process.env.SESSION_FINGERPRINT_SECRET || process.env.RATE_LIMIT_KEY_SECRET || "development-session-key");
  return crypto.createHmac("sha256", key).update(String(value)).digest("hex");
}

function tokenFromRequest(req, sessionType = "customer") {
  const authorization = String(req.headers?.authorization || "");
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  const cookieName = sessionType === "admin" ? ADMIN_AUTH_COOKIE_NAME : CUSTOMER_AUTH_COOKIE_NAME;
  return req.cookies?.[cookieName] || null;
}

function decodeSignedToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (_error) {
    return null;
  }
}

function sessionRecordAccepts(decoded, token, row, now = Date.now()) {
  if (!decoded?.jti || !row) return false;
  if (String(row.jti || row.Jti || "").toLowerCase() !== String(decoded.jti).toLowerCase()) return false;
  if (Number(row.user_id ?? row.UserId) !== Number(decoded.sub)) return false;
  if (String(row.session_role ?? row.SessionRole ?? "").toLowerCase() !== String(decoded.role || "").toLowerCase()) return false;
  if (row.revoked_at ?? row.RevokedAt) return false;
  if (new Date(row.expires_at ?? row.ExpiresAt).getTime() <= now) return false;
  const storedHash = String(row.token_hash ?? row.TokenHash ?? "");
  const suppliedHash = tokenHash(token);
  if (storedHash.length !== suppliedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(suppliedHash));
}

async function issueSession(pool, payload, req = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const role = normalizeRole(payload.role);
  const jti = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_SECONDS * 1000);
  const claims = { ...payload, role, jti };
  const token = jwt.sign(claims, secret, { algorithm: "HS256", expiresIn: SESSION_TTL_SECONDS });
  try {
    await pool.request()
      .input("Jti", sql.UniqueIdentifier, jti)
      .input("UserId", sql.Int, Number(payload.sub))
      .input("Role", sql.NVarChar(20), role)
      .input("Email", sql.NVarChar(255), payload.email ? String(payload.email).toLowerCase().slice(0, 255) : null)
      .input("TokenHash", sql.Char(64), tokenHash(token))
      .input("IpHash", sql.Char(64), requestFingerprint(req.ip || req.connection?.remoteAddress))
      .input("UserAgentHash", sql.Char(64), requestFingerprint(req.headers?.["user-agent"]))
      .input("IssuedAt", sql.DateTime2(3), issuedAt)
      .input("ExpiresAt", sql.DateTime2(3), expiresAt)
      .query(`INSERT INTO [Security].[AuthSessions]
        ([jti], [user_id], [session_role], [email], [token_hash], [ip_hash], [user_agent_hash], [issued_at], [expires_at])
        VALUES (@Jti, @UserId, @Role, @Email, @TokenHash, @IpHash, @UserAgentHash, @IssuedAt, @ExpiresAt)`);
    await recordSecurityEvent({ pool, eventType: "auth.session_issued", actor: payload.sub, resourceType: "session", resourceId: jti, metadata: { role } });
  } catch (error) {
    if (!missingSessionSchemaInDevelopment(error)) throw error;
    warnDevelopmentFallback();
  }
  return { token, jti, expiresAt };
}

async function validateSessionToken(token, pool = null) {
  const decoded = decodeSignedToken(token);
  if (!decoded) return null;
  if (!decoded.jti && process.env.NODE_ENV !== "production") {
    warnDevelopmentFallback();
    return decoded;
  }
  if (!decoded.jti) return null;
  try {
    const db = pool || await getPool();
    const result = await db.request()
      .input("Jti", sql.UniqueIdentifier, decoded.jti)
      .query(`SELECT TOP 1 [jti], [user_id], [session_role], [token_hash], [expires_at], [revoked_at]
        FROM [Security].[AuthSessions] WHERE [jti] = @Jti`);
    const row = result.recordset?.[0];
    if (!sessionRecordAccepts(decoded, token, row)) return null;
    await db.request().input("Jti", sql.UniqueIdentifier, decoded.jti)
      .query(`UPDATE [Security].[AuthSessions] SET [last_seen_at] = SYSUTCDATETIME()
        WHERE [jti] = @Jti AND [last_seen_at] < DATEADD(MINUTE, -5, SYSUTCDATETIME())`);
    return decoded;
  } catch (error) {
    if (missingSessionSchemaInDevelopment(error)) {
      warnDevelopmentFallback();
      return decoded;
    }
    await recordSecurityEvent({ eventType: "auth.session_store_unavailable", severity: "high", metadata: { code: String(error?.code || "database_error") } });
    return null;
  }
}

async function authenticateRequest(req, sessionType = "customer") {
  const token = tokenFromRequest(req, sessionType);
  const decoded = await validateSessionToken(token);
  if (!decoded) return null;
  const actualRole = normalizeRole(decoded.role);
  if (sessionType === "admin" ? !isStaffRole(actualRole) : actualRole !== "customer") return null;
  decoded.role = actualRole;
  return { decoded, token };
}

function requireSession(sessionType = "customer", property = "user") {
  return async function sessionMiddleware(req, res, next) {
    const auth = await authenticateRequest(req, sessionType);
    if (!auth) return res.status(401).json({ error: "Invalid, expired, or revoked session" });
    const user = { id: auth.decoded.sub, sub: auth.decoded.sub, email: auth.decoded.email, role: auth.decoded.role, jti: auth.decoded.jti };
    req[property] = user;
    req.authToken = auth.token;
    next();
  };
}

async function revokeSession(pool, jti, reason = "logout") {
  if (!jti) return false;
  let result;
  try {
    result = await pool.request()
    .input("Jti", sql.UniqueIdentifier, jti)
    .input("Reason", sql.NVarChar(120), String(reason).slice(0, 120))
    .query(`UPDATE [Security].[AuthSessions]
      SET [revoked_at] = COALESCE([revoked_at], SYSUTCDATETIME()), [revocation_reason] = COALESCE([revocation_reason], @Reason)
      WHERE [jti] = @Jti AND [revoked_at] IS NULL;
      SELECT @@ROWCOUNT AS affected`);
  } catch (error) {
    if (missingSessionSchemaInDevelopment(error)) { warnDevelopmentFallback(); return false; }
    throw error;
  }
  await recordSecurityEvent({ pool, eventType: "auth.session_revoked", actor: null, resourceType: "session", resourceId: jti, metadata: { reason } });
  return Number(result.recordset?.[0]?.affected || 0) > 0;
}

async function revokeToken(pool, token, reason = "logout") {
  const decoded = decodeSignedToken(token);
  return decoded?.jti ? revokeSession(pool, decoded.jti, reason) : false;
}

async function revokeAllUserSessions(pool, userId, reason, exceptJti = null) {
  try {
    await pool.request()
    .input("UserId", sql.Int, Number(userId))
    .input("Reason", sql.NVarChar(120), String(reason || "security_change").slice(0, 120))
    .input("ExceptJti", sql.UniqueIdentifier, exceptJti || null)
    .query(`UPDATE [Security].[AuthSessions]
      SET [revoked_at] = COALESCE([revoked_at], SYSUTCDATETIME()), [revocation_reason] = COALESCE([revocation_reason], @Reason)
      WHERE [user_id] = @UserId AND [revoked_at] IS NULL AND (@ExceptJti IS NULL OR [jti] <> @ExceptJti)`);
  } catch (error) {
    if (missingSessionSchemaInDevelopment(error)) { warnDevelopmentFallback(); return; }
    throw error;
  }
  await recordSecurityEvent({ pool, eventType: "auth.user_sessions_revoked", actor: userId, resourceType: "user", resourceId: userId, metadata: { reason: String(reason || "security_change") } });
}

module.exports = {
  authenticateRequest,
  decodeSignedToken,
  issueSession,
  missingSessionSchemaInDevelopment,
  requireSession,
  revokeAllUserSessions,
  revokeSession,
  revokeToken,
  sessionRecordAccepts,
  tokenFromRequest,
  tokenHash,
  validateSessionToken,
};
