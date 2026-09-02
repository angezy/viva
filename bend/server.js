const path = require("path");
// Load root and backend environments regardless of the directory used to start Node.
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express4");
const { typeDefs, resolvers } = require("./graphqlSchema.js");
const { GraphQLError } = require("graphql");
const router = require("./routes/homeroute");
const supportRouter = require("./routes/supportRoute");
const adminOverviewRouter = require("./routes/adminOverviewRoute");
const adminRecordsRouter = require("./routes/adminRecordsRoute");
const reviewAdminRouter = require("./routes/reviewAdminRoute");
const chatRouter = require("./routes/chatRoute");
const { closePool, getPool } = require("./utils/dbConnection");
const { stripeWebhook } = require("./routes/stripeWebhookRoute");
const { startCustomerEmailAutomationWorker } = require("./utils/customerEmailAutomation");
const { recordSecurityEvent } = require("./utils/securityAudit");
const {
  configuredOrigins,
  createDatabaseRateLimiter,
  csrfProtection,
  securityHeaders,
} = require("./utils/securityControls");



const app = express();
const trustedProxyCidrs = String(process.env.TRUST_PROXY_CIDRS || "").split(",").map((value) => value.trim()).filter(Boolean);
app.set("trust proxy", trustedProxyCidrs.length ? trustedProxyCidrs : false);
if (process.env.TRUST_PROXY === "true") {
  console.warn("TRUST_PROXY=true is intentionally ignored; configure TRUST_PROXY_CIDRS with only the reverse-proxy networks you operate");
}

function graphQlBudgetRule(context) {
  let fields = 0;
  return {
    Field(node) {
      fields += 1;
      if (fields > 100) context.reportError(new GraphQLError("GraphQL query exceeds the field budget", { nodes: [node] }));
    },
  };
}

const allowedOrigins = new Set([
  ...configuredOrigins(),
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
]);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const error = new Error("Origin is not allowed by CORS");
    error.status = 403;
    return callback(error);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Chat-Session-Token", "X-Telegram-Bot-Api-Secret-Token"],
  credentials: true,
};
app.use(securityHeaders);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.post("/api/payment/webhook", express.raw({ type: "application/json", limit: "256kb" }), stripeWebhook);
app.post("/api/security/csp-report", express.json({ type: ["application/csp-report", "application/reports+json", "application/json"], limit: "32kb" }), async (req, res) => {
  const report = Array.isArray(req.body) ? req.body[0]?.body : req.body?.["csp-report"] || req.body;
  let blockedOrigin = null;
  try { blockedOrigin = report?.["blocked-uri"] ? new URL(report["blocked-uri"]).origin : null; } catch (_error) {}
  await recordSecurityEvent({
    eventType: "csp.violation",
    severity: "warning",
    actor: req.ip,
    resourceType: "csp",
    resourceId: report?.["document-uri"],
    metadata: {
      directive: String(report?.["effective-directive"] || report?.effectiveDirective || "unknown").slice(0, 100),
      blockedOrigin,
      disposition: String(report?.disposition || "unknown").slice(0, 30),
    },
  });
  res.status(204).end();
});
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || "1mb" }));
app.use(csrfProtection);

const methodAndPath = (methods, paths) => (req) => methods.includes(req.method) && paths.some((candidate) => req.path.startsWith(candidate));
app.use(createDatabaseRateLimiter({
  policy: "authentication",
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
  windowMs: 15 * 60 * 1000,
  matches: methodAndPath(["POST"], ["/api/login", "/api/register", "/api/password-reset"]),
}));
app.use(createDatabaseRateLimiter({
  policy: "public-messaging",
  limit: Number(process.env.RATE_LIMIT_MESSAGING_MAX) || 30,
  windowMs: 10 * 60 * 1000,
  matches: methodAndPath(["POST"], ["/api/chat", "/api/support/tickets", "/api/comment", "/api/reviews"]),
}));
app.use(createDatabaseRateLimiter({
  policy: "checkout",
  limit: Number(process.env.RATE_LIMIT_CHECKOUT_MAX) || 30,
  windowMs: 10 * 60 * 1000,
  matches: methodAndPath(["POST"], ["/api/payment", "/api/orders/create", "/api/cart/apply-coupon"]),
}));

const uploadStaticOptions = {
  dotfiles: "deny",
  fallthrough: false,
  setHeaders(res, filePath) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    if (/\.(?:pdf|txt|docx)$/i.test(filePath)) res.setHeader("Content-Disposition", "attachment");
  },
};
async function referencedPublicUpload(req, res, next) {
  const storageName = decodeURIComponent(String(req.path || "")).replace(/^\/+/, "").replace(/\\/g, "/");
  if (!storageName || storageName.includes("..") || !/^[a-zA-Z0-9._/-]{1,255}$/.test(storageName)) {
    return res.status(404).json({ error: "Upload not found" });
  }
  if (/^marketing\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|gif|webp)$/i.test(storageName)) return next();
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("StorageName", sql.NVarChar(255), storageName)
      .input("PublicPath", sql.NVarChar(500), `/uploads/${storageName}`)
      .input("ApiPath", sql.NVarChar(500), `/api/uploads/${storageName}`)
      .query(`
        DECLARE @Found BIT = 0;
        IF COL_LENGTH(N'dbo.Products_tbl', N'Img') IS NOT NULL
          EXEC sys.sp_executesql N'IF EXISTS (SELECT 1 FROM dbo.Products_tbl WHERE REPLACE(TRY_CONVERT(NVARCHAR(MAX), [Img]), N''\'', N''/'') IN (@Storage, @Public, @Api)) SET @FoundOut = 1',
            N'@Storage NVARCHAR(255), @Public NVARCHAR(500), @Api NVARCHAR(500), @FoundOut BIT OUTPUT', @StorageName, @PublicPath, @ApiPath, @Found OUTPUT;
        IF @Found = 0 AND COL_LENGTH(N'dbo.Comments', N'Img') IS NOT NULL
          EXEC sys.sp_executesql N'IF EXISTS (SELECT 1 FROM dbo.Comments WHERE REPLACE(TRY_CONVERT(NVARCHAR(MAX), [Img]), N''\'', N''/'') IN (@Storage, @Public, @Api)) SET @FoundOut = 1',
            N'@Storage NVARCHAR(255), @Public NVARCHAR(500), @Api NVARCHAR(500), @FoundOut BIT OUTPUT', @StorageName, @PublicPath, @ApiPath, @Found OUTPUT;
        IF @Found = 0 AND OBJECT_ID(N'Commerce.StorefrontProductImages', N'U') IS NOT NULL
          EXEC sys.sp_executesql N'IF EXISTS (SELECT 1 FROM Commerce.StorefrontProductImages WHERE REPLACE([ImagePath], N''\'', N''/'') IN (@Storage, @Public, @Api)) SET @FoundOut = 1',
            N'@Storage NVARCHAR(255), @Public NVARCHAR(500), @Api NVARCHAR(500), @FoundOut BIT OUTPUT', @StorageName, @PublicPath, @ApiPath, @Found OUTPUT;
        IF @Found = 0 AND COL_LENGTH(N'dbo.DashboardSettings', N'SettingValue') IS NOT NULL
          EXEC sys.sp_executesql N'IF EXISTS (SELECT 1 FROM dbo.DashboardSettings WHERE REPLACE(TRY_CONVERT(NVARCHAR(MAX), [SettingValue]), N''\'', N''/'') IN (@Storage, @Public, @Api)) SET @FoundOut = 1',
            N'@Storage NVARCHAR(255), @Public NVARCHAR(500), @Api NVARCHAR(500), @FoundOut BIT OUTPUT', @StorageName, @PublicPath, @ApiPath, @Found OUTPUT;
        IF @Found = 0 AND COL_LENGTH(N'dbo.DashboardSettings', N'SettingValue') IS NOT NULL
          IF EXISTS (
            SELECT 1
            FROM dbo.DashboardSettings
            CROSS APPLY OPENJSON(CASE WHEN ISJSON(TRY_CONVERT(NVARCHAR(MAX), [SettingValue])) = 1 THEN TRY_CONVERT(NVARCHAR(MAX), [SettingValue]) ELSE N'[]' END) AS [FontEntry]
            WHERE [SettingKey] = N'customFonts'
              AND JSON_VALUE([FontEntry].[value], N'$.url') IN (@StorageName, @PublicPath, @ApiPath)
          ) SET @Found = 1;
        SELECT @Found AS [referenced];
      `);
    if (result.recordset?.[0]?.referenced !== true && Number(result.recordset?.[0]?.referenced) !== 1) {
      return res.status(404).json({ error: "Upload not found" });
    }
    return next();
  } catch (error) {
    console.error("Public upload authorization failed:", error?.message || error);
    return res.status(503).json({ error: "Upload access is temporarily unavailable" });
  }
}
app.use("/uploads", referencedPublicUpload, express.static(path.join(__dirname, "public", "uploads"), uploadStaticOptions));
app.use("/api/uploads", referencedPublicUpload, express.static(path.join(__dirname, "public", "uploads"), uploadStaticOptions));

app.use("/", adminOverviewRouter);
app.use("/", adminRecordsRouter);
app.use("/", reviewAdminRouter);
app.use("/", supportRouter);
app.use("/", chatRouter);
app.use("/", router);

async function startApolloServer() {
  let server = null;
  if (process.env.GRAPHQL_ENABLED === "true") {
    server = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: process.env.NODE_ENV !== "production" && process.env.GRAPHQL_INTROSPECTION !== "false",
      includeStacktraceInErrorResponses: false,
      validationRules: [graphQlBudgetRule],
      formatError(formattedError) {
        if (formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
          return { message: "GraphQL request could not be processed", extensions: { code: "INTERNAL_SERVER_ERROR" } };
        }
        return formattedError;
      },
    });
    await server.start();
    app.use("/graphql", expressMiddleware(server));
  }
	app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
	app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    const status = Number(err?.statusCode || err?.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    if (safeStatus >= 500) console.error("Unhandled backend request error:", err && err.stack ? err.stack : err);
    res.status(safeStatus).json({
      error: safeStatus === 413 ? "Request too large" : "Request could not be processed",
    });
  });
	return server;
}

function validateProductionSecurityConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const requiredLongSecrets = ["JWT_SECRET", "RATE_LIMIT_KEY_SECRET", "CHAT_SESSION_SECRET", "CHAT_INTERNAL_SECRET", "SESSION_FINGERPRINT_SECRET", "SECURITY_EVENT_KEY_SECRET"];
  for (const name of requiredLongSecrets) {
    if (String(process.env[name] || "").length < 32) throw new Error(`${name} must be configured with at least 32 characters`);
  }
  if (!configuredOrigins().length) throw new Error("FRONTEND_URL or CORS_ORIGINS must be configured in production");
  if (String(process.env.PAYMENT_PROVIDER || "").toLowerCase() === "stripe" && !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required when Stripe payments are enabled");
  }
  if ((process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ADMIN_CHAT_ID) && !process.env.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is required when Telegram chat is enabled");
  }
  if (!new Set(["clamav", "clamscan", "clamdscan"]).has(String(process.env.MALWARE_SCANNER_MODE || "").toLowerCase())) {
    throw new Error("MALWARE_SCANNER_MODE must configure ClamAV scanning in production");
  }
}

async function start() {
  let httpServer = null;
  let emailAutomationWorker = null;
  try {
    validateProductionSecurityConfig();
    await startApolloServer();
    const port = Number(process.env.PORT) || 5000;
    httpServer = app.listen(port);
    emailAutomationWorker = startCustomerEmailAutomationWorker();
    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      emailAutomationWorker?.stop();
      httpServer.close(async () => {
        try {
          await closePool();
        } catch (error) {
          console.error("Backend shutdown failed while closing the database pool:", error);
        }
        process.exit(0);
      });
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (error) {
    console.error("Backend startup failed:", error && error.message ? error.message : error);
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) start();

module.exports = { app, referencedPublicUpload, start, startApolloServer, validateProductionSecurityConfig };
