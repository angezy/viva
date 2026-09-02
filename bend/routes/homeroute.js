const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require("fs");
const crypto = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET;
const sql = require('mssql');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const {
  ADMIN_AUTH_COOKIE_NAME,
  CUSTOMER_AUTH_COOKIE_NAME,
  LEGACY_AUTH_COOKIE_NAME,
  GUEST_COOKIE_NAME,
  authCookieOptions,
  guestCookieOptions,
  clearCookieOptions,
} = require("../utils/cookieOptions");
const {
  isSendPulseMailerConfigured,
  sendOwnerNotificationEmail,
  sendPasswordResetCodeEmail,
  sendWelcomeEmail,
} = require("../utils/sendpulse");
const {
  cancelQueuedJourneySteps,
  queueCartInactivity,
  queueJourneyEvent,
  queueOrderStatusEvent,
  runCustomerEmailAutomationOnce,
} = require("../utils/customerEmailAutomation");
const {
  calculateCouponDiscount,
  couponIsUsable,
  findCouponByCode,
  getCouponCustomerIdentity,
  hasCouponBeenRedeemed,
  normalizeCouponCode,
} = require("../utils/coupons");
const { validateUploadedFiles } = require("../utils/fileSecurity");
const { parseBoundedInteger } = require("../utils/securityControls");
const {
  authenticateRequest,
  issueSession,
  requireSession,
  revokeAllUserSessions,
  revokeToken,
  tokenFromRequest,
} = require("../utils/sessionSecurity");
const { isStaffRole, normalizeRole, requirePermission } = require("../utils/rbac");
const {
  isGuestCartOwnerKey,
  loadCartState,
  mergeGuestCartIntoUserCart,
  mutateCartState,
} = require("../utils/durableCartStore");
const { requireSchemaObjects } = require("../utils/schemaSecurity");
const { recordSecurityEvent } = require("../utils/securityAudit");
const { extractCjImageUrls, sanitizeCjDescription } = require("../utils/cjProductContent");
const { Country } = require("country-state-city");

function configuredStoreName() {
  return String(process.env.STORE_NAME || "Your Store").trim().slice(0, 100) || "Your Store";
}
const {
  CJ_API_BASE_URL,
  configured: cjTrackingConfigured,
  confirmCjOrder,
  createCjOrder,
  currentLocationFromTracking,
  fetchCjOrderDetail,
  fetchTracking: fetchCjTracking,
  payCjOrderBalance,
  stageFromCjStatus,
  trackingEventFromRecord,
} = require("../utils/cjTracking");
const { calculateCjFreight, extractCjShippingIdentifiers, resolveCjVariantId } = require("../utils/cjShipping");
const {
  connectionConfig: cjStoreConnectionConfig,
  disconnectCjProductConnection,
  extractCjProductId,
  listCjShops,
  storeSyncEnabled,
  syncCjStoreProduct,
} = require("../utils/cjStore");

const {
  chooseInStockCjLogistics,
  getCjOrderOptionalLogistics,
  simulateCjSandboxPayment,
  updateCjOrderLogistics,
  updateCjSandboxStatus,
  updateCjSandboxTrackingNumber,
} = require("../utils/cjSandbox");
// Setup uploads directory
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { files: 10, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!allowed.has(file.mimetype)) {
      return callback(new Error("Only JPEG, PNG, WEBP, and GIF images are supported"));
    }
    callback(null, true);
  },
});
const productUpload = upload.fields([
  { name: "primaryImage", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "gallery", maxCount: 10 },
]);
async function verifyProductImages(req, res, next) {
  const files = Object.values(req.files || {}).flat();
  if (!(await validateUploadedFiles(files, "image"))) {
    return res.status(400).json({ error: "Uploaded image content does not match its declared type" });
  }
  return next();
}
function requestUploadFiles(req) {
  return [...(req.file ? [req.file] : []), ...Object.values(req.files || {}).flat()].filter(Boolean);
}
async function cleanupRequestUploads(req) {
  await Promise.all(requestUploadFiles(req).map((file) => fs.promises.unlink(file.path).catch(() => {})));
}
const { getPool } = require("../utils/dbConnection");
// Mount additional routers
try {
  router.use('/', require('./dashboardRoute'));
} catch (e) {
  // If the dashboardRoute is missing during startup, log and continue so other routes still work
  console.warn('dashboardRoute not mounted:', e && e.message ? e.message : e);
}

// Ensure cookies are parsed for auth
router.use(cookieParser());

const MAX_CART_QUANTITY = Math.min(999, Math.max(1, Number(process.env.MAX_CART_QUANTITY) || 99));
const cjOrderStatusLookupCache = new Map();
const cjFulfillmentLocks = new Map();
let checkoutAttemptsTableEnsured = false;
const cjTrackingLookupCache = new Map();
let passwordResetTableEnsured = false;
let savedProductsTableEnsured = false;
let customerAccountTablesEnsured = false;

const passwordResetCodeTtlMinutes = Math.min(60, Math.max(5, Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES) || 10));
const passwordResetMaxAttempts = Math.min(10, Math.max(3, Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS) || 5));
const passwordResetResendDelaySeconds = Math.min(300, Math.max(30, Number(process.env.PASSWORD_RESET_RESEND_DELAY_SECONDS) || 60));

const requireAuth = requireSession("customer", "user");
const requireStaffManage = requirePermission("staff.manage", "user");
const requireRefundsManage = requirePermission("refunds.manage", "user");
const requireIntegrationsManage = requirePermission("integrations.manage", "user");
const requireProductsRead = requirePermission("products.read", "user");
const requireProductsManage = requirePermission("products.manage", "user");

async function requireCheckoutIdentity(req, res, next) {
  const authenticated = await authenticateRequest(req, "customer");
  if (authenticated) {
    req.user = { id: authenticated.decoded.sub, email: authenticated.decoded.email, role: "customer", jti: authenticated.decoded.jti };
    req.checkoutUserId = String(authenticated.decoded.sub);
    return next();
  }

  let guestId = req.cookies?.[GUEST_COOKIE_NAME];
  if (!isGuestCartOwnerKey(guestId)) {
    guestId = `guest-${crypto.randomUUID()}`;
    res.cookie(GUEST_COOKIE_NAME, guestId, guestCookieOptions());
  }
  req.checkoutUserId = guestId;
  next();
}

async function maybeAttachUser(req, _res, next) {
  const authenticated = await authenticateRequest(req, "customer");
  if (authenticated) req.user = { id: authenticated.decoded.sub, email: authenticated.decoded.email, role: "customer", jti: authenticated.decoded.jti };
  next();
}

async function getCartForUser(userId, pool) {
  return (await loadCartState(pool || await getPool(), userId)).cart;
}

async function replaceCartForUser(pool, userId, cart) {
  return mutateCartState(pool, userId, (state) => ({ ...state, cart }));
}

async function mergeGuestCartAfterLogin(req, res, pool, userId) {
  const guestId = req.cookies?.[GUEST_COOKIE_NAME];
  if (!isGuestCartOwnerKey(guestId)) return;
  const mergedState = await mergeGuestCartIntoUserCart(pool, guestId, String(userId), MAX_CART_QUANTITY);
  if (mergedState?.cart?.length) {
    await queueCartInactivity({
      pool,
      userId,
      email: req.user?.email || req.body?.email,
      name: req.user?.fullName || "Customer",
      state: mergedState,
    }).catch((error) => console.warn("Unable to schedule cart reminder after login:", error?.message || error));
  }
  // The transfer is durable and atomic, so the old anonymous identity no
  // longer needs to remain in the browser or be eligible for a second merge.
  res.clearCookie(GUEST_COOKIE_NAME, clearCookieOptions());
}

async function loadUserProfile(pool, userId, email) {
  if (!Number.isFinite(Number(userId))) return null;
  try {
    const hasFullName = await hasUserColumn(pool, "FullName");
    const fullNameSelect = hasFullName ? ", FullName" : "";
    const result = await pool
      .request()
      .input("UserId", sql.Int, Number(userId))
      .query(`SELECT TOP 1 UserID, Username, Email, Role${fullNameSelect}, CreatedAt, LastLogin FROM User_tbl WHERE UserID = @UserId`);
    const rows = normalizeResult(result);
    if (!rows.length) return null;
    const row = rows[0];
    let canonicalName = null;
    if (!row.FullName) {
      try {
        const canonicalResult = await pool
          .request()
          .input("CanonicalUserId", sql.Int, Number(userId))
          .input("CanonicalEmail", sql.NVarChar(255), String(email || row.Email || "").trim().toLowerCase())
          .query(`
            SELECT TOP 1 FullName, FirstName, LastName
            FROM [CRM].[Customers]
            WHERE [LegacyUserId] = @CanonicalUserId
               OR (LOWER(LTRIM(RTRIM([Email]))) = @CanonicalEmail)
          `);
        const canonical = normalizeResult(canonicalResult)[0];
        canonicalName = canonical?.FullName || [canonical?.FirstName, canonical?.LastName].filter(Boolean).join(" ") || null;
      } catch (_canonicalError) {
        // Older installations may not have the canonical customer table yet.
      }
    }
    return {
      id: row.UserID,
      email: row.Email || email,
      name: (hasFullName ? row.FullName : null) || canonicalName,
      username: row.Username || (email ? email.split("@")[0] : ""),
      role: normalizeRole(row.Role),
      createdAt: row.CreatedAt || null,
      lastLogin: row.LastLogin || null,
    };
  } catch (err) {
    console.error("profile lookup failed", err);
    return null;
  }
}

async function findUserByEmail(pool, email) {
  try {
    const result = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT TOP 1 UserID, Email, Role FROM User_tbl WHERE Email = @Email");
    const rows = normalizeResult(result);
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error("findUserByEmail failed", err);
    return null;
  }
}

function isUniqueConstraintError(err) {
  return (
    err &&
    (err.number === 2627 || err.number === 2601 || /UNIQUE\s+KEY/i.test(err.message || ""))
  );
}

const GOOGLE_STATE_COOKIE_NAME = "viva_google_oauth_state";
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

function googleStateCookieOptions(maxAge = GOOGLE_STATE_TTL_MS) {
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

function firstForwardedValue(value) {
  return String(value || "").split(",")[0].trim();
}

function getFrontendOrigin(req) {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) {
    return new URL(configured).origin;
  }

  const protocol = firstForwardedValue(req.headers?.["x-forwarded-proto"]) || req.protocol || "http";
  const host = firstForwardedValue(req.headers?.["x-forwarded-host"]) || req.get("host");
  return `${protocol}://${host}`;
}

function getGoogleRedirectUri(req) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${getFrontendOrigin(req)}/api/auth/google/callback`;
}

function googleErrorRedirect(req, errorCode) {
  const redirect = new URL("/signin", getFrontendOrigin(req));
  redirect.searchParams.set("error", errorCode);
  return redirect.toString();
}

function hasMatchingOAuthState(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string" || !expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function exchangeGoogleCode(code, redirectUri) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error("Google authorization code exchange failed");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => null);
  if (!profileResponse.ok || !profile?.sub || !profile?.email || profile.email_verified !== true) {
    throw new Error("Google account email could not be verified");
  }

  return profile;
}

function getGoogleNameParts(profile = {}) {
  const profileName = String(profile.name || "").trim();
  const givenName = String(profile.given_name || "").trim();
  const familyName = String(profile.family_name || "").trim();
  const nameParts = profileName.split(/\s+/).filter(Boolean);
  const firstName = (givenName || nameParts[0] || "").slice(0, 120);
  const lastName = (familyName || nameParts.slice(1).join(" ") || "").slice(0, 120);
  const fullName = (profileName || [givenName, familyName].filter(Boolean).join(" ")).slice(0, 250);

  return { firstName, lastName, fullName };
}

async function syncGoogleCustomerIdentity(pool, email, profile, nameParts) {
  if (!nameParts.fullName) return;
  try {
    const requiredColumns = await Promise.all([
      "CustomerNumber", "Email", "FirstName", "LastName", "FullName", "Role", "EmailVerified", "UpdatedAt",
    ].map((column) => hasTableColumn(pool, "CRM.Customers", column)));
    if (requiredColumns.some((available) => !available)) return;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const googleSubject = String(profile.sub || "").trim();
    const customerNumber = `CUS-G-${crypto.createHash("sha256").update(googleSubject).digest("hex").slice(0, 34)}`.slice(0, 40);
    const username = `google_${googleSubject.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 90)}`;
    const request = pool.request()
      .input("GoogleEmail", sql.NVarChar(255), normalizedEmail)
      .input("GoogleCustomerNumber", sql.NVarChar(40), customerNumber)
      .input("GoogleUsername", sql.NVarChar(100), username)
      .input("GoogleFirstName", sql.NVarChar(120), nameParts.firstName)
      .input("GoogleLastName", sql.NVarChar(120), nameParts.lastName)
      .input("GoogleFullName", sql.NVarChar(250), nameParts.fullName);

    await request.query(`
      IF EXISTS (
        SELECT 1 FROM [CRM].[Customers]
        WHERE LOWER(LTRIM(RTRIM([Email]))) = @GoogleEmail
      )
      BEGIN
        UPDATE [CRM].[Customers]
        SET [FirstName] = @GoogleFirstName,
            [LastName] = @GoogleLastName,
            [FullName] = @GoogleFullName,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE LOWER(LTRIM(RTRIM([Email]))) = @GoogleEmail;
      END
      ELSE
      BEGIN
        INSERT INTO [CRM].[Customers]
          ([CustomerNumber], [Username], [Email], [FirstName], [LastName], [FullName], [Role], [EmailVerified])
        VALUES
          (@GoogleCustomerNumber, @GoogleUsername, @GoogleEmail, @GoogleFirstName, @GoogleLastName, @GoogleFullName, N'customer', 1);
      END
    `);
  } catch (err) {
    // Google name persistence is supplemental; do not turn a successful OAuth
    // authentication into a failed sign-in when an older schema is in use.
    console.warn("Could not sync Google customer name:", err && err.message ? err.message : err);
  }
}

async function findOrCreateGoogleUser(pool, profile, clientIp) {
  const email = String(profile.email).trim().toLowerCase();
  const googleName = getGoogleNameParts(profile);
  const existingResult = await pool.request()
    .input("Email", sql.NVarChar(255), email)
    .query("SELECT TOP 1 UserID, Email, Role FROM User_tbl WHERE LOWER(LTRIM(RTRIM(Email))) = @Email");
  const existing = normalizeResult(existingResult)[0];

  if (existing && isStaffRole(existing.Role)) {
    throw new Error("Google sign-in is not available for administrator accounts");
  }

  const optionalFields = [];
  if (clientIp && (await hasUserColumn(pool, "lastip"))) optionalFields.push({ name: "LastIP", value: clientIp });
  if (await hasUserColumn(pool, "fullname") && googleName.fullName) optionalFields.push({ name: "FullName", value: googleName.fullName });
  if (await hasUserColumn(pool, "avatarurl") && profile.picture) optionalFields.push({ name: "AvatarUrl", value: String(profile.picture).slice(0, 1000) });

  if (existing) {
    const setClauses = ["LastLogin = GETDATE()"];
    let updateRequest = pool.request().input("UserId", sql.Int, Number(existing.UserID));
    optionalFields.forEach((field, index) => {
      setClauses.push(`[${field.name}] = @GoogleField${index}`);
      updateRequest = updateRequest.input(`GoogleField${index}`, sql.NVarChar, field.value);
    });
    await updateRequest.query(`UPDATE User_tbl SET ${setClauses.join(", ")} WHERE UserID = @UserId`);
    await syncGoogleCustomerIdentity(pool, email, profile, googleName);
    return { id: existing.UserID, email, role: normalizeRole(existing.Role), isNew: false };
  }

  const username = `google_${String(profile.sub).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 90)}`;
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const insertFields = [
    { name: "Username", type: sql.NVarChar(100), parameter: "GoogleUsername", value: username },
    { name: "Email", type: sql.NVarChar(255), parameter: "GoogleEmail", value: email },
    { name: "PasswordHash", type: sql.NVarChar(255), parameter: "GooglePasswordHash", value: passwordHash },
    { name: "Role", type: sql.NVarChar(50), parameter: "GoogleRole", value: "customer" },
  ];
  optionalFields.forEach((field, index) => {
    insertFields.push({
      name: field.name,
      type: sql.NVarChar,
      parameter: `GoogleInsertField${index}`,
      value: field.value,
    });
  });

  let insertRequest = pool.request();
  insertFields.forEach((field) => {
    insertRequest = insertRequest.input(field.parameter, field.type, field.value);
  });
  await insertRequest.query(`
    INSERT INTO User_tbl (${insertFields.map((field) => `[${field.name}]`).join(", ")}, CreatedAt)
    VALUES (${insertFields.map((field) => `@${field.parameter}`).join(", ")}, GETDATE())
  `);

  const createdResult = await pool.request()
    .input("Email", sql.NVarChar(255), email)
    .query("SELECT TOP 1 UserID, Email, Role FROM User_tbl WHERE LOWER(LTRIM(RTRIM(Email))) = @Email");
  const created = normalizeResult(createdResult)[0];
  if (!created) throw new Error("Google account could not be created");
  await syncGoogleCustomerIdentity(pool, email, profile, googleName);
  return { id: created.UserID, email, role: normalizeRole(created.Role), isNew: true };
}

function getRequestIp(req) {
  return req.ip || req.connection?.remoteAddress || null;
}

const userTableColumnsCache = { loaded: false, columns: new Set() };
async function getUserTableColumns(pool) {
  if (userTableColumnsCache.loaded) return userTableColumnsCache.columns;
  try {
    const result = await pool
      .request()
      .query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'User_tbl'");
    const rows = normalizeResult(result);
    rows.forEach((row) => {
      const name = (row.COLUMN_NAME || row.column_name || "").toString().toLowerCase();
      if (name) userTableColumnsCache.columns.add(name);
    });
  } catch (err) {
    console.warn("Could not load User_tbl columns:", err && err.message ? err.message : err);
  } finally {
    userTableColumnsCache.loaded = true;
  }
  return userTableColumnsCache.columns;
}

async function hasUserColumn(pool, columnName) {
  const cols = await getUserTableColumns(pool);
  return cols.has(columnName.toLowerCase());
}

async function hasTableColumn(pool, tableName, columnName) {
  const result = await pool
    .request()
    .input("TableName", sql.NVarChar(261), tableName)
    .input("ColumnName", sql.NVarChar(128), columnName)
    .query(`
      SELECT TOP 1 1 AS [Exists]
      FROM sys.columns
      WHERE object_id = OBJECT_ID(@TableName)
        AND name = @ColumnName
    `);
  return normalizeResult(result).length > 0;
}

async function ensureCustomerAccountTables(pool) {
  if (customerAccountTablesEnsured) return;
  const result = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID(N'dbo.CustomerAccountProfile', N'U') IS NOT NULL
                      AND OBJECT_ID(N'dbo.CustomerAccountAddresses', N'U') IS NOT NULL
                THEN 1 ELSE 0 END AS ready;
  `);
  if (normalizeResult(result)[0]?.ready !== 1) throw new Error("Customer account schema is missing; apply migration 008");
  customerAccountTablesEnsured = true;
}

async function persistSignupPreferences(pool, userId, { emailMarketing, smsMarketing } = {}) {
  if (typeof emailMarketing !== "boolean" && typeof smsMarketing !== "boolean") return;

  try {
    await ensureCustomerAccountTables(pool);
    await pool.request()
      .input("UserId", sql.Int, Number(userId))
      .input("EmailMarketing", sql.Bit, typeof emailMarketing === "boolean" ? emailMarketing : null)
      .input("SMSMarketing", sql.Bit, typeof smsMarketing === "boolean" ? smsMarketing : null)
      .query(`
        UPDATE dbo.CustomerAccountProfile
        SET EmailMarketing = COALESCE(@EmailMarketing, EmailMarketing),
            SMSMarketing = COALESCE(@SMSMarketing, SMSMarketing),
            UpdatedAt = SYSUTCDATETIME()
        WHERE UserID = @UserId;
        IF @@ROWCOUNT = 0
          INSERT INTO dbo.CustomerAccountProfile (UserID, EmailMarketing, SMSMarketing)
          VALUES (@UserId, COALESCE(@EmailMarketing, 0), COALESCE(@SMSMarketing, 0));
      `);
  } catch (error) {
    // Account creation must remain compatible with installations that have
    // not applied the optional customer-account migration yet.
    console.warn("Customer signup preferences were not persisted:", error?.message || error);
  }
}

async function sendNewCustomerEmails({ pool, userId, email, name, emailMarketing }) {
  try {
    const queued = await queueJourneyEvent({
      pool,
      userId,
      email,
      name,
      eventType: "account_created",
      eventKey: `account-created:${userId}`,
      marketingConsent: emailMarketing === true,
    });
    if (queued.schemaAvailable) {
      await runCustomerEmailAutomationOnce({ pool });
      return;
    }
  } catch (error) {
    console.warn("Customer email automation queue failed:", error?.message || error);
  }

  // Keep signup delivery compatible with a deployment that has not yet run
  // migration 021. Once the queue exists, the worker owns delivery and retry.
  try {
    const result = await sendWelcomeEmail({ email, name });
    if (result?.skipped) console.warn("Customer welcome email skipped:", result.reason);
  } catch (error) {
    console.warn("Customer welcome email failed:", error?.message || error);
  }
}

function cleanAccountValue(value, maxLength) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, maxLength) : null;
}

function normalizeAccountEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email : null;
}

function normalizeAddressType(value) {
  return String(value || "shipping").trim().toLowerCase() === "billing" ? "billing" : "shipping";
}

function normalizeAddressInput(body = {}) {
  return {
    addressType: normalizeAddressType(body.addressType),
    label: cleanAccountValue(body.label, 80),
    firstName: cleanAccountValue(body.firstName, 120),
    lastName: cleanAccountValue(body.lastName, 120),
    company: cleanAccountValue(body.company, 200),
    phone: cleanAccountValue(body.phone, 40),
    addressLine1: cleanAccountValue(body.addressLine1, 255),
    addressLine2: cleanAccountValue(body.addressLine2, 255),
    city: cleanAccountValue(body.city, 120),
    stateProvince: cleanAccountValue(body.stateProvince, 120),
    postalCode: cleanAccountValue(body.postalCode, 30),
    country: cleanAccountValue(body.country, 100),
    isDefault: body.isDefault === true,
  };
}

function validateAddressInput(address) {
  const required = ["firstName", "lastName", "addressLine1", "city", "postalCode", "country"];
  return required.every((field) => address[field]);
}

function mapAccountAddress(row) {
  return {
    id: row.Id,
    addressType: row.AddressType,
    label: row.Label || "",
    firstName: row.FirstName || "",
    lastName: row.LastName || "",
    company: row.Company || "",
    phone: row.Phone || "",
    addressLine1: row.AddressLine1 || "",
    addressLine2: row.AddressLine2 || "",
    city: row.City || "",
    stateProvince: row.StateProvince || "",
    postalCode: row.PostalCode || "",
    country: row.Country || "",
    isDefault: Boolean(row.IsDefault),
  };
}

async function loadCustomerAccountDetails(pool, userId, email) {
  await ensureCustomerAccountTables(pool);
  const baseProfile = await loadUserProfile(pool, userId, email);
  const profileResult = await pool
    .request()
    .input("UserId", sql.Int, Number(userId))
    .query("SELECT TOP 1 Phone, EmailMarketing, SMSMarketing FROM dbo.CustomerAccountProfile WHERE UserID = @UserId");
  const profileRow = normalizeResult(profileResult)[0] || {};
  const addressResult = await pool
    .request()
    .input("UserId", sql.Int, Number(userId))
    .query("SELECT * FROM dbo.CustomerAccountAddresses WHERE UserID = @UserId ORDER BY AddressType, IsDefault DESC, UpdatedAt DESC");

  return {
    profile: {
      ...(baseProfile || { id: userId, email, username: email?.split("@")?.[0] || "member" }),
      phone: profileRow.Phone || "",
    },
    preferences: {
      emailMarketing: Boolean(profileRow.EmailMarketing),
      smsMarketing: Boolean(profileRow.SMSMarketing),
    },
    addresses: normalizeResult(addressResult).map(mapAccountAddress),
  };
}

async function ensureAddressDefault(pool, userId, addressType) {
  const defaultResult = await pool.request()
    .input("UserId", sql.Int, Number(userId))
    .input("AddressType", sql.NVarChar(20), addressType)
    .query("SELECT TOP 1 Id FROM dbo.CustomerAccountAddresses WHERE UserID = @UserId AND AddressType = @AddressType AND IsDefault = 1");
  if (normalizeResult(defaultResult).length) return;

  const firstResult = await pool.request()
    .input("UserId", sql.Int, Number(userId))
    .input("AddressType", sql.NVarChar(20), addressType)
    .query("SELECT TOP 1 Id FROM dbo.CustomerAccountAddresses WHERE UserID = @UserId AND AddressType = @AddressType ORDER BY UpdatedAt DESC, CreatedAt DESC");
  const firstId = normalizeResult(firstResult)[0]?.Id;
  if (!firstId) return;

  await pool.request()
    .input("UserId", sql.Int, Number(userId))
    .input("AddressType", sql.NVarChar(20), addressType)
    .input("AddressId", sql.UniqueIdentifier, firstId)
    .query("UPDATE dbo.CustomerAccountAddresses SET IsDefault = CASE WHEN Id = @AddressId THEN 1 ELSE 0 END WHERE UserID = @UserId AND AddressType = @AddressType");
}

async function updateLegacyUser(pool, userId, fields) {
  const setClauses = [];
  let request = pool.request().input("UserId", sql.Int, Number(userId));
  if (fields.username) {
    setClauses.push("[Username] = @Username");
    request = request.input("Username", sql.NVarChar(100), fields.username);
  }
  if (fields.email) {
    setClauses.push("[Email] = @Email");
    request = request.input("Email", sql.NVarChar(255), fields.email);
  }
  if (fields.fullName && await hasUserColumn(pool, "FullName")) {
    setClauses.push("[FullName] = @FullName");
    request = request.input("FullName", sql.NVarChar(250), fields.fullName);
  }
  if (!setClauses.length) return;

  try {
    await request.query(`UPDATE User_tbl SET ${setClauses.join(", ")} WHERE UserID = @UserId`);
  } catch (legacyError) {
    if (!fields.email && !fields.username) throw legacyError;
    const fallback = pool.request().input("UserId", sql.Int, Number(userId));
    const fallbackClauses = [];
    if (fields.username) {
      fallbackClauses.push("[Username] = @Username");
      fallback.input("Username", sql.NVarChar(100), fields.username);
    }
    if (fields.email) {
      fallbackClauses.push("[Email] = @Email");
      fallback.input("Email", sql.NVarChar(255), fields.email);
    }
    if (fields.fullName) {
      fallbackClauses.push("[FullName] = @FullName");
      fallback.input("FullName", sql.NVarChar(250), fields.fullName);
    }
    await fallback.query(`UPDATE [CRM].[Customers] SET ${fallbackClauses.join(", ")}, [UpdatedAt] = SYSUTCDATETIME() WHERE [LegacyUserId] = @UserId`);
  }
}

async function updatePasswordHash(pool, userId, passwordHash) {
  try {
    await pool.request()
      .input("UserId", sql.Int, Number(userId))
      .input("PasswordHash", sql.NVarChar(255), passwordHash)
      .query("UPDATE User_tbl SET PasswordHash = @PasswordHash WHERE UserID = @UserId");
  } catch (legacyError) {
    await pool.request()
      .input("UserId", sql.Int, Number(userId))
      .input("PasswordHash", sql.NVarChar(255), passwordHash)
      .query("UPDATE [CRM].[Customers] SET PasswordHash = @PasswordHash, UpdatedAt = SYSUTCDATETIME() WHERE LegacyUserId = @UserId");
  }
}

async function getCurrentPasswordHash(pool, userId) {
  try {
    const result = await pool.request().input("UserId", sql.Int, Number(userId)).query("SELECT TOP 1 PasswordHash FROM User_tbl WHERE UserID = @UserId");
    return normalizeResult(result)[0]?.PasswordHash || null;
  } catch (_legacyError) {
    const result = await pool.request().input("UserId", sql.Int, Number(userId)).query("SELECT TOP 1 PasswordHash FROM [CRM].[Customers] WHERE LegacyUserId = @UserId");
    return normalizeResult(result)[0]?.PasswordHash || null;
  }
}

async function ensurePasswordResetTable(pool) {
  if (passwordResetTableEnsured) return;
  const result = await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.password_reset_codes', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready");
  if (normalizeResult(result)[0]?.ready !== 1) throw new Error("Password-reset schema is missing; apply migration 009");
  passwordResetTableEnsured = true;
}

function normalizeResetEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || ""));
}

function hashResetValue(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function createPasswordResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function createResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getPasswordResetGenericMessage() {
  return "If a customer account exists for that email, a verification code has been sent.";
}


// Helper function to normalize result
function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;       
  if (result.recordset) return result.recordset;  
  return [];
}

const canonicalCatalogCache = { loaded: false, ready: false };
const legacyPricingColumnsCache = { loaded: false, buyPrice: null, salePrice: null };
const legacyTrendingColumnCache = { loaded: false, column: null };

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeReviewRow(row = {}) {
  return {
    id: row.Id ?? row.id ?? null,
    name: row.CustomerName ?? row.customerName ?? `${configuredStoreName()} customer`,
    rating: Math.min(5, Math.max(1, Number(row.Rating ?? row.rating) || 5)),
    title: row.Title ?? row.title ?? "",
    text: row.ReviewText ?? row.reviewText ?? row.Text ?? row.text ?? "",
    status: row.Status ?? row.status ?? "Approved",
    isFeatured: Boolean(row.IsFeatured ?? row.isFeatured),
    createdAt: row.CreatedAt ?? row.createdAt ?? null,
  };
}

function validateReviewInput(body = {}) {
  const name = String(body.name ?? body.customerName ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().slice(0, 255);
  const title = String(body.title ?? "").trim().slice(0, 160);
  const text = String(body.text ?? body.reviewText ?? body.review ?? "").trim().slice(0, 2000);
  const rating = Number(body.rating);
  if (!name) return { error: "Name is required" };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Rating must be between 1 and 5" };
  if (text.length < 10) return { error: "Review must be at least 10 characters" };
  return { name, email: email || null, title: title || null, text, rating };
}

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return fallback;
}

async function getCanonicalCatalogState(pool) {
  if (canonicalCatalogCache.loaded) return canonicalCatalogCache.ready;
  try {
    const result = await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID(N'[Commerce].[Products]', N'U') IS NOT NULL
                       AND OBJECT_ID(N'[Commerce].[ProductVariants]', N'U') IS NOT NULL
                  THEN 1 ELSE 0 END AS [Ready];
    `);
    canonicalCatalogCache.ready = normalizeResult(result)[0]?.Ready === 1;
  } catch (err) {
    canonicalCatalogCache.ready = false;
    console.warn("Unable to inspect canonical product pricing tables:", err && err.message ? err.message : err);
  } finally {
    canonicalCatalogCache.loaded = true;
  }
  return canonicalCatalogCache.ready;
}

async function getLegacyPricingColumns(pool) {
  if (legacyPricingColumnsCache.loaded) return legacyPricingColumnsCache;
  try {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Products_tbl'
        AND COLUMN_NAME IN ('BuyPrice', 'SalePrice');
    `);
    const names = new Set(normalizeResult(result).map((row) => String(row.COLUMN_NAME || "").toLowerCase()));
    legacyPricingColumnsCache.buyPrice = names.has("buyprice") ? "BuyPrice" : null;
    legacyPricingColumnsCache.salePrice = names.has("saleprice") ? "SalePrice" : null;
  } catch (err) {
    console.warn("Unable to inspect legacy product pricing columns:", err && err.message ? err.message : err);
  } finally {
    legacyPricingColumnsCache.loaded = true;
  }
  return legacyPricingColumnsCache;
}

async function ensureLegacyPricingColumns(pool) {
  // Pricing columns are provisioned by the reviewed migration script. This
  // request path only inspects the schema; it never changes database DDL.
  return getLegacyPricingColumns(pool);
}

async function persistLegacyPricing(pool, productId, payload) {
  const columns = await ensureLegacyPricingColumns(pool);
  const updates = [];
  const request = pool.request().input("ProductId", sql.Int, Number(productId));
  if (columns.buyPrice) {
    updates.push("[BuyPrice] = @BuyPrice");
    request.input("BuyPrice", sql.Decimal(19, 4), payload.buyPrice);
  }
  if (columns.salePrice) {
    updates.push("[SalePrice] = @SalePrice");
    request.input("SalePrice", sql.Decimal(19, 4), payload.salePrice);
  }
  if (!updates.length) return false;
  await request.query(`UPDATE [dbo].[Products_tbl] SET ${updates.join(", ")} WHERE [PID] = @ProductId;`);
  return true;
}

async function getLegacyTrendingColumn(pool) {
  if (legacyTrendingColumnCache.loaded) return legacyTrendingColumnCache.column;
  try {
    const result = await pool.request().query(`
      SELECT TOP 1 COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Products_tbl'
        AND COLUMN_NAME IN ('IsTrending', 'Trending');
    `);
    legacyTrendingColumnCache.column = normalizeResult(result)[0]?.COLUMN_NAME || null;
  } catch (err) {
    console.warn("Unable to inspect legacy product trending column:", err && err.message ? err.message : err);
    legacyTrendingColumnCache.column = null;
  } finally {
    legacyTrendingColumnCache.loaded = true;
  }
  return legacyTrendingColumnCache.column;
}

async function persistLegacyTrending(pool, productId, isTrending) {
  const column = await getLegacyTrendingColumn(pool);
  if (!column) return false;
  await pool.request()
    .input("ProductId", sql.Int, Number(productId))
    .input("IsTrending", sql.Bit, Boolean(isTrending))
    .query(`UPDATE [dbo].[Products_tbl] SET [${column}] = @IsTrending WHERE [PID] = @ProductId;`);
  return true;
}

async function upsertCanonicalProductPricing(pool, productId, payload, canonicalProductId = null) {
  if (!(await getCanonicalCatalogState(pool))) return false;
  const productResult = canonicalProductId
    ? await pool.request()
      .input("ProductId", sql.UniqueIdentifier, canonicalProductId)
      .query(`SELECT TOP 1 [Id], [DefaultVariantId] FROM [Commerce].[Products] WHERE [Id] = @ProductId;`)
    : await pool.request()
      .input("LegacyProductId", sql.Int, Number(productId))
      .query(`SELECT TOP 1 [Id], [DefaultVariantId] FROM [Commerce].[Products] WHERE [LegacyProductId] = @LegacyProductId;`);
  const product = normalizeResult(productResult)[0];
  if (!product) return false;

  const request = pool.request()
    .input("ProductId", sql.UniqueIdentifier, product.Id)
    .input("CostPrice", sql.Decimal(19, 4), payload.buyPrice)
    .input("SellingPrice", sql.Decimal(19, 4), payload.salePrice)
    .input("Currency", sql.Char(3), payload.currency)
    .input("AvailableQuantity", sql.Decimal(19, 4), payload.stock)
    .input("IsTrending", sql.Bit, Boolean(payload.isTrending));

  await request.query(`
    UPDATE [Commerce].[Products]
    SET [IsTrending] = @IsTrending, [UpdatedAt] = SYSUTCDATETIME()
    WHERE [Id] = @ProductId;
  `);

  if (product.DefaultVariantId) {
    request.input("VariantId", sql.UniqueIdentifier, product.DefaultVariantId);
    await request.query(`
      UPDATE [Commerce].[ProductVariants]
      SET [CostPrice] = @CostPrice, [SellingPrice] = @SellingPrice, [Currency] = @Currency,
          [AvailableQuantity] = @AvailableQuantity, [UpdatedAt] = SYSUTCDATETIME()
      WHERE [Id] = @VariantId AND [ProductId] = @ProductId;
    `);
  } else {
    const variantRequest = pool.request()
      .input("ProductId", sql.UniqueIdentifier, product.Id)
      .input("SKU", sql.NVarChar(100), payload.sku || `LEGACY-${productId}`)
      .input("VariantName", sql.NVarChar(255), "Default")
      .input("CostPrice", sql.Decimal(19, 4), payload.buyPrice)
      .input("SellingPrice", sql.Decimal(19, 4), payload.salePrice)
      .input("Currency", sql.Char(3), payload.currency)
      .input("AvailableQuantity", sql.Decimal(19, 4), payload.stock);
    const variantResult = await variantRequest.query(`
      INSERT INTO [Commerce].[ProductVariants]
        ([ProductId], [SKU], [VariantName], [Status], [CostPrice], [SellingPrice], [Currency], [AvailableQuantity])
      OUTPUT INSERTED.[Id]
      VALUES (@ProductId, @SKU, @VariantName, N'Active', @CostPrice, @SellingPrice, @Currency, @AvailableQuantity);
    `);
    const variantId = normalizeResult(variantResult)[0]?.Id;
    if (variantId) {
      await pool.request().input("ProductId", sql.UniqueIdentifier, product.Id).input("VariantId", sql.UniqueIdentifier, variantId)
        .query("UPDATE [Commerce].[Products] SET [DefaultVariantId] = @VariantId, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @ProductId;");
    }
  }
  return true;
}

async function saveCanonicalProductImages(pool, productId, variantId, imageUrls, altText) {
  if (!(await getCanonicalCatalogState(pool)) || !imageUrls?.length) return;
  for (const [index, url] of imageUrls.entries()) {
    if (!url) continue;
    await pool.request()
      .input("ProductId", sql.UniqueIdentifier, productId)
      .input("VariantId", sql.UniqueIdentifier, variantId || null)
      .input("Url", sql.NVarChar(1000), url)
      .input("AltText", sql.NVarChar(500), altText || "Product image")
      .input("SortOrder", sql.Int, index)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM [Commerce].[ProductImages] WHERE [ProductId] = @ProductId AND [Url] = @Url)
        INSERT INTO [Commerce].[ProductImages] ([ProductId], [VariantId], [Url], [AltText], [SortOrder], [IsPrimary])
        VALUES (@ProductId, @VariantId, @Url, @AltText, @SortOrder, CASE WHEN @SortOrder = 0 THEN 1 ELSE 0 END);
      `);
  }
}

async function loadCanonicalProductPricing(pool, productIds = []) {
  const ids = [...new Set(productIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
  if (!ids.length || !(await getCanonicalCatalogState(pool))) return new Map();

  const request = pool.request();
  const parameters = ids.map((id, index) => {
    const name = `legacyProductId${index}`;
    request.input(name, sql.Int, id);
    return `@${name}`;
  });
  try {
    const result = await request.query(`
      IF OBJECT_ID(N'[Commerce].[LegacyProductInventoryMappings]', N'U') IS NOT NULL
      BEGIN
        SELECT p.[LegacyProductId] AS [StorefrontProductId], p.[Id] AS [CanonicalProductId], p.[SKU],
               v.[Id] AS [VariantId], v.[CostPrice], v.[SellingPrice], v.[CompareAtPrice],
               v.[Currency], v.[AvailableQuantity], p.[IsTrending], 0 AS [MappingPriority]
        FROM [Commerce].[Products] p
        LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
        WHERE p.[LegacyProductId] IN (${parameters.join(", ")})

        UNION ALL

        SELECT m.[LegacyProductId] AS [StorefrontProductId], p.[Id] AS [CanonicalProductId], p.[SKU],
               v.[Id] AS [VariantId], v.[CostPrice], v.[SellingPrice], v.[CompareAtPrice],
               v.[Currency], v.[AvailableQuantity], p.[IsTrending], 1 AS [MappingPriority]
        FROM [Commerce].[LegacyProductInventoryMappings] m
        INNER JOIN [Commerce].[Products] p ON p.[Id] = m.[ProductId]
        LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
        WHERE m.[LegacyProductId] IN (${parameters.join(", ")});
      END
      ELSE
      BEGIN
        SELECT p.[LegacyProductId] AS [StorefrontProductId], p.[Id] AS [CanonicalProductId], p.[SKU],
               v.[Id] AS [VariantId], v.[CostPrice], v.[SellingPrice], v.[CompareAtPrice],
               v.[Currency], v.[AvailableQuantity], p.[IsTrending], 0 AS [MappingPriority]
        FROM [Commerce].[Products] p
        LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
        WHERE p.[LegacyProductId] IN (${parameters.join(", ")});
      END;
    `);
    const mapped = new Map();
    normalizeResult(result).forEach((row) => {
      const storefrontProductId = Number(row.StorefrontProductId);
      if (!Number.isFinite(storefrontProductId)) return;
      const existing = mapped.get(storefrontProductId);
      if (existing && Number(existing.mappingPriority) > Number(row.MappingPriority)) return;
      mapped.set(storefrontProductId, {
        canonicalProductId: row.CanonicalProductId,
        sku: row.SKU,
        variantId: row.VariantId,
        buyPrice: numericValue(row.CostPrice),
        salePrice: numericValue(row.SellingPrice),
        compareAtPrice: row.CompareAtPrice == null ? null : numericValue(row.CompareAtPrice),
        currency: row.Currency || "USD",
        stock: numericValue(row.AvailableQuantity),
        isTrending: booleanValue(row.IsTrending),
        mappingPriority: Number(row.MappingPriority) || 0,
      });
    });
    return mapped;
  } catch (err) {
    console.warn("Unable to load canonical product pricing:", err && err.message ? err.message : err);
    return new Map();
  }
}

function mapProductRow(row = {}, pricing = null) {
  const salePrice = numericValue(firstDefined(pricing?.salePrice, row.SalePrice, row.SellingPrice, row.Price, row.price));
  const buyPrice = numericValue(firstDefined(pricing?.buyPrice, row.BuyPrice, row.CostPrice, row.SupplierCost), 0);
  const unitProfit = salePrice - buyPrice;
  return {
    id: row.PID ?? row.id ?? row.productId ?? null,
    sku: row.SKU ?? row.Sku ?? row.ProductCode ?? row.productCode ?? row.PID ?? row.id ?? null,
    category: row.Category ?? row.category ?? null,
    brand: row.Brand ?? row.brand ?? "Generic",
    name: row.Name ?? row.name ?? null,
    description: row.Description ?? row.description ?? "",
    price: salePrice,
    salePrice,
    buyPrice,
    unitProfit,
    marginPercent: salePrice > 0 ? (unitProfit / salePrice) * 100 : 0,
    compareAtPrice: firstDefined(pricing?.compareAtPrice, row.CompareAtPrice, row.OriginalPrice, row.originalPrice) ?? null,
    currency: pricing?.currency || row.Currency || row.currency || "USD",
    originalPrice: firstDefined(pricing?.compareAtPrice, row.OriginalPrice, row.originalPrice, row.CompareAtPrice, row.compareAtPrice) ?? null,
    alt: row.Alt ?? row.alt ?? "",
    img: row.Img ?? row.IMG ?? row.img ?? row.image ?? null,
    stock: firstDefined(pricing?.stock, row.Stock, row.stock, row.Quantity, row.quantity, 0),
    canonicalProductId: pricing?.canonicalProductId || null,
    variantId: pricing?.variantId || null,
    address: row.Address ?? row.address ?? "",
    isTrending: booleanValue(firstDefined(pricing?.isTrending, row.IsTrending, row.isTrending, row.Trending, row.trending), false),
    images: Array.isArray(row.images) ? row.images : [],
  };
}

function truncateString(value, maxLength) {
  if (value === undefined || value === null) return null;
  const text = String(value);
  if (!Number.isFinite(maxLength) || maxLength <= 0) return text;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

let productsSchemaEnsuredForCj = false;
async function ensureProductsSchemaForCj(pool) {
  if (productsSchemaEnsuredForCj) return true;
  try {
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Products_tbl'
        AND COLUMN_NAME IN ('Name','Brand','Category','Description','IMG','Img');
    `);
    const rows = normalizeResult(columns);
    if (!rows.length) return false;
    const byName = new Map(rows.map((row) => [String(row.COLUMN_NAME).toLowerCase(), row]));
    const minimums = { name: 255, brand: 100, category: 100, description: -1 };
    for (const [name, minimum] of Object.entries(minimums)) {
      const row = byName.get(name);
      if (!row || String(row.DATA_TYPE || "").toLowerCase() !== "nvarchar") return false;
      const length = Number(row.CHARACTER_MAXIMUM_LENGTH);
      if (minimum === -1 ? length !== -1 : length !== -1 && length < minimum) return false;
    }
    productsSchemaEnsuredForCj = true;
    return true;
  } catch (err) {
    console.error("Products_tbl schema verification failed; apply migration 011:", err);
    return false;
  }
}

async function ensureCjPrimaryImagePath(imageUrl, pid) {
  const safePid = String(pid || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 24);
  const filename = `cj-${safePid || "product"}.jpg`;
  const relative = `/uploads/${filename}`;
  const absolute = path.join(uploadsDir, filename);

  try {
    if (fs.existsSync(absolute) && fs.statSync(absolute).size > 0) return relative;
  } catch (_err) {
    // ignore
  }

  const url = typeof imageUrl === "string" ? imageUrl.trim() : "";
  if (!url) return relative;

  const fetchFn = typeof fetch === "function" ? fetch : null;
  if (!fetchFn) return relative;

  try {
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const response = await fetchFn(url);
    if (!response.ok) return relative;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return relative;
    await fs.promises.writeFile(absolute, buffer);
    return relative;
  } catch (err) {
    console.warn("CJ image download failed:", err && err.message ? err.message : err);
    return relative;
  }
}

async function loadProductById(pool, productId) {
  try {
    const result = await pool
      .request()
      .input("ProductId", sql.Int, Number(productId))
      .query("SELECT TOP 1 * FROM [dbo].[Products_tbl] WHERE PID = @ProductId");
    const rows = normalizeResult(result);
    if (!rows.length) return null;
    const pricing = await loadCanonicalProductPricing(pool, [productId]);
    return mapProductRow(rows[0], pricing.get(Number(productId)));
  } catch (err) {
    console.error("loadProductById failed", err);
    return null;
  }
}

async function loadProductsByIds(pool, ids = []) {
  const unique = [...new Set(ids.map((id) => Number(id)).filter((v) => Number.isFinite(v)))];
  if (!unique.length) return new Map();

  const request = pool.request();
  const parameters = unique.map((id, idx) => {
    const name = `pid${idx}`;
    request.input(name, sql.Int, id);
    return `@${name}`;
  });

  try {
    const result = await request.query(
      `SELECT * FROM [dbo].[Products_tbl] WHERE PID IN (${parameters.join(",")})`
    );
    const rows = normalizeResult(result);
    const pricing = await loadCanonicalProductPricing(pool, unique);
    const map = new Map();
    rows.forEach((row) => {
      const mapped = mapProductRow(row, pricing.get(Number(row.PID ?? row.id)));
      const pid = Number(row.PID ?? row.id ?? mapped.id);
      if (Number.isFinite(pid)) {
        map.set(pid, mapped);
      }
    });
    return map;
  } catch (err) {
    console.error("loadProductsByIds failed", err);
    return new Map();
  }
}

async function upsertSavedProduct(pool, userId, productId) {
  const ensured = await ensureSavedProductsTable(pool);
  if (!ensured) throw new Error("Saved products storage is unavailable");

  await pool
    .request()
    .input("UserId", sql.Int, Number(userId))
    .input("ProductId", sql.Int, Number(productId))
    .query(`
      MERGE [dbo].[SavedProducts_tbl] AS target
      USING (SELECT @UserId AS UserId, @ProductId AS ProductId) AS source
      ON target.UserId = source.UserId AND target.ProductId = source.ProductId
      WHEN MATCHED THEN
        UPDATE SET SavedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (UserId, ProductId) VALUES (source.UserId, source.ProductId);
    `);
}

async function loadSavedProductsForUser(pool, userId) {
  const ensured = await ensureSavedProductsTable(pool);
  if (!ensured) throw new Error("Saved products storage is unavailable");

  const result = await pool
    .request()
    .input("UserId", sql.Int, Number(userId))
    .query(`
      SELECT ProductId, SavedAt
      FROM [dbo].[SavedProducts_tbl]
      WHERE UserId = @UserId
      ORDER BY SavedAt DESC, SavedProductId DESC;
    `);
  const rows = normalizeResult(result);
  const productMap = await loadProductsByIds(pool, rows.map((row) => row.ProductId));

  return rows
    .map((row) => {
      const productId = Number(row.ProductId);
      const product = productMap.get(productId);
      if (!product) return null;
      return { ...product, savedAt: row.SavedAt || row.savedAt || null };
    })
    .filter(Boolean);
}

function normalizeProductInput(body = {}) {
  const titleOrName = body.title ?? body.name ?? body.Name ?? "";
  const category = body.category ?? body.Category ?? null;
  const brand = body.brand ?? body.Brand ?? null;
  const description = body.description ?? body.Description ?? "";
  const image = body.image ?? body.img ?? body.Img ?? null;
  const alt = body.alt ?? body.Alt ?? "";
  const rawSalePrice = body.salePrice ?? body.salesPrice ?? body.SellingPrice ?? body.price ?? body.Price ?? 0;
  const rawBuyPrice = body.buyPrice ?? body.costPrice ?? body.CostPrice ?? body.BuyPrice ?? body.cost ?? 0;
  const rawStock = body.stock ?? body.Stock ?? body.quantity ?? body.Quantity ?? 0;
  const rawSku = body.sku ?? body.SKU ?? body.productCode ?? body.ProductCode ?? "";
  const rawTrending = body.isTrending ?? body.IsTrending ?? body.trending ?? body.Trending ?? false;

  const salePrice = Number(rawSalePrice);
  const buyPrice = Number(rawBuyPrice);
  const stock = Number(rawStock);

  return {
    name: typeof titleOrName === "string" ? titleOrName.trim() : "",
    category: typeof category === "string" && category.trim().length > 0 ? category.trim() : "General",
    description,
    brand: typeof brand === "string" && brand.trim().length > 0 ? brand.trim() : "Generic",
    sku: typeof rawSku === "string" ? rawSku.trim().slice(0, 100) : "",
    isTrending: booleanValue(rawTrending),
    image,
    alt,
    price: Number.isFinite(salePrice) ? salePrice : 0,
    salePrice: Number.isFinite(salePrice) ? salePrice : 0,
    buyPrice: Number.isFinite(buyPrice) ? buyPrice : 0,
    currency: String(body.currency ?? body.Currency ?? "USD").trim().toUpperCase().slice(0, 3) || "USD",
    stock: Number.isFinite(stock) ? stock : 0,
  };
}

let cachedProductStockColumn = undefined;
let productImagesTableEnsured = false;
let productAddressesTableEnsured = false;
let productImagesTableName = null;
let productAddressesTableName = null;
let ordersTableEnsured = false;
let orderTrackingTableEnsured = false;
let cjFulfillmentTableEnsured = false;

async function getProductStockColumn(pool) {
  if (cachedProductStockColumn !== undefined) {
    return cachedProductStockColumn;
  }

  try {
    const result = await pool
      .request()
      .query(`
        SELECT TOP 1 COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Products_tbl'
          AND COLUMN_NAME IN ('Stock', 'Quantity')
      `);

    const rows = normalizeResult(result);
    cachedProductStockColumn = rows.length ? rows[0].COLUMN_NAME : null;
  } catch (err) {
    console.warn("Unable to determine product stock column:", err && err.message ? err.message : err);
    cachedProductStockColumn = null;
  }

  return cachedProductStockColumn;
}

async function ensureProductImagesTable(pool) {
  if (productImagesTableEnsured) return true;
  try {
    const result = await pool.request().query(`
      SELECT CASE
        WHEN OBJECT_ID(N'Commerce.StorefrontProductImages', N'U') IS NOT NULL THEN N'[Commerce].[StorefrontProductImages]'
        WHEN OBJECT_ID(N'dbo.ProductImages_tbl', N'U') IS NOT NULL THEN N'[dbo].[ProductImages_tbl]'
        ELSE NULL
      END AS [TableName]`);
    productImagesTableName = normalizeResult(result)[0]?.TableName || null;
    if (!productImagesTableName) return false;
    productImagesTableEnsured = true;
    return true;
  } catch (err) {
    console.warn("Unable to locate product image storage:", err?.message || err);
    return false;
  }
}

async function ensureProductAddressesTable(pool) {
  if (productAddressesTableEnsured) return true;
  try {
    const result = await pool.request().query(`
      SELECT CASE
        WHEN OBJECT_ID(N'Commerce.StorefrontProductAddresses', N'U') IS NOT NULL THEN N'[Commerce].[StorefrontProductAddresses]'
        WHEN OBJECT_ID(N'dbo.ProductAddress_tbl', N'U') IS NOT NULL THEN N'[dbo].[ProductAddress_tbl]'
        ELSE NULL
      END AS [TableName]`);
    productAddressesTableName = normalizeResult(result)[0]?.TableName || null;
    if (!productAddressesTableName) return false;
    productAddressesTableEnsured = true;
    return true;
  } catch (err) {
    console.warn("Unable to locate product address storage:", err?.message || err);
    return false;
  }
}

async function ensureOrdersTable(pool) {
  if (ordersTableEnsured) return true;
  try {
    await requireSchemaObjects(pool, ["Commerce.StorefrontOrders"]);
    ordersTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure Orders_tbl:", err);
    return false;
  }
}

async function ensureSavedProductsTable(pool) {
  if (savedProductsTableEnsured) return true;
  try {
    await requireSchemaObjects(pool, ["dbo.SavedProducts_tbl"]);
    savedProductsTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure SavedProducts_tbl:", err);
    return false;
  }
}

async function findCanonicalProductForLegacy(pool, legacyProductId, sku) {
  const mappingResult = await pool.request()
    .input("LegacyProductId", sql.Int, legacyProductId)
    .query(`
      IF OBJECT_ID(N'[Commerce].[LegacyProductInventoryMappings]', N'U') IS NOT NULL
      BEGIN
        SELECT TOP 1 p.[Id], p.[DefaultVariantId]
        FROM [Commerce].[LegacyProductInventoryMappings] m
        INNER JOIN [Commerce].[Products] p ON p.[Id] = m.[ProductId]
        WHERE m.[LegacyProductId] = @LegacyProductId;
      END
      ELSE
      BEGIN
        SELECT CAST(NULL AS UNIQUEIDENTIFIER) AS [Id], CAST(NULL AS UNIQUEIDENTIFIER) AS [DefaultVariantId]
        WHERE 1 = 0;
      END;
    `);
  const mappedProduct = normalizeResult(mappingResult)[0] || null;
  if (mappedProduct?.Id) return mappedProduct;

  const directResult = await pool.request()
    .input("LegacyProductId", sql.Int, legacyProductId)
    .input("SKU", sql.NVarChar(100), sku)
    .query(`
      SELECT TOP 1 [Id], [DefaultVariantId]
      FROM [Commerce].[Products]
      WHERE [LegacyProductId] = @LegacyProductId OR [SKU] = @SKU
      ORDER BY CASE WHEN [LegacyProductId] = @LegacyProductId THEN 0 ELSE 1 END;
    `);
  return normalizeResult(directResult)[0] || null;
}

async function ensureLegacyProductInventoryMapping(pool, legacyProductId, canonicalProductId) {
  const result = await pool.request()
    .input("LegacyProductId", sql.Int, legacyProductId)
    .input("CanonicalProductId", sql.UniqueIdentifier, canonicalProductId)
    .query(`
      IF OBJECT_ID(N'[Commerce].[LegacyProductInventoryMappings]', N'U') IS NULL
      BEGIN
        SELECT CAST(0 AS bit) AS [Ready];
      END
      ELSE
      BEGIN
        BEGIN TRY
          BEGIN TRANSACTION;
          DECLARE @ExistingProductId UNIQUEIDENTIFIER;
          SELECT @ExistingProductId = [ProductId]
          FROM [Commerce].[LegacyProductInventoryMappings] WITH (UPDLOCK, HOLDLOCK)
          WHERE [LegacyProductId] = @LegacyProductId;

          IF @ExistingProductId IS NULL
            INSERT INTO [Commerce].[LegacyProductInventoryMappings] ([LegacyProductId], [ProductId])
            VALUES (@LegacyProductId, @CanonicalProductId);
          ELSE IF @ExistingProductId <> @CanonicalProductId
            THROW 50005, 'Legacy product inventory mapping conflicts with an existing canonical product', 1;
          ELSE
            UPDATE [Commerce].[LegacyProductInventoryMappings]
            SET [UpdatedAt] = SYSUTCDATETIME()
            WHERE [LegacyProductId] = @LegacyProductId;
          COMMIT TRANSACTION;
          SELECT CAST(1 AS bit) AS [Ready];
        END TRY
        BEGIN CATCH
          IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
          THROW;
        END CATCH;
      END;
    `);
  return normalizeResult(result)[0]?.Ready === true || normalizeResult(result)[0]?.Ready === 1;
}

async function ensureCanonicalProductForLegacy(pool, productId, payload, imageUrls = []) {
  if (!(await getCanonicalCatalogState(pool))) return false;

  const numericProductId = Number(productId);
  if (!Number.isFinite(numericProductId)) return false;

  const sku = String(payload.sku || `LEGACY-${numericProductId}`).trim().slice(0, 100) || `LEGACY-${numericProductId}`;
  let product = await findCanonicalProductForLegacy(pool, numericProductId, sku);
  const slug = `legacy-${numericProductId}`;

  if (!product) {
    const request = pool.request()
      .input("SKU", sql.NVarChar(100), sku)
      .input("Name", sql.NVarChar(255), payload.name || `Product ${numericProductId}`)
      .input("Slug", sql.NVarChar(255), slug)
      .input("ShortDescription", sql.NVarChar(500), String(payload.description || "").slice(0, 500))
      .input("Description", sql.NVarChar(sql.MAX), payload.description || "")
      .input("Brand", sql.NVarChar(100), payload.brand || "Generic");

    const insertedResult = await request.query(`
      INSERT INTO [Commerce].[Products]
        ([SKU], [Name], [Slug], [ShortDescription], [Description], [Brand], [Status], [ProductType], [PublishedAt])
      OUTPUT INSERTED.[Id], INSERTED.[DefaultVariantId]
      VALUES (@SKU, @Name, @Slug, @ShortDescription, @Description, @Brand, N'Active', N'Physical', SYSUTCDATETIME());
    `);
    product = normalizeResult(insertedResult)[0] || null;
  } else {
    await pool.request()
      .input("ProductId", sql.UniqueIdentifier, product.Id)
      .input("Name", sql.NVarChar(255), payload.name || `Product ${numericProductId}`)
      .input("Description", sql.NVarChar(sql.MAX), payload.description || "")
      .input("Brand", sql.NVarChar(100), payload.brand || "Generic")
      .query(`
        UPDATE [Commerce].[Products]
        SET [Name] = @Name, [Description] = @Description, [ShortDescription] = LEFT(@Description, 500),
            [Brand] = @Brand, [UpdatedAt] = SYSUTCDATETIME()
        WHERE [Id] = @ProductId;
      `);
  }

  if (!product?.Id) return false;

  await upsertCanonicalProductPricing(pool, numericProductId, {
    buyPrice: payload.buyPrice,
    salePrice: payload.salePrice,
    stock: payload.stock,
    currency: payload.currency,
    sku,
  }, product.Id);

  await ensureLegacyProductInventoryMapping(pool, numericProductId, product.Id);

  const variantResult = await pool.request()
    .input("ProductId", sql.UniqueIdentifier, product.Id)
    .query(`SELECT TOP 1 [DefaultVariantId] FROM [Commerce].[Products] WHERE [Id] = @ProductId;`);
  const variantId = normalizeResult(variantResult)[0]?.DefaultVariantId || null;
  await saveCanonicalProductImages(pool, product.Id, variantId, imageUrls, payload.alt || payload.name);
  return true;
}

async function ensureOrderTrackingTable(pool) {
  if (orderTrackingTableEnsured) return true;
  try {
    await requireSchemaObjects(pool, ["Commerce.StorefrontOrderTrackingEvents"]);
    orderTrackingTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure OrderTrackingEvents_tbl:", err);
    return false;
  }
}

async function ensureCjFulfillmentTable(pool) {
  if (cjFulfillmentTableEnsured) return true;
  try {
    await requireSchemaObjects(pool, ["Commerce.CjFulfillmentOrders"]);
    cjFulfillmentTableEnsured = true;
    return true;
  } catch (error) {
    console.error("Unable to verify CJ fulfillment storage:", error);
    return false;
  }
}

async function ensureCheckoutAttemptsTable(pool) {
  if (checkoutAttemptsTableEnsured) return true;
  try {
    await requireSchemaObjects(pool, ["Commerce.StorefrontCheckoutAttempts"]);
    checkoutAttemptsTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure checkout_attempts table:", err);
    return false;
  }
}

async function recordCheckoutAttempt({ attemptId, userId, cartId, customerEmail, status, paymentError = null, paymentId = null }) {
  if (!attemptId) return;
  try {
    const pool = await getPool();
    const ensured = await ensureCheckoutAttemptsTable(pool);
    if (!ensured) return;

    const completedAt = status === "completed" ? new Date() : null;
    await pool
      .request()
      .input("AttemptId", sql.NVarChar(120), String(attemptId))
      .input("UserId", sql.NVarChar(128), userId ? String(userId) : null)
      .input("CartId", sql.NVarChar(128), cartId ? String(cartId) : null)
      .input("CustomerEmail", sql.NVarChar(255), customerEmail ? String(customerEmail) : null)
      .input("Status", sql.NVarChar(40), String(status || "started"))
      .input("PaymentError", sql.NVarChar(1000), paymentError ? String(paymentError) : null)
      .input("PaymentId", sql.NVarChar(120), paymentId ? String(paymentId) : null)
      .input("CompletedAt", sql.DateTime2, completedAt)
      .query(`
        MERGE [Commerce].[StorefrontCheckoutAttempts] AS target
        USING (SELECT @AttemptId AS attempt_id) AS source
        ON target.attempt_id = source.attempt_id
        WHEN MATCHED THEN
          UPDATE SET user_id = @UserId, cart_id = @CartId, customer_email = @CustomerEmail,
            status = @Status, payment_error = @PaymentError, payment_id = @PaymentId,
            updated_at = SYSUTCDATETIME(), completed_at = COALESCE(@CompletedAt, completed_at)
        WHEN NOT MATCHED THEN
          INSERT (attempt_id, user_id, cart_id, customer_email, status, payment_error, payment_id, completed_at)
          VALUES (@AttemptId, @UserId, @CartId, @CustomerEmail, @Status, @PaymentError, @PaymentId, @CompletedAt);
      `);
  } catch (err) {
    // Checkout should still work if the optional recovery table is unavailable.
    console.error("recordCheckoutAttempt failed", err);
  }
}

function mapOrderRow(row = {}) {
  let items = [];
  try {
    const raw = row.Items ?? row.items ?? "[]";
    items = Array.isArray(raw) ? raw : JSON.parse(raw);
  } catch (_err) {
    items = [];
  }
  let shippingAddress = null;
  try {
    const rawShipping = row.ShippingAddress ?? row.shippingAddress ?? null;
    shippingAddress = typeof rawShipping === "string" ? JSON.parse(rawShipping) : rawShipping;
  } catch (_err) {
    shippingAddress = null;
  }
  return {
    id: row.OrderId ?? row.orderId ?? row.id,
    userId: row.UserId ?? row.userId,
    status: row.Status ?? row.status ?? "Processing",
    total: Number(row.Total ?? row.total ?? 0),
    placedAt: row.PlacedAt ?? row.placedAt ?? new Date().toISOString(),
    items: Array.isArray(items) ? items : [],
    shippingAddress,
    paymentMethod: row.PaymentMethod ?? row.paymentMethod ?? null,
    paymentStatus: row.PaymentStatus ?? row.paymentStatus ?? "pending",
    couponCode: row.CouponCode ?? row.couponCode ?? null,
    carrier: row.Carrier ?? row.carrier ?? null,
    trackingNumber: row.TrackingNumber ?? row.trackingNumber ?? null,
    estimatedDelivery: row.EstimatedDelivery ?? row.estimatedDelivery ?? null,
    currentLocation: row.CurrentLocation ?? row.currentLocation ?? null,
    shippedAt: row.ShippedAt ?? row.shippedAt ?? null,
    deliveredAt: row.DeliveredAt ?? row.deliveredAt ?? null,
  };
}

const orderTrackingSteps = [
  { status: "Processing", title: "Order confirmed", description: "Your order is confirmed and our fulfillment team is preparing it." },
  { status: "Packed", title: "Packed with care", description: "Your items have been checked and packed for their journey." },
  { status: "Shipped", title: "Handed to carrier", description: "Your parcel has left our fulfillment center." },
  { status: "In Transit", title: "In transit", description: "Your parcel is moving through the delivery network." },
  { status: "Out for Delivery", title: "Out for delivery", description: "Your parcel is with the local delivery team." },
  { status: "Delivered", title: "Delivered", description: "Your order has arrived at its destination." },
];

function addOrderDays(value, days) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function getTrackingProgress(status) {
  const normalized = String(status || "Processing").toLowerCase();
  if (normalized.includes("cancel")) return 0;
  if (normalized.includes("deliver") && normalized.includes("out")) return 4;
  if (normalized.includes("deliver")) return 5;
  if (normalized.includes("transit")) return 3;
  if (normalized.includes("ship")) return 2;
  if (normalized.includes("pack")) return 1;
  return 0;
}

function buildDefaultTracking(order) {
  const progressIndex = getTrackingProgress(order.status);
  const estimatedDelivery = order.estimatedDelivery || addOrderDays(order.placedAt, shippingDeliveryDays(order.shippingAddress?.shippingWindow));
  const eventCount = Math.max(1, progressIndex + 1);
  const events = orderTrackingSteps.slice(0, eventCount).map((step, index) => ({
    status: step.status,
    title: step.title,
    description: step.description,
    location: index >= 2 ? (order.currentLocation || "Delivery network") : `${configuredStoreName()} fulfillment center`,
    eventAt: addOrderDays(order.placedAt, index),
  })).reverse();

  return {
    progressIndex,
    steps: orderTrackingSteps.map((step, index) => ({ ...step, state: index < progressIndex ? "complete" : index === progressIndex ? "current" : "upcoming" })),
    events,
    carrier: order.carrier || null,
    trackingNumber: order.trackingNumber || null,
    estimatedDelivery,
    currentLocation: order.currentLocation || (progressIndex >= 2 ? "Delivery network" : "Fulfillment center"),
  };
}

function cjTrackingCacheTtlMs() {
  const seconds = Number(process.env.CJ_TRACKING_SYNC_TTL_SECONDS);
  return Math.min(3_600_000, Math.max(30_000, (Number.isFinite(seconds) ? seconds : 300) * 1000));
}

async function insertTrackingEvent(pool, userId, orderId, event) {
  const ensured = await ensureOrderTrackingTable(pool);
  if (!ensured) return false;

  const eventAt = new Date(event.eventAt || Date.now());
  const safeEventAt = Number.isNaN(eventAt.getTime()) ? new Date() : eventAt;
  const title = String(event.title || event.status || "Order update").slice(0, 160);
  const status = String(event.status || "Processing").slice(0, 50);
  try {
    const result = await pool.request()
      .input("OrderId", sql.NVarChar(64), String(orderId))
      .input("UserId", sql.NVarChar(64), String(userId))
      .input("Status", sql.NVarChar(50), status)
      .input("Title", sql.NVarChar(160), title)
      .input("Description", sql.NVarChar(600), event.description ? String(event.description).slice(0, 600) : null)
      .input("Location", sql.NVarChar(160), event.location ? String(event.location).slice(0, 160) : null)
      .input("EventAt", sql.DateTime2, safeEventAt)
      .query(`
        INSERT INTO [Commerce].[StorefrontOrderTrackingEvents]
          (OrderId, UserId, Status, Title, Description, Location, EventAt, IsPublic)
        SELECT @OrderId, @UserId, @Status, @Title, @Description, @Location, @EventAt, 1
        WHERE NOT EXISTS (
          SELECT 1
          FROM [Commerce].[StorefrontOrderTrackingEvents]
          WHERE OrderId = @OrderId AND UserId = @UserId AND Status = @Status AND Title = @Title AND IsPublic = 1
        );
      `);
    return Number(result.rowsAffected?.[0] || 0) > 0;
  } catch (error) {
    console.error("Unable to store CJ tracking event", error);
    return false;
  }
}

async function lookupCjTracking(trackingNumber) {
  const key = String(trackingNumber).trim().toUpperCase();
  const cached = cjTrackingLookupCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.record;
  const record = await fetchCjTracking(trackingNumber);
  if (cjTrackingLookupCache.size > 500) {
    for (const [cacheKey, entry] of cjTrackingLookupCache) {
      if (entry.expiresAt <= Date.now()) cjTrackingLookupCache.delete(cacheKey);
    }
  }
  cjTrackingLookupCache.set(key, { record, expiresAt: Date.now() + cjTrackingCacheTtlMs() });
  return record;
}

async function lookupCjOrderDetail(cjOrderId) {
  const key = String(cjOrderId).trim().toUpperCase();
  const cached = cjOrderStatusLookupCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.detail;
  const detail = await fetchCjOrderDetail(cjOrderId);
  if (cjOrderStatusLookupCache.size > 500) {
    for (const [cacheKey, entry] of cjOrderStatusLookupCache) {
      if (entry.expiresAt <= Date.now()) cjOrderStatusLookupCache.delete(cacheKey);
    }
  }
  cjOrderStatusLookupCache.set(key, { detail, expiresAt: Date.now() + cjTrackingCacheTtlMs() });
  return detail;
}

async function syncCjFulfillmentStatusForOrder(pool, userId, order) {
  const checkedAt = new Date().toISOString();
  if (!cjTrackingConfigured()) return { order, sync: { configured: false, checkedAt } };

  const fulfillment = await loadCjFulfillment(pool, userId, order.id);
  if (!fulfillment?.CjOrderId) {
    return {
      order,
      sync: {
        configured: true,
        checkedAt,
        submissionStatus: fulfillment?.SubmissionStatus || null,
        reason: fulfillment?.SubmissionStatus === "Failed" ? "fulfillment_submission_failed" : "not_submitted_to_cj",
      },
    };
  }

  try {
    const detail = await lookupCjOrderDetail(fulfillment.CjOrderId);
    if (!detail) return { order, sync: { configured: true, checkedAt, cjOrderId: fulfillment.CjOrderId, reason: "order_not_found" } };
    const applied = await applyCjOrderDetail(pool, userId, order, fulfillment, detail);
    return {
      order: applied.order,
      sync: {
        configured: true,
        connected: true,
        checkedAt,
        cjOrderId: String(fulfillment.CjOrderId),
        cjOrderStatus: String(detail.subStatus || detail.orderStatus || "").trim() || null,
        submissionStatus: applied.fulfillment.submissionStatus,
      },
    };
  } catch (error) {
    console.warn("CJ order status lookup failed", error?.name || "unknown_error");
    return { order, sync: { configured: true, connected: false, checkedAt, cjOrderId: String(fulfillment.CjOrderId) } };
  }
}

async function syncCjTrackingForOrder(pool, userId, order) {
  const checkedAt = new Date().toISOString();
  if (String(order.status || "").toLowerCase().includes("cancel")) {
    return { order, sync: { provider: "cj", configured: cjTrackingConfigured(), checkedAt, reason: "order_cancelled" } };
  }

  let fulfillmentResult = { order, sync: { configured: cjTrackingConfigured(), checkedAt } };
  try {
    fulfillmentResult = await syncCjFulfillmentStatusForOrder(pool, userId, order);
  } catch (error) {
    console.warn("CJ fulfillment status sync skipped", error?.name || "unknown_error");
  }
  const currentOrder = fulfillmentResult.order || order;
  const baseSync = { provider: "cj", ...fulfillmentResult.sync, checkedAt };

  if (!cjTrackingConfigured()) return { order: currentOrder, sync: baseSync };
  if (!currentOrder.trackingNumber) {
    return {
      order: currentOrder,
      sync: { ...baseSync, reason: baseSync.reason || "awaiting_tracking_number" },
    };
  }

  const record = await lookupCjTracking(currentOrder.trackingNumber);
  if (!record) {
    return { order: currentOrder, sync: { ...baseSync, reason: "tracking_not_found" } };
  }

  const cjStage = stageFromCjStatus(record.trackingStatus, currentOrder.status);
  const currentProgress = getTrackingProgress(currentOrder.status);
  const cjProgress = getTrackingProgress(cjStage);
  const stage = cjProgress >= currentProgress ? cjStage : currentOrder.status;
  const carrier = hideSupplierBranding(record.lastMileCarrier || record.logisticName || currentOrder.carrier, null);
  const currentLocation = currentLocationFromTracking(record) || currentOrder.currentLocation || null;
  const event = trackingEventFromRecord(record, stage);
  const eventDate = new Date(event.eventAt);
  const eventAt = Number.isNaN(eventDate.getTime()) ? null : eventDate.toISOString();
  const updatedOrder = {
    ...currentOrder,
    status: stage,
    carrier,
    currentLocation,
    shippedAt: cjProgress >= 2 ? (currentOrder.shippedAt || eventAt) : currentOrder.shippedAt,
    deliveredAt: cjProgress === 5 ? (currentOrder.deliveredAt || eventAt) : currentOrder.deliveredAt,
  };
  const changed = updatedOrder.status !== currentOrder.status
    || updatedOrder.carrier !== currentOrder.carrier
    || updatedOrder.currentLocation !== currentOrder.currentLocation
    || updatedOrder.shippedAt !== currentOrder.shippedAt
    || updatedOrder.deliveredAt !== currentOrder.deliveredAt;

  if (changed) await saveOrder(pool, userId, updatedOrder);
  if (changed) {
    await queueOrderStatusEvent({
      pool,
      userId,
      order: updatedOrder,
      status: updatedOrder.trackingNumber && !currentOrder.trackingNumber ? "tracking created" : stage,
      eventAt,
    }).catch((error) => console.warn("Unable to schedule order status email:", error?.message || error));
  }
  if (cjProgress >= currentProgress) await insertTrackingEvent(pool, userId, currentOrder.id, event);

  return {
    order: updatedOrder,
    sync: {
      ...baseSync,
      configured: true,
      connected: true,
      trackingStatus: String(record.trackingStatus || "").trim() || null,
      lastMileTrackingNumber: String(record.lastTrackNumber || "").trim() || null,
    },
  };
}

async function loadOrderTracking(pool, userId, order) {
  const fallback = buildDefaultTracking(order);
  const ensured = await ensureOrderTrackingTable(pool);
  if (!ensured) return fallback;

  try {
    const result = await pool.request()
      .input("OrderId", sql.NVarChar(64), String(order.id))
      .input("UserId", sql.NVarChar(64), String(userId))
      .query(`
        SELECT TOP 50 Status, Title, Description, Location, EventAt
        FROM [Commerce].[StorefrontOrderTrackingEvents]
        WHERE OrderId = @OrderId AND UserId = @UserId AND IsPublic = 1
        ORDER BY EventAt DESC;
      `);
    const events = normalizeResult(result).map((row) => ({
      status: row.Status ?? row.status ?? "",
      title: row.Title ?? row.title ?? row.Status ?? row.status ?? "Order update",
      description: row.Description ?? row.description ?? "Your order has been updated.",
      location: row.Location ?? row.location ?? null,
      eventAt: row.EventAt ?? row.eventAt ?? null,
    }));
    return { ...fallback, events: events.length ? events : fallback.events };
  } catch (err) {
    console.error("loadOrderTracking failed", err);
    return fallback;
  }
}

function getPaymentProviderConfig() {
  const provider = String(process.env.PAYMENT_PROVIDER || "").trim().toLowerCase();
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const appBaseUrl = String(process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  return {
    provider,
    secretKey,
    appBaseUrl,
    configured: provider === "stripe" && Boolean(secretKey) && /^https?:\/\//i.test(appBaseUrl),
  };
}

async function stripeRequest(pathname, body) {
  const config = getPaymentProviderConfig();
  if (!config.configured) throw new Error("Stripe payment provider is not configured");

  const response = await fetch(`https://api.stripe.com/v1${pathname}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: body.toString() } : {}),
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = { error: { message: raw.slice(0, 500) } };
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  }
  return data;
}

function buildStripeCheckoutBody({ checkoutId, checkoutExpiresAt, userId, cart, amount, currency, customerEmail, shippingMethod, shippingAmount = 0, shippingLabel = "Shipping", discountAmount = 0, couponCode = "", discountPercent = 0 }) {
  const config = getPaymentProviderConfig();
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${config.appBaseUrl}/checkout/return?status=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${config.appBaseUrl}/checkout/return?status=cancelled&session_id={CHECKOUT_SESSION_ID}`);
  body.set("expires_at", String(Math.floor(new Date(checkoutExpiresAt).getTime() / 1000)));
  body.set("metadata[user_id]", String(userId));
  body.set("metadata[checkout_id]", String(checkoutId));
  body.set("metadata[shipping_method]", shippingMethod);
  body.set("metadata[currency]", currency);
  body.set("metadata[coupon_code]", couponCode || "");
  body.set("metadata[discount_percent]", String(Number(discountPercent) || 0));
  body.set("metadata[discount_amount]", String(Number(discountAmount) || 0));
  body.set("payment_intent_data[metadata][user_id]", String(userId));
  body.set("payment_intent_data[metadata][checkout_id]", String(checkoutId));
  if (customerEmail) body.set("customer_email", customerEmail);

  const discountCents = Math.min(
    cart.reduce((sum, item) => sum + Math.max(0, Math.round((Number(item.price) || 0) * 100)) * Math.max(1, Number(item.quantity) || 1), 0),
    Math.max(0, Math.round((Number(discountAmount) || 0) * 100)),
  );
  let remainingDiscountCents = discountCents;

  cart.forEach((item, index) => {
    const quantity = parseBoundedInteger(item.quantity, { min: 1, max: MAX_CART_QUANTITY }) || 1;
    const unitAmount = Math.max(0, Math.round((Number(item.price) || 0) * 100));
    const originalLineTotal = unitAmount * quantity;
    const lineDiscount = index === cart.length - 1
      ? Math.min(originalLineTotal, remainingDiscountCents)
      : Math.min(originalLineTotal, Math.round(originalLineTotal * (Number(discountPercent) || 0) / 100));
    remainingDiscountCents = Math.max(0, remainingDiscountCents - lineDiscount);
    const discountedLineTotal = Math.max(0, originalLineTotal - lineDiscount);
    body.set(`line_items[${index}][price_data][currency]`, currency.toLowerCase());
    body.set(`line_items[${index}][price_data][product_data][name]`, `${String(item.title || `${configuredStoreName()} product`).slice(0, 225)}${quantity > 1 ? ` (x${quantity})` : ""}`);
    // Use one line per cart item so the server can preserve the exact cent-level
    // discount while still showing the requested quantity in Stripe Checkout.
    body.set(`line_items[${index}][price_data][unit_amount]`, String(discountedLineTotal));
    body.set(`line_items[${index}][quantity]`, "1");
  });

  const shippingCents = Math.max(0, Math.round((Number(shippingAmount) || 0) * 100));
  if (shippingCents > 0) {
    const index = cart.length;
    body.set(`line_items[${index}][price_data][currency]`, currency.toLowerCase());
    body.set(`line_items[${index}][price_data][product_data][name]`, String(shippingLabel || "Shipping").slice(0, 225));
    body.set(`line_items[${index}][price_data][unit_amount]`, String(shippingCents));
    body.set(`line_items[${index}][quantity]`, "1");
  }

  // Keep the calculated amount in metadata for an explicit server-side check
  // when the customer returns from Stripe Checkout.
  body.set("metadata[weluxo_amount]", String(Math.round(amount * 100)));
  return body;
}

async function loadOrdersForUser(pool, userId) {
  const ensured = await ensureOrdersTable(pool);
  if (!ensured) return [];
  try {
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, String(userId))
      .query("SELECT * FROM [Commerce].[StorefrontOrders] WHERE UserId = @UserId ORDER BY PlacedAt DESC");
    const rows = normalizeResult(result);
    return rows.map(mapOrderRow);
  } catch (err) {
    console.error("loadOrdersForUser failed", err);
    return [];
  }
}

async function loadOrderById(pool, userId, orderId) {
  const ensured = await ensureOrdersTable(pool);
  if (!ensured) return null;
  try {
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, String(userId))
      .input("OrderId", sql.NVarChar, String(orderId))
      .query("SELECT TOP 1 * FROM [Commerce].[StorefrontOrders] WHERE UserId = @UserId AND OrderId = @OrderId");
    const rows = normalizeResult(result);
    return rows.length ? mapOrderRow(rows[0]) : null;
  } catch (err) {
    console.error("loadOrderById failed", err);
    return null;
  }
}

function canonicalFulfillmentStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value.includes("cancel")) return "Cancelled";
  if (value.includes("out for")) return "Out for Delivery";
  if (value.includes("deliver")) return "Delivered";
  if (value.includes("transit")) return "In Transit";
  if (value.includes("ship")) return "Shipped";
  if (value.includes("pack")) return "Packed";
  return null;
}

async function syncCanonicalOrderStatus(pool, order) {
  const legacyOrderId = String(order?.id || "").trim();
  const orderStatus = String(order?.status || "").trim().slice(0, 40);
  if (!legacyOrderId || !orderStatus) return false;

  const fulfillmentStatus = canonicalFulfillmentStatus(orderStatus);
  try {
    const result = await pool.request()
      .input("LegacyOrderId", sql.NVarChar(64), legacyOrderId)
      .input("OrderStatus", sql.NVarChar(40), orderStatus)
      .input("FulfillmentStatus", sql.NVarChar(40), fulfillmentStatus)
      .query(`
        DECLARE @CanonicalOrderId UNIQUEIDENTIFIER;
        DECLARE @PreviousStatus NVARCHAR(40);

        SELECT TOP (1)
          @CanonicalOrderId = [Id],
          @PreviousStatus = [OrderStatus]
        FROM [Commerce].[Orders] WITH (UPDLOCK, ROWLOCK)
        WHERE [LegacyOrderId] = @LegacyOrderId OR [OrderNumber] = @LegacyOrderId
        ORDER BY CASE WHEN [LegacyOrderId] = @LegacyOrderId THEN 0 ELSE 1 END, [CreatedAt] DESC;

        IF @CanonicalOrderId IS NOT NULL
        BEGIN
          UPDATE [Commerce].[Orders]
          SET [OrderStatus] = @OrderStatus,
              [FulfillmentStatus] = COALESCE(@FulfillmentStatus, [FulfillmentStatus]),
              [CompletedAt] = CASE WHEN @OrderStatus = N'Delivered' THEN COALESCE([CompletedAt], SYSUTCDATETIME()) ELSE [CompletedAt] END,
              [CancelledAt] = CASE WHEN @OrderStatus = N'Cancelled' THEN COALESCE([CancelledAt], SYSUTCDATETIME()) ELSE [CancelledAt] END,
              [UpdatedAt] = SYSUTCDATETIME()
          WHERE [Id] = @CanonicalOrderId;

          IF ISNULL(@PreviousStatus, N'') <> @OrderStatus
          BEGIN
            INSERT INTO [Commerce].[OrderStatusHistory]
              ([OrderId], [PreviousStatus], [NewStatus], [Reason])
            VALUES
              (@CanonicalOrderId, @PreviousStatus, @OrderStatus, N'CJ fulfillment status sync');
          END;
        END;

        SELECT CASE WHEN @CanonicalOrderId IS NULL THEN 0 ELSE 1 END AS [Synced];
      `);
    return Number(normalizeResult(result)[0]?.Synced || 0) === 1;
  } catch (error) {
    // Storefront tracking must continue working if a deployment has not yet
    // applied the canonical order migrations.
    console.warn("Canonical order status sync skipped", error?.message || error);
    return false;
  }
}

async function saveOrder(pool, userId, order, couponRedemption = null) {
  const ensured = await ensureOrdersTable(pool);
  if (!ensured) return false;
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    if (couponRedemption?.couponId) {
      const identity = getCouponCustomerIdentity(userId, couponRedemption.customerEmail);
      if (!identity) throw new Error("A customer email is required to redeem a coupon");

      await new sql.Request(transaction)
        .input("CouponId", sql.Int, Number(couponRedemption.couponId))
        .input("CustomerKey", sql.NVarChar(255), identity.customerKey)
        .input("CustomerEmail", sql.NVarChar(255), identity.customerEmail)
        .input("OrderId", sql.NVarChar(64), String(order.id))
        .query(`
          INSERT INTO dbo.CouponRedemptions (CouponId, CustomerKey, CustomerEmail, OrderId)
          VALUES (@CouponId, @CustomerKey, @CustomerEmail, @OrderId);
        `);
    }

    const itemsJson = JSON.stringify(order.items || []);
    await new sql.Request(transaction)
      .input("OrderId", sql.NVarChar(64), String(order.id))
      .input("UserId", sql.NVarChar(64), String(userId))
      .input("Status", sql.NVarChar(50), order.status || "Processing")
      .input("Total", sql.Decimal(18, 2), Number(order.total) || 0)
      .input("Items", sql.NVarChar(sql.MAX), itemsJson)
      .input("ShippingAddress", sql.NVarChar(sql.MAX), JSON.stringify(order.shippingAddress || {}))
      .input("PaymentMethod", sql.NVarChar(30), order.paymentMethod || null)
      .input("PaymentStatus", sql.NVarChar(30), order.paymentStatus || "pending")
      .input("CouponCode", sql.NVarChar(64), order.couponCode || null)
      .input("Carrier", sql.NVarChar(80), order.carrier || null)
      .input("TrackingNumber", sql.NVarChar(120), order.trackingNumber || null)
      .input("EstimatedDelivery", sql.DateTime, order.estimatedDelivery ? new Date(order.estimatedDelivery) : null)
      .input("CurrentLocation", sql.NVarChar(160), order.currentLocation || null)
      .input("ShippedAt", sql.DateTime, order.shippedAt ? new Date(order.shippedAt) : null)
      .input("DeliveredAt", sql.DateTime, order.deliveredAt ? new Date(order.deliveredAt) : null)
      .input("PlacedAt", sql.DateTime, order.placedAt ? new Date(order.placedAt) : new Date())
      .query(`
        MERGE [Commerce].[StorefrontOrders] AS target
        USING (SELECT @OrderId AS OrderId, @UserId AS UserId) AS source
        ON target.OrderId = source.OrderId AND target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET Status = @Status, Total = @Total, Items = @Items, ShippingAddress = @ShippingAddress, PaymentMethod = @PaymentMethod, PaymentStatus = @PaymentStatus, CouponCode = @CouponCode, Carrier = @Carrier, TrackingNumber = @TrackingNumber, EstimatedDelivery = @EstimatedDelivery, CurrentLocation = @CurrentLocation, ShippedAt = @ShippedAt, DeliveredAt = @DeliveredAt, PlacedAt = @PlacedAt
        WHEN NOT MATCHED THEN
          INSERT (OrderId, UserId, Status, Total, Items, ShippingAddress, PaymentMethod, PaymentStatus, CouponCode, Carrier, TrackingNumber, EstimatedDelivery, CurrentLocation, ShippedAt, DeliveredAt, PlacedAt)
          VALUES (@OrderId, @UserId, @Status, @Total, @Items, @ShippingAddress, @PaymentMethod, @PaymentStatus, @CouponCode, @Carrier, @TrackingNumber, @EstimatedDelivery, @CurrentLocation, @ShippedAt, @DeliveredAt, @PlacedAt);
      `);
    await transaction.commit();
    await syncCanonicalOrderStatus(pool, order);
    return { saved: true };
  } catch (err) {
    try { await transaction.rollback(); } catch (_rollbackError) {}
    const errorNumber = Number(err?.number ?? err?.originalError?.info?.number);
    const errorMessage = String(err?.message || "");
    if ([2601, 2627].includes(errorNumber) && /CouponRedemptions|UQ_CouponRedemptions/i.test(errorMessage)) {
      return { saved: false, couponAlreadyUsed: true };
    }
    console.error("saveOrder failed", err);
    return { saved: false };
  }
}

function cjFulfillmentEnabled() {
  return cjTrackingConfigured() && String(process.env.CJ_FULFILLMENT_ENABLED || "").toLowerCase() === "true";
}

function cjAutoPayEnabled() {
  // Never allow the real balance endpoint while sandbox mode is enabled. The
  // separate flag makes a live debit an explicit deployment decision.
  return !cjSandboxModeConfigured() && String(process.env.CJ_AUTO_PAY_ENABLED || "").toLowerCase() === "true";
}

function cjSandboxModeConfigured() {
  return String(process.env.CJ_SANDBOX_MODE || "").toLowerCase() === "true";
}

function cjCountryCode(value) {
  const country = String(value || "").trim();
  if (/^[a-z]{2}$/i.test(country)) return country.toUpperCase();
  const aliases = {
    "united states": "US", "united states of america": "US", usa: "US",
    "united kingdom": "GB", uk: "GB", "great britain": "GB",
    "south korea": "KR", "north korea": "KP", russia: "RU",
    "viet nam": "VN", "czech republic": "CZ", "taiwan": "TW",
  };
  const normalized = country.toLowerCase();
  if (aliases[normalized]) return aliases[normalized];
  try {
    return Country.getAllCountries().find((entry) =>
      String(entry.name || "").toLowerCase() === normalized
      || String(entry.isoCode || "").toLowerCase() === normalized
    )?.isoCode || null;
  } catch (_error) {
    return null;
  }
}

function cjCountryName(value, countryCode) {
  const supplied = String(value || "").trim();
  try {
    return Country.getCountryByCode(countryCode)?.name || supplied;
  } catch (_error) {
    return supplied;
  }
}
function cjOrderConfiguration(shipping = {}) {
  const fromCountryCode = String(shipping.fromCountryCode || process.env.CJ_FROM_COUNTRY_CODE || "").trim().toUpperCase();
  const logisticName = String(shipping.logisticName || shipping.shippingMethod || process.env.CJ_LOGISTIC_NAME || "").trim();
  const shopLogisticsType = Number(process.env.CJ_SHOP_LOGISTICS_TYPE || 2);
  if (!/^[A-Z]{2}$/.test(fromCountryCode) || !logisticName || ![1, 2, 3].includes(shopLogisticsType)) return null;
  return {
    fromCountryCode,
    logisticName,
    shopLogisticsType,
    isSandbox: String(process.env.CJ_SANDBOX_MODE || "").toLowerCase() === "true" ? 1 : 0,
  };
}

async function buildCjOrderPayload(pool, order) {
  const shipping = order.shippingAddress || {};
  const config = cjOrderConfiguration(shipping);
  if (!config) throw new Error("CJ fulfillment configuration or selected shipping service is incomplete");
  const countryCode = cjCountryCode(shipping.country);
  if (!countryCode) throw new Error("The delivery country is not supported by CJ");
  const cjProducts = await loadCjFreightProducts(pool, order.items || []);
  const products = (order.items || []).map((item, index) => {
    const variantId = String(cjProducts[index]?.vid || "").trim();
    const quantity = parseBoundedInteger(item.quantity, { min: 1, max: MAX_CART_QUANTITY });
    if (!variantId || quantity == null) {
      throw new Error("A product is missing its CJ variant mapping");
    }
    return {
      vid: variantId,
      storeLineItemId: `${String(order.id).slice(0, 50)}-${index + 1}`,
      quantity,
    };
  });
  if (!products.length) throw new Error("A CJ order requires at least one product");

  return {
    // CJ's standard product flow accepts the CJ variant IDs already used to
    // calculate the customer-selected shipping service. Store order flow
    // requires an additional, account-level Store Product mapping in CJ.
    orderFlow: 1,
    orderNumber: String(order.id).slice(0, 50),
    shippingZip: String(shipping.postalCode || "").trim().slice(0, 200),
    shippingCountryCode: countryCode,
    shippingCountry: cjCountryName(shipping.country, countryCode).slice(0, 200),
    shippingProvince: String(shipping.region || "").trim().slice(0, 200),
    shippingCity: String(shipping.city || "").trim().slice(0, 200),
    shippingAddress: String(shipping.addressLine1 || "").trim().slice(0, 200),
    shippingAddress2: String(shipping.addressLine2 || "").trim().slice(0, 200),
    shippingCustomerName: String(shipping.fullName || "").trim().slice(0, 200),
    shippingPhone: String(shipping.phone || "").trim().slice(0, 200),
    remark: `${configuredStoreName()} order ${String(order.id).slice(0, 50)}`,
    fromCountryCode: config.fromCountryCode,
    logisticName: config.logisticName,
    shopLogisticsType: config.shopLogisticsType,
    isSandbox: config.isSandbox,
    products,
  };
}

async function loadCjFulfillment(pool, userId, orderId) {
  if (!(await ensureCjFulfillmentTable(pool))) return null;
  const result = await pool.request()
    .input("OrderId", sql.NVarChar(64), String(orderId))
    .input("UserId", sql.NVarChar(64), String(userId))
    .query(`SELECT TOP 1 * FROM [Commerce].[CjFulfillmentOrders] WHERE OrderId = @OrderId AND UserId = @UserId`);
  return normalizeResult(result)[0] || null;
}

async function upsertCjFulfillment(pool, userId, orderId, values = {}) {
  if (!(await ensureCjFulfillmentTable(pool))) return false;
  await pool.request()
    .input("OrderId", sql.NVarChar(64), String(orderId))
    .input("UserId", sql.NVarChar(64), String(userId))
    .input("CjOrderId", sql.NVarChar(200), values.cjOrderId ? String(values.cjOrderId).slice(0, 200) : null)
    .input("CjOrderCode", sql.NVarChar(200), values.cjOrderCode ? String(values.cjOrderCode).slice(0, 200) : null)
    .input("CjStatus", sql.NVarChar(50), values.cjStatus ? String(values.cjStatus).slice(0, 50) : null)
    .input("CjTrackingNumber", sql.NVarChar(200), values.trackingNumber ? String(values.trackingNumber).slice(0, 200) : null)
    .input("CjCarrier", sql.NVarChar(200), values.carrier ? String(values.carrier).slice(0, 200) : null)
    .input("SubmissionStatus", sql.NVarChar(30), String(values.submissionStatus || "Pending").slice(0, 30))
    .input("LastError", sql.NVarChar(600), values.lastError ? String(values.lastError).slice(0, 600) : null)
    .input("SubmittedAt", sql.DateTime2, values.submittedAt ? new Date(values.submittedAt) : null)
    .input("LastSyncedAt", sql.DateTime2, values.lastSyncedAt ? new Date(values.lastSyncedAt) : null)
    .query(`
      MERGE [Commerce].[CjFulfillmentOrders] AS target
      USING (SELECT @OrderId AS OrderId, @UserId AS UserId) AS source
      ON target.OrderId = source.OrderId AND target.UserId = source.UserId
      WHEN MATCHED THEN UPDATE SET
        CjOrderId = COALESCE(@CjOrderId, target.CjOrderId),
        CjOrderCode = COALESCE(@CjOrderCode, target.CjOrderCode),
        CjStatus = COALESCE(@CjStatus, target.CjStatus),
        CjTrackingNumber = COALESCE(@CjTrackingNumber, target.CjTrackingNumber),
        CjCarrier = COALESCE(@CjCarrier, target.CjCarrier),
        SubmissionStatus = @SubmissionStatus,
        LastError = @LastError,
        SubmittedAt = COALESCE(@SubmittedAt, target.SubmittedAt),
        LastSyncedAt = COALESCE(@LastSyncedAt, target.LastSyncedAt),
        UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (OrderId, UserId, CjOrderId, CjOrderCode, CjStatus, CjTrackingNumber, CjCarrier, SubmissionStatus, LastError, SubmittedAt, LastSyncedAt)
      VALUES
        (@OrderId, @UserId, @CjOrderId, @CjOrderCode, @CjStatus, @CjTrackingNumber, @CjCarrier, @SubmissionStatus, @LastError, @SubmittedAt, @LastSyncedAt);
    `);
  return true;
}

function hideSupplierBranding(value, fallback = "") {
  const cleaned = String(value ?? "")
    .replace(/\bcj\s*dropshipping\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || fallback;
}

function cjOrderEvent(detail, stage) {
  const status = String(detail?.subStatus || detail?.orderStatus || stage).trim();
  const carrier = hideSupplierBranding(detail?.trackingProvider || detail?.logisticName, "Shipping carrier");
  return {
    status: stage,
    title: stage,
    description: `${carrier} status: ${status}.`,
    location: String(detail?.shippingCountryCode || "").trim() || null,
    eventAt: detail?.outWarehouseTime || detail?.paymentDate || detail?.createDate || new Date().toISOString(),
  };
}

async function applyCjOrderDetail(pool, userId, order, fulfillment, detail) {
  const rawStatus = detail?.subStatus || detail?.orderStatus || fulfillment?.CjStatus || null;
  const cjStage = stageFromCjStatus(rawStatus, order.status);
  const currentProgress = getTrackingProgress(order.status);
  const cjProgress = getTrackingProgress(cjStage);
  const stage = cjProgress >= currentProgress ? cjStage : order.status;
  const trackingNumber = String(detail?.trackNumber || fulfillment?.CjTrackingNumber || order.trackingNumber || "").trim() || null;
  const carrier = hideSupplierBranding(detail?.trackingProvider || detail?.logisticName || fulfillment?.CjCarrier || order.carrier, null);
  const event = cjOrderEvent(detail, stage);
  const eventDate = new Date(event.eventAt);
  const eventAt = Number.isNaN(eventDate.getTime()) ? null : eventDate.toISOString();
  const updatedOrder = {
    ...order,
    status: stage,
    trackingNumber,
    carrier,
    currentLocation: String(detail?.shippingCountryCode || order.currentLocation || "").trim() || null,
    shippedAt: cjProgress >= 2 ? (order.shippedAt || eventAt) : order.shippedAt,
    deliveredAt: cjProgress === 5 ? (order.deliveredAt || eventAt) : order.deliveredAt,
  };
  const changed = updatedOrder.status !== order.status
    || updatedOrder.trackingNumber !== order.trackingNumber
    || updatedOrder.carrier !== order.carrier
    || updatedOrder.currentLocation !== order.currentLocation
    || updatedOrder.shippedAt !== order.shippedAt
    || updatedOrder.deliveredAt !== order.deliveredAt;
  if (changed) await saveOrder(pool, userId, updatedOrder);
  if (changed) {
    await queueOrderStatusEvent({
      pool,
      userId,
      order: updatedOrder,
      status: trackingNumber && !order.trackingNumber ? "tracking created" : stage,
      eventAt,
    }).catch((error) => console.warn("Unable to schedule order status email:", error?.message || error));
  }
  if (cjProgress >= currentProgress) await insertTrackingEvent(pool, userId, order.id, event);

  const priorSubmissionStatus = String(fulfillment?.SubmissionStatus || fulfillment?.submissionStatus || "").trim();
  const nextFulfillment = {
    cjOrderId: detail?.orderId || fulfillment?.CjOrderId,
    cjOrderCode: detail?.cjOrderCode || fulfillment?.CjOrderCode,
    cjStatus: rawStatus,
    trackingNumber,
    carrier,
    submissionStatus: detail?.orderStatus === "CANCELLED"
      ? "Cancelled"
      : priorSubmissionStatus.toLowerCase() === "paid" ? "Paid" : "Submitted",
    lastSyncedAt: new Date().toISOString(),
  };
  await upsertCjFulfillment(pool, userId, order.id, nextFulfillment);
  return { order: updatedOrder, fulfillment: nextFulfillment };
}

async function submitCjOrderForFulfillment(pool, userId, order) {
  const lockKey = `${String(userId)}:${String(order?.id || "")}`;
  const previous = cjFulfillmentLocks.get(lockKey) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  cjFulfillmentLocks.set(lockKey, queued);
  await previous;
  try {
    return await submitCjOrderForFulfillmentUnlocked(pool, userId, order);
  } finally {
    release();
    if (cjFulfillmentLocks.get(lockKey) === queued) cjFulfillmentLocks.delete(lockKey);
  }
}

async function submitCjOrderForFulfillmentUnlocked(pool, userId, order) {
  if (!cjFulfillmentEnabled()) return { order, fulfillment: { enabled: false } };
  if (!(await ensureCjFulfillmentTable(pool))) throw new Error("CJ fulfillment migration is required");
  const existing = await loadCjFulfillment(pool, userId, order.id);
  if (existing?.CjOrderId && !cjAutoPayEnabled()) {
    return { order, fulfillment: { enabled: true, submitted: true, cjOrderId: existing.CjOrderId, idempotent: true } };
  }

  // If create succeeded but a live balance debit failed, retry against the
  // same CJ order instead of creating a duplicate supplier order.
  if (existing?.CjOrderId && cjAutoPayEnabled()) {
    const paid = await ensureLiveCjOrderPaid(pool, userId, order, existing);
    return { order: paid.order, fulfillment: { enabled: true, submitted: true, paid: true, cjOrderId: existing.CjOrderId, idempotent: true } };
  }

  await upsertCjFulfillment(pool, userId, order.id, { submissionStatus: "Submitting", lastSyncedAt: new Date().toISOString() });
  const created = await createCjOrder(await buildCjOrderPayload(pool, order));
  const initial = {
    cjOrderId: created.orderId,
    cjOrderCode: created.orderCode,
    submissionStatus: "Submitted",
    submittedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };
  await upsertCjFulfillment(pool, userId, order.id, initial);

  let updatedOrder = order;
  try {
    const detail = await fetchCjOrderDetail(created.orderId);
    if (detail) {
      const applied = await applyCjOrderDetail(pool, userId, order, initial, detail);
      updatedOrder = applied.order;
    }
  } catch (error) {
    console.warn("CJ created order; initial status lookup failed", error?.name || "unknown_error");
  }

  if (cjAutoPayEnabled()) {
    const paid = await ensureLiveCjOrderPaid(pool, userId, updatedOrder, {
      ...initial,
      CjOrderId: created.orderId,
      CjOrderCode: created.orderCode,
    });
    return {
      order: paid.order,
      fulfillment: {
        enabled: true,
        submitted: true,
        paid: true,
        cjOrderId: created.orderId,
        cjOrderCode: created.orderCode || null,
      },
    };
  }
  return { order: updatedOrder, fulfillment: { enabled: true, submitted: true, cjOrderId: created.orderId, cjOrderCode: created.orderCode || null } };
}

function cjOrderStatus(detail) {
  return String(detail?.orderStatus || detail?.subStatus || "").trim().toUpperCase();
}

function cjOrderHasBeenPaid(detail) {
  const paidStatuses = new Set([
    "PAID", "PENDING", "UNSHIPPED", "PROCESSING", "SHIPPED", "IN_TRANSIT",
    "AWAITING_SHIPMENT", "READY_TO_SHIP",
    "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "FULFILLED",
  ]);
  return [detail?.orderStatus, detail?.subStatus]
    .map((value) => String(value || "").trim().toUpperCase())
    .some((value) => paidStatuses.has(value));
}

async function ensureLiveCjOrderPaid(pool, userId, order, fulfillment) {
  if (!cjAutoPayEnabled()) return { order, fulfillment };
  const cjOrderId = String(fulfillment?.CjOrderId || fulfillment?.cjOrderId || "").trim();
  if (!cjOrderId) throw new Error("CJ did not return an order id for balance payment");

  let detail = await fetchCjOrderDetail(cjOrderId);
  if (!detail) throw new Error("CJ order status could not be verified before balance payment");
  let status = cjOrderStatus(detail);
  if (!cjOrderHasBeenPaid(detail) && ["CREATED", "IN_CART"].includes(status)) {
    await confirmCjOrder(cjOrderId);
    detail = await fetchCjOrderDetail(cjOrderId);
    if (!detail) throw new Error("CJ order status could not be verified after confirmation");
    status = cjOrderStatus(detail);
  }
  if (!cjOrderHasBeenPaid(detail)) {
    // Normal V3 dropshipping orders are charged through payBalance. Keep the
    // call idempotent by only issuing it while CJ still reports an unpaid/new
    // state; a retry after a network timeout re-checks this state first.
    if (!["CREATED", "IN_CART", "UNPAID", ""].includes(status)) {
      throw new Error(`CJ order is not ready for balance payment (status: ${status})`);
    }
    await payCjOrderBalance(cjOrderId);
    await upsertCjFulfillment(pool, userId, order.id, {
      cjOrderId,
      cjOrderCode: fulfillment?.CjOrderCode || fulfillment?.cjOrderCode,
      submissionStatus: "Paid",
      lastError: null,
      lastSyncedAt: new Date().toISOString(),
    });
    detail = await fetchCjOrderDetail(cjOrderId);
  } else {
    await upsertCjFulfillment(pool, userId, order.id, {
      cjOrderId,
      submissionStatus: "Paid",
      lastError: null,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  const currentFulfillment = await loadCjFulfillment(pool, userId, order.id) || fulfillment;
  if (detail) {
    const applied = await applyCjOrderDetail(pool, userId, order, currentFulfillment, detail);
    return { order: applied.order, fulfillment: applied.fulfillment };
  }
  return { order, fulfillment: currentFulfillment };
}

function cjSubmissionFailureMessage(error) {
  const normalizedProviderMessage = String(error?.providerMessage || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  const code = error?.code === undefined || error?.code === null || String(error.code).trim() === ""
    ? ""
    : ` CJ code ${String(error.code).trim().slice(0, 60)}.`;
  const requestId = String(error?.requestId || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100);
  const request = requestId ? ` CJ request ID ${requestId}.` : "";
  const reason = normalizedProviderMessage || (error?.name === "CjTrackingError"
    ? "CJ did not provide a rejection message."
    : String(error?.message || "Unable to submit the CJ order.").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 400));
  return `CJ submission failed: ${reason}.${code}${request}`.replace(/\.\./g, ".").slice(0, 600);
}

function ownerOrderItemsSummary(order) {
  return (Array.isArray(order?.items) ? order.items : [])
    .map((item) => `${String(item?.title || "Item").slice(0, 160)} × ${Number(item?.quantity) || 1}`)
    .join("\n") || "No item details available";
}

async function notifyOwnerOrderPaid(order, payment, fulfillment = null) {
  try {
    const result = await sendOwnerNotificationEmail({
      subject: `[${configuredStoreName()}] Website payment received — ${String(order?.id || "order")}`,
      title: "Website payment received",
      text: "A customer payment was confirmed and the storefront order was created.",
      details: [
        { label: "Store order", value: order?.id || "Unknown" },
        { label: "Customer email", value: order?.shippingAddress?.email || payment?.customerEmail || "Unknown" },
        { label: "Amount", value: `${payment?.currency || "USD"} ${Number(order?.total || payment?.amount || 0).toFixed(2)}` },
        { label: "Payment ID", value: payment?.id || "Unknown" },
        { label: "CJ submission", value: fulfillment?.submitted ? (fulfillment?.paid ? "Submitted and paid" : "Submitted; payment not enabled") : "Not submitted" },
        { label: "Items", value: ownerOrderItemsSummary(order) },
      ],
    });
    if (result?.skipped) console.warn("Owner payment notification skipped", result.reason);
  } catch (error) {
    console.warn("Owner payment notification failed", error?.message || error);
  }
}

async function notifyOwnerCjFailure(order, error, context = "CJ order submission") {
  try {
    const result = await sendOwnerNotificationEmail({
      subject: `[${configuredStoreName()}] CJ fulfillment problem — ${String(order?.id || "order")}`,
      title: "CJ fulfillment problem",
      text: `${context} needs attention. The customer order remains recorded; retry after correcting the CJ account or API issue.`,
      details: [
        { label: "Store order", value: order?.id || "Unknown" },
        { label: "Customer email", value: order?.shippingAddress?.email || "Unknown" },
        { label: "CJ error", value: cjSubmissionFailureMessage(error) },
        { label: "Sandbox mode", value: cjSandboxModeConfigured() ? "true" : "false" },
        { label: "Items", value: ownerOrderItemsSummary(order) },
      ],
    });
    if (result?.skipped) console.warn("Owner CJ failure notification skipped", result.reason);
  } catch (notificationError) {
    console.warn("Owner CJ failure notification failed", notificationError?.message || notificationError);
  }
}

async function markCjFulfillmentFailed(pool, userId, orderId, error = null) {
  await upsertCjFulfillment(pool, userId, orderId, {
    submissionStatus: "Failed",
    lastError: cjSubmissionFailureMessage(error),
    lastSyncedAt: new Date().toISOString(),
  });
}
function checkoutCurrency() {
  const value = String(process.env.CHECKOUT_CURRENCY || "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : "USD";
}

function normalizeShippingServiceName(value) {
  const name = String(value || "").trim();
  return name && name.length <= 200 && !/[\u0000-\u001f\u007f]/.test(name) ? name : "";
}

function customerShippingServiceLabel(value) {
  return String(value || "")
    .replace(/\bcj\s*dropshipping\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || "Shipping service";
}

async function loadCjFreightProducts(pool, cart) {
  if (!(await ensureCjImportsTable(pool))) throw new Error("Product shipping mappings are unavailable");
  const productIds = [...new Set((cart || []).map((item) => Number(item.productId)).filter(Number.isSafeInteger))];
  if (!productIds.length || (cart || []).some((item) => !Number.isSafeInteger(Number(item.productId)))) {
    throw new Error("Every cart item must be linked to an imported catalog product");
  }

  const request = pool.request();
  const parameters = productIds.map((productId, index) => {
    const name = `ProductId${index}`;
    request.input(name, sql.Int, productId);
    return `@${name}`;
  });
  const result = await request.query(`
    SELECT ProductId, Pid, RawJson
    FROM [Integration].[CjImportMappings]
    WHERE ProductId IN (${parameters.join(", ")})
  `);
  const mappings = new Map(normalizeResult(result).map((row) => [Number(row.ProductId), {
    lookup: String(row.Pid || "").trim(),
    rawJson: row.RawJson || null,
  }]));

  return Promise.all(cart.map(async (item) => {
    const mapping = mappings.get(Number(item.productId));
    if (!mapping?.lookup) throw new Error(`${item.title || "A cart item"} is not linked to a shipping catalog variant`);
    const identifiers = extractCjShippingIdentifiers(mapping.rawJson, mapping.lookup);
    const variant = identifiers.vid
      ? { vid: identifiers.vid }
      : await resolveCjVariantId({ lookup: mapping.lookup, storefrontSku: item.sku, productSku: identifiers.productSku });
    return {
      vid: variant.vid,
      quantity: parseBoundedInteger(item.quantity, { min: 1, max: MAX_CART_QUANTITY }) || 1,
    };
  }));
}

async function quoteCjShippingForCart(pool, cart, shipping = {}) {
  if (!cjTrackingConfigured()) throw new Error("Live shipping quotes are not configured");
  const startCountryCode = String(process.env.CJ_FROM_COUNTRY_CODE || "").trim().toUpperCase();
  const endCountryCode = cjCountryCode(shipping.country);
  if (!/^[A-Z]{2}$/.test(startCountryCode)) throw new Error("The shipping origin is not configured");
  if (!endCountryCode) throw new Error("Choose a supported delivery country");
  const products = await loadCjFreightProducts(pool, cart);
  const estimates = await calculateCjFreight({
    startCountryCode,
    endCountryCode,
    zip: shipping.postalCode,
    products,
  });
  return estimates.map((option) => ({
    ...option,
    label: customerShippingServiceLabel(option.label || option.logisticName),
    fromCountryCode: startCountryCode,
  }));
}

function selectCjShippingOption(estimates, requestedName) {
  const normalized = normalizeShippingServiceName(requestedName).toLowerCase();
  return (estimates || []).find((option) => option.logisticName.toLowerCase() === normalized) || null;
}

function shippingDeliveryDays(windowValue) {
  const days = String(windowValue || "").match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
  return days.length ? Math.max(...days) : 8;
}

function checkoutDetailText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeCheckoutDetails(value, customerEmail, shippingMethod) {
  const information = value?.information || value?.customer || {};
  const shipping = value?.shipping || value?.shippingAddress || {};
  const details = {
    information: {
      email: customerEmail,
      phone: checkoutDetailText(information.phone, 40),
      subscribe: information.subscribe === true,
    },
    shipping: {
      fullName: checkoutDetailText(shipping.fullName, 200),
      addressLine1: checkoutDetailText(shipping.addressLine1, 255),
      addressLine2: checkoutDetailText(shipping.addressLine2, 255),
      city: checkoutDetailText(shipping.city, 120),
      region: checkoutDetailText(shipping.region, 120),
      postalCode: checkoutDetailText(shipping.postalCode, 30),
      country: checkoutDetailText(shipping.country, 2).toUpperCase(),
      method: shippingMethod,
      logisticName: normalizeShippingServiceName(shipping.logisticName || shippingMethod),
      label: checkoutDetailText(shipping.label || shipping.logisticName || shippingMethod, 200),
      window: checkoutDetailText(shipping.window, 120),
      cost: Number.isFinite(Number(shipping.cost)) ? roundCurrency(Math.max(0, Number(shipping.cost))) : null,
      fromCountryCode: checkoutDetailText(shipping.fromCountryCode, 2).toUpperCase(),
    },
  };
  const required = [
    details.information.phone,
    details.shipping.fullName,
    details.shipping.addressLine1,
    details.shipping.city,
    details.shipping.region,
    details.shipping.postalCode,
    details.shipping.country,
  ];
  return required.every(Boolean) ? details : null;
}

function parseCheckoutDetails(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function checkoutNameParts(fullName) {
  const parts = checkoutDetailText(fullName, 240).split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "Customer";
  return {
    firstName,
    lastName: parts.join(" ") || firstName,
  };
}

// Checkout details are kept on the authenticated account, never keyed only by
// an email address. That lets a returning customer safely prefill a later order
// without exposing a guest's details to somebody who enters the same email.
async function saveCheckoutDetailsForCustomer(pool, user, checkoutDetails) {
  const userId = Number(user?.id);
  if (!Number.isSafeInteger(userId) || !checkoutDetails) return;

  await ensureCustomerAccountTables(pool);
  const information = checkoutDetails.information || {};
  const shipping = checkoutDetails.shipping || {};
  const { firstName, lastName } = checkoutNameParts(shipping.fullName);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("Phone", sql.NVarChar(40), checkoutDetailText(information.phone, 40) || null)
      .input("EmailMarketing", sql.Bit, information.subscribe === true)
      .query(`
        UPDATE dbo.CustomerAccountProfile
        SET Phone = @Phone, EmailMarketing = @EmailMarketing, UpdatedAt = SYSUTCDATETIME()
        WHERE UserID = @UserId;
        IF @@ROWCOUNT = 0
          INSERT INTO dbo.CustomerAccountProfile (UserID, Phone, EmailMarketing)
          VALUES (@UserId, @Phone, @EmailMarketing);
      `);

    const existingResult = await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .query(`
        SELECT TOP 1 Id
        FROM dbo.CustomerAccountAddresses WITH (UPDLOCK, HOLDLOCK)
        WHERE UserID = @UserId AND AddressType = N'shipping'
        ORDER BY IsDefault DESC, UpdatedAt DESC, CreatedAt DESC;
      `);
    const addressId = normalizeResult(existingResult)[0]?.Id || null;

    await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .query("UPDATE dbo.CustomerAccountAddresses SET IsDefault = 0 WHERE UserID = @UserId AND AddressType = N'shipping'");

    const addressRequest = new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("FirstName", sql.NVarChar(120), firstName)
      .input("LastName", sql.NVarChar(120), lastName)
      .input("Phone", sql.NVarChar(40), checkoutDetailText(information.phone, 40) || null)
      .input("AddressLine1", sql.NVarChar(255), checkoutDetailText(shipping.addressLine1, 255))
      .input("AddressLine2", sql.NVarChar(255), checkoutDetailText(shipping.addressLine2, 255) || null)
      .input("City", sql.NVarChar(120), checkoutDetailText(shipping.city, 120))
      .input("StateProvince", sql.NVarChar(120), checkoutDetailText(shipping.region, 120) || null)
      .input("PostalCode", sql.NVarChar(30), checkoutDetailText(shipping.postalCode, 30))
      .input("Country", sql.NVarChar(100), checkoutDetailText(shipping.country, 2).toUpperCase());

    if (addressId) {
      await addressRequest
        .input("AddressId", sql.UniqueIdentifier, addressId)
        .query(`
          UPDATE dbo.CustomerAccountAddresses
          SET FirstName = @FirstName, LastName = @LastName, Phone = @Phone,
              AddressLine1 = @AddressLine1, AddressLine2 = @AddressLine2,
              City = @City, StateProvince = @StateProvince, PostalCode = @PostalCode,
              Country = @Country, IsDefault = 1, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @AddressId AND UserID = @UserId;
        `);
    } else {
      await addressRequest.query(`
        INSERT INTO dbo.CustomerAccountAddresses
          (UserID, AddressType, Label, FirstName, LastName, Phone, AddressLine1, AddressLine2, City, StateProvince, PostalCode, Country, IsDefault)
        VALUES
          (@UserId, N'shipping', N'Default shipping address', @FirstName, @LastName, @Phone, @AddressLine1, @AddressLine2, @City, @StateProvince, @PostalCode, @Country, 1);
      `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function refreshCartForCheckout(pool, userId) {
  const cart = await getCartForUser(userId, pool);
  if (!cart.length) return { cart, missing: [] };

  let products = await loadProductsByIds(pool, cart.map((item) => item.productId));
  const missing = [...new Set(cart
    .filter((item) => !products.has(Number(item.productId)))
    .map((item) => String(item.productId)))];
  if (missing.length) return { cart, missing };

  const productsNeedingInventoryMapping = [...products.entries()]
    .filter(([, product]) => !product?.canonicalProductId || !product?.variantId);
  for (const [productId, product] of productsNeedingInventoryMapping) {
    await ensureCanonicalProductForLegacy(pool, productId, {
      name: product.name,
      description: product.description,
      brand: product.brand,
      alt: product.alt,
      buyPrice: product.buyPrice,
      salePrice: product.salePrice ?? product.price,
      stock: product.stock,
      currency: product.currency,
      sku: product.sku,
    }, product.img ? [product.img] : []);
  }
  if (productsNeedingInventoryMapping.length) {
    products = await loadProductsByIds(pool, cart.map((item) => item.productId));
  }

  const refreshed = cart.map((item) => {
    const product = products.get(Number(item.productId));
    return {
      ...item,
      title: product.name || item.title,
      sku: product.sku || item.sku,
      price: Number(product.salePrice ?? product.price) || 0,
      buyPrice: product.buyPrice ?? item.buyPrice ?? item.unitCost ?? null,
      unitCost: product.buyPrice ?? item.unitCost ?? null,
      image: product.img || item.image || null,
    };
  });
  await replaceCartForUser(pool, userId, refreshed);
  return { cart: refreshed, missing: [] };
}

async function createDurableCheckout(pool, details) {
  const checkoutId = crypto.randomUUID();
  const providerExpiresAt = new Date(Date.now() + 35 * 60 * 1000);
  const expiresAt = new Date(Date.now() + 40 * 60 * 1000);
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    await new sql.Request(transaction)
      .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
      .input("UserKey", sql.NVarChar(128), String(details.userId))
      .input("CartJson", sql.NVarChar(sql.MAX), JSON.stringify(details.cart))
      .input("Currency", sql.Char(3), details.currency)
      .input("Subtotal", sql.Decimal(19, 4), details.subtotal)
      .input("Discount", sql.Decimal(19, 4), details.discountAmount)
      .input("Shipping", sql.Decimal(19, 4), details.shippingAmount)
      .input("Total", sql.Decimal(19, 4), details.amount)
      .input("CouponCode", sql.NVarChar(64), details.couponCode || null)
      .input("ShippingMethod", sql.NVarChar(200), details.shippingMethod)
      .input("CustomerEmail", sql.NVarChar(255), details.customerEmail)
      .input("CheckoutDetails", sql.NVarChar(sql.MAX), JSON.stringify(details.checkoutDetails))
      .input("ExpiresAt", sql.DateTime2, expiresAt)
      .query(`
        INSERT INTO [Commerce].[SecureCheckoutSessions]
          ([id], [user_key], [cart_json], [currency], [subtotal_amount], [discount_amount], [shipping_amount], [total_amount], [coupon_code], [shipping_method], [customer_email], [checkout_details_json], [expires_at])
        VALUES
          (@CheckoutId, @UserKey, @CartJson, @Currency, @Subtotal, @Discount, @Shipping, @Total, @CouponCode, @ShippingMethod, @CustomerEmail, @CheckoutDetails, @ExpiresAt);
      `);

    for (const item of details.cart) {
      const quantity = parseBoundedInteger(item.quantity, { min: 1, max: MAX_CART_QUANTITY });
      if (quantity == null) throw Object.assign(new Error("Invalid reservation quantity"), { number: 50003 });
      await new sql.Request(transaction)
        .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
        .input("LegacyProductId", sql.Int, Number(item.productId))
        .input("Quantity", sql.Decimal(19, 4), quantity)
        .input("ExpiresAt", sql.DateTime2, expiresAt)
        .query(`
          DECLARE @VariantId UNIQUEIDENTIFIER;
          DECLARE @MappedProductId UNIQUEIDENTIFIER = NULL;
          IF OBJECT_ID(N'[Commerce].[LegacyProductInventoryMappings]', N'U') IS NOT NULL
          BEGIN
            SELECT @MappedProductId = [ProductId]
            FROM [Commerce].[LegacyProductInventoryMappings] WITH (UPDLOCK, HOLDLOCK)
            WHERE [LegacyProductId] = @LegacyProductId;
          END;

          IF @MappedProductId IS NOT NULL
          BEGIN
            SELECT TOP 1 @VariantId = v.[Id]
            FROM [Commerce].[Products] p WITH (HOLDLOCK)
            INNER JOIN [Commerce].[ProductVariants] v WITH (UPDLOCK, HOLDLOCK) ON v.[Id] = p.[DefaultVariantId]
            WHERE p.[Id] = @MappedProductId AND p.[Status] = N'Active' AND v.[Status] = N'Active';
          END
          ELSE
          BEGIN
            SELECT TOP 1 @VariantId = v.[Id]
            FROM [Commerce].[Products] p WITH (HOLDLOCK)
            INNER JOIN [Commerce].[ProductVariants] v WITH (UPDLOCK, HOLDLOCK) ON v.[Id] = p.[DefaultVariantId]
            WHERE p.[LegacyProductId] = @LegacyProductId AND p.[Status] = N'Active' AND v.[Status] = N'Active';
          END;
          IF @VariantId IS NULL THROW 50001, 'Product inventory mapping is unavailable', 1;

          DECLARE @ExpiredQuantity DECIMAL(19,4) = 0;
          SELECT @ExpiredQuantity = COALESCE(SUM([quantity]), 0)
          FROM [Commerce].[InventoryReservations] WITH (UPDLOCK, HOLDLOCK)
          WHERE [variant_id] = @VariantId AND [reservation_status] = N'Active' AND [expires_at] <= SYSUTCDATETIME();
          IF @ExpiredQuantity > 0
          BEGIN
            UPDATE [Commerce].[InventoryReservations]
            SET [reservation_status] = N'Expired', [updated_at] = SYSUTCDATETIME()
            WHERE [variant_id] = @VariantId AND [reservation_status] = N'Active' AND [expires_at] <= SYSUTCDATETIME();
            UPDATE [Commerce].[ProductVariants]
            SET [AvailableQuantity] = [AvailableQuantity] + @ExpiredQuantity, [UpdatedAt] = SYSUTCDATETIME()
            WHERE [Id] = @VariantId;
          END;

          UPDATE [Commerce].[ProductVariants] WITH (UPDLOCK, ROWLOCK)
          SET [AvailableQuantity] = [AvailableQuantity] - @Quantity, [UpdatedAt] = SYSUTCDATETIME()
          WHERE [Id] = @VariantId AND [AvailableQuantity] >= @Quantity;
          IF @@ROWCOUNT <> 1 THROW 50002, 'Insufficient inventory', 1;

          INSERT INTO [Commerce].[InventoryReservations]
            ([checkout_id], [variant_id], [legacy_product_id], [quantity], [expires_at])
          VALUES (@CheckoutId, @VariantId, @LegacyProductId, @Quantity, @ExpiresAt);
        `);
    }
    await transaction.commit();
    return { id: checkoutId, expiresAt, providerExpiresAt };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function releaseDurableCheckout(pool, checkoutId, status = "Failed") {
  await pool.request()
    .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
    .input("Status", sql.NVarChar(30), status)
    .query(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      UPDATE variants WITH (UPDLOCK, ROWLOCK)
      SET variants.[AvailableQuantity] = variants.[AvailableQuantity] + reservations.[quantity], variants.[UpdatedAt] = SYSUTCDATETIME()
      FROM [Commerce].[ProductVariants] variants
      INNER JOIN [Commerce].[InventoryReservations] reservations ON reservations.[variant_id] = variants.[Id]
      WHERE reservations.[checkout_id] = @CheckoutId AND reservations.[reservation_status] = N'Active';
      UPDATE [Commerce].[InventoryReservations]
      SET [reservation_status] = N'Released', [updated_at] = SYSUTCDATETIME()
      WHERE [checkout_id] = @CheckoutId AND [reservation_status] = N'Active';
      UPDATE [Commerce].[SecureCheckoutSessions]
      SET [checkout_status] = @Status, [updated_at] = SYSUTCDATETIME()
      WHERE [id] = @CheckoutId AND [payment_status] <> N'Paid';
      COMMIT TRANSACTION;
    `);
}

async function activateDurableCheckout(pool, checkoutId, providerSessionId) {
  await pool.request()
    .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
    .input("ProviderSessionId", sql.NVarChar(255), providerSessionId)
    .query(`
      UPDATE [Commerce].[SecureCheckoutSessions]
      SET [provider_session_id] = @ProviderSessionId, [checkout_status] = N'AwaitingPayment', [updated_at] = SYSUTCDATETIME()
      WHERE [id] = @CheckoutId AND [checkout_status] = N'Reserving';
      IF @@ROWCOUNT <> 1 THROW 50004, 'Checkout activation failed', 1;
    `);
}

async function loadDurableCheckout(pool, userId, providerSessionId) {
  const result = await pool.request()
    .input("UserKey", sql.NVarChar(128), String(userId))
    .input("ProviderSessionId", sql.NVarChar(255), providerSessionId)
    .query("SELECT TOP 1 * FROM [Commerce].[SecureCheckoutSessions] WHERE [user_key] = @UserKey AND [provider_session_id] = @ProviderSessionId");
  return normalizeResult(result)[0] || null;
}

async function markDurableCheckoutPaid(pool, checkoutId) {
  await pool.request().input("CheckoutId", sql.UniqueIdentifier, checkoutId).query(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    UPDATE [Commerce].[SecureCheckoutSessions]
    SET [checkout_status] = N'Paid', [payment_status] = N'Paid', [paid_at] = COALESCE([paid_at], SYSUTCDATETIME()), [updated_at] = SYSUTCDATETIME()
    WHERE [id] = @CheckoutId;
    UPDATE [Commerce].[InventoryReservations]
    SET [reservation_status] = N'Consumed', [updated_at] = SYSUTCDATETIME()
    WHERE [checkout_id] = @CheckoutId AND [reservation_status] = N'Active';
    COMMIT TRANSACTION;
  `);
}

async function claimDurableCheckoutForOrder(pool, checkoutId) {
  const result = await pool.request().input("CheckoutId", sql.UniqueIdentifier, checkoutId).query(`
    UPDATE [Commerce].[SecureCheckoutSessions] WITH (UPDLOCK, ROWLOCK)
    SET [checkout_status] = N'CreatingOrder', [updated_at] = SYSUTCDATETIME()
    OUTPUT INSERTED.[id]
    WHERE [id] = @CheckoutId AND [payment_status] = N'Paid' AND [checkout_status] = N'Paid' AND [order_id] IS NULL;
  `);
  return Boolean(normalizeResult(result).length);
}

async function finishDurableCheckoutOrder(pool, checkoutId, orderId) {
  await pool.request()
    .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
    .input("OrderId", sql.NVarChar(64), orderId)
    .query(`
      UPDATE [Commerce].[SecureCheckoutSessions]
      SET [checkout_status] = N'Completed', [order_id] = @OrderId, [updated_at] = SYSUTCDATETIME()
      WHERE [id] = @CheckoutId AND [checkout_status] = N'CreatingOrder';
    `);
}

async function releaseDurableOrderClaim(pool, checkoutId) {
  await pool.request().input("CheckoutId", sql.UniqueIdentifier, checkoutId).query(`
    UPDATE [Commerce].[SecureCheckoutSessions]
    SET [checkout_status] = N'Paid', [updated_at] = SYSUTCDATETIME()
    WHERE [id] = @CheckoutId AND [checkout_status] = N'CreatingOrder' AND [order_id] IS NULL;
  `);
}

async function getProductImagesById(pool, productId) {
  const ensured = await ensureProductImagesTable(pool);
  if (!ensured) return [];
  try {
    const result = await pool
      .request()
      .input("ProductId", sql.Int, productId)
      .query(`
        SELECT ImagePath
        FROM ${productImagesTableName}
        WHERE ProductId = @ProductId
        ORDER BY ImageId ASC
      `);
    const rows = normalizeResult(result);
    return rows
      .map((row) => row.ImagePath ?? row.imagePath ?? row.path ?? "")
      .filter((path) => typeof path === "string" && path.length > 0);
  } catch (err) {
    console.error("Unable to load product images for id", productId, err);
    return [];
  }
}

async function loadProductImages(pool) {
  const ensured = await ensureProductImagesTable(pool);
  if (!ensured) return new Map();
  try {
    const result = await pool
      .request()
      .query(`SELECT ProductId, ImagePath FROM ${productImagesTableName} ORDER BY ImageId ASC`);
    const rows = normalizeResult(result);
    const map = new Map();
    rows.forEach((row) => {
      const productId = Number(row.ProductId ?? row.productId ?? row.PID);
      const pathValue = row.ImagePath ?? row.imagePath ?? row.path ?? "";
      if (!Number.isFinite(productId) || typeof pathValue !== "string" || pathValue.length === 0) return;
      if (!map.has(productId)) map.set(productId, []);
      map.get(productId).push(pathValue);
    });
    return map;
  } catch (err) {
    console.error("Unable to load product images:", err);
    return new Map();
  }
}

async function saveProductImages(pool, productId, imagePaths = []) {
  const ensured = await ensureProductImagesTable(pool);
  if (!ensured) return;
  try {
    await pool.request().input("ProductId", sql.Int, productId).query(`DELETE FROM ${productImagesTableName} WHERE ProductId = @ProductId`);
    for (const imagePath of imagePaths) {
      if (typeof imagePath !== "string" || imagePath.length === 0) continue;
      await pool
        .request()
        .input("ProductId", sql.Int, productId)
        .input("ImagePath", sql.NVarChar, imagePath)
        .query(`INSERT INTO ${productImagesTableName} (ProductId, ImagePath) VALUES (@ProductId, @ImagePath)`);
    }
  } catch (err) {
    console.error("Unable to save product images:", err);
  }
}

async function saveCanonicalOrderSnapshot(pool, userId, order) {
  try {
    const schemaResult = await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID(N'[Commerce].[Orders]', N'U') IS NOT NULL
                       AND OBJECT_ID(N'[Commerce].[OrderItems]', N'U') IS NOT NULL
                       AND OBJECT_ID(N'[Commerce].[Products]', N'U') IS NOT NULL
                       AND OBJECT_ID(N'[Commerce].[ProductVariants]', N'U') IS NOT NULL
                       AND OBJECT_ID(N'[CRM].[Customers]', N'U') IS NOT NULL
                  THEN 1 ELSE 0 END AS [Ready];
    `);
    if (normalizeResult(schemaResult)[0]?.Ready !== 1) return false;

    const shipping = order.shippingAddress || {};
    const customerEmail = String(shipping.email || `guest-${String(userId).replace(/[^a-z0-9]/gi, "") || "customer"}@store.local`)
      .trim()
      .slice(0, 255);
    const customerResult = await pool.request()
      .input("LegacyUserId", sql.NVarChar(50), String(userId))
      .input("Email", sql.NVarChar(255), customerEmail)
      .query(`
        SELECT TOP 1 [Id]
        FROM [CRM].[Customers]
        WHERE [LegacyUserId] = TRY_CONVERT(INT, @LegacyUserId) OR [Email] = @Email;
      `);
    const customerId = normalizeResult(customerResult)[0]?.Id || null;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const subtotal = Math.max(0, Number(order.subtotal ?? (Number(order.total) || 0) - (Number(order.shippingAmount) || 0)) || 0);
      const discountAmount = Math.min(subtotal, Math.max(0, Number(order.discountAmount) || 0));
      const shippingAmount = Math.max(0, Number(order.shippingAmount) || 0);
      const total = Math.max(0, Number(order.total) || 0);
      const paymentStatus = String(order.paymentStatus || "pending").toLowerCase() === "paid" ? "Paid" : "Pending";
      const orderStatus = String(order.status || "Processing").slice(0, 40) || "Processing";
      const fulfillmentStatus = canonicalFulfillmentStatus(orderStatus) || "Unfulfilled";

      const mergeResult = await new sql.Request(transaction)
        .input("LegacyOrderId", sql.NVarChar(64), String(order.id))
        .input("OrderNumber", sql.NVarChar(50), String(order.id).slice(0, 50))
        .input("CustomerId", sql.UniqueIdentifier, customerId)
        .input("Currency", sql.Char(3), String(order.currency || "USD").toUpperCase().slice(0, 3))
        .input("OrderStatus", sql.NVarChar(40), orderStatus)
        .input("FulfillmentStatus", sql.NVarChar(40), fulfillmentStatus)
        .input("PaymentStatus", sql.NVarChar(40), paymentStatus)
        .input("SubtotalAmount", sql.Decimal(19, 4), subtotal)
        .input("DiscountAmount", sql.Decimal(19, 4), discountAmount)
        .input("ShippingAmount", sql.Decimal(19, 4), shippingAmount)
        .input("TotalAmount", sql.Decimal(19, 4), total)
        .input("CustomerEmail", sql.NVarChar(255), customerEmail)
        .input("CustomerPhone", sql.NVarChar(40), String(shipping.phone || "").slice(0, 40) || null)
        .input("PlacedAt", sql.DateTime2, order.placedAt ? new Date(order.placedAt) : new Date())
        .query(`
          MERGE [Commerce].[Orders] AS target
          USING (SELECT @LegacyOrderId AS [LegacyOrderId]) AS source
          ON target.[LegacyOrderId] = source.[LegacyOrderId]
          WHEN MATCHED THEN UPDATE SET
            [CustomerId] = @CustomerId, [Currency] = @Currency, [OrderStatus] = @OrderStatus,
            [FulfillmentStatus] = @FulfillmentStatus, [PaymentStatus] = @PaymentStatus, [SubtotalAmount] = @SubtotalAmount,
            [DiscountAmount] = @DiscountAmount, [ShippingAmount] = @ShippingAmount, [TotalAmount] = @TotalAmount,
            [CustomerEmail] = @CustomerEmail, [CustomerPhone] = @CustomerPhone,
            [PlacedAt] = @PlacedAt, [PaidAt] = CASE WHEN @PaymentStatus = N'Paid' THEN COALESCE([PaidAt], SYSUTCDATETIME()) ELSE [PaidAt] END,
            [UpdatedAt] = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT
            ([LegacyOrderId], [OrderNumber], [CustomerId], [Currency], [OrderStatus], [PaymentStatus],
             [FulfillmentStatus], [SubtotalAmount], [DiscountAmount], [ShippingAmount], [TotalAmount], [CustomerEmail],
             [CustomerPhone], [SalesChannel], [Source], [PlacedAt], [PaidAt])
          VALUES
            (@LegacyOrderId, @OrderNumber, @CustomerId, @Currency, @OrderStatus, @PaymentStatus,
             @FulfillmentStatus, @SubtotalAmount, @DiscountAmount, @ShippingAmount, @TotalAmount, @CustomerEmail,
             @CustomerPhone, N'OnlineStore', N'legacy-checkout', @PlacedAt,
             CASE WHEN @PaymentStatus = N'Paid' THEN @PlacedAt ELSE NULL END)
          OUTPUT INSERTED.[Id];
        `);
      const orderId = normalizeResult(mergeResult)[0]?.Id;
      if (!orderId) throw new Error("Canonical order id was not returned");

      await new sql.Request(transaction)
        .input("OrderId", sql.UniqueIdentifier, orderId)
        .query("DELETE FROM [Commerce].[OrderItems] WHERE [OrderId] = @OrderId;");

      for (const item of order.items || []) {
        const legacyProductId = Number(item.productId);
        let canonicalProductId = null;
        let variantId = null;
        let canonicalCost = null;
        if (Number.isFinite(legacyProductId)) {
          const productResult = await new sql.Request(transaction)
            .input("LegacyProductId", sql.Int, legacyProductId)
            .query(`
              SELECT TOP 1 p.[Id] AS [ProductId], p.[DefaultVariantId], v.[CostPrice]
              FROM [Commerce].[Products] p
              LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
              WHERE p.[LegacyProductId] = @LegacyProductId;
            `);
          const productRow = normalizeResult(productResult)[0];
          canonicalProductId = productRow?.ProductId || null;
          variantId = productRow?.DefaultVariantId || null;
          canonicalCost = productRow?.CostPrice == null ? null : Number(productRow.CostPrice);
        }

        const quantity = Math.max(0.0001, Number(item.quantity) || 0);
        const unitPrice = Math.max(0, Number(item.price) || 0);
        const itemCost = item.unitCost ?? item.buyPrice ?? canonicalCost;
        const unitCost = itemCost === null || itemCost === undefined || !Number.isFinite(Number(itemCost))
          ? null
          : Math.max(0, Number(itemCost));
        await new sql.Request(transaction)
          .input("OrderId", sql.UniqueIdentifier, orderId)
          .input("ProductId", sql.UniqueIdentifier, canonicalProductId)
          .input("VariantId", sql.UniqueIdentifier, variantId)
          .input("SKU", sql.NVarChar(100), String(item.sku || (Number.isFinite(legacyProductId) ? `LEGACY-${legacyProductId}` : "LEGACY-ITEM")).slice(0, 100))
          .input("ProductName", sql.NVarChar(255), String(item.title || "Product").slice(0, 255))
          .input("Quantity", sql.Decimal(19, 4), quantity)
          .input("UnitPrice", sql.Decimal(19, 4), unitPrice)
          .input("TotalAmount", sql.Decimal(19, 4), unitPrice * quantity)
          .input("UnitCost", sql.Decimal(19, 4), unitCost)
          .query(`
            INSERT INTO [Commerce].[OrderItems]
              ([OrderId], [ProductId], [VariantId], [SKU], [ProductName], [Quantity], [UnitPrice], [TotalAmount], [UnitCost])
            VALUES (@OrderId, @ProductId, @VariantId, @SKU, @ProductName, @Quantity, @UnitPrice, @TotalAmount, @UnitCost);
          `);
      }

      await transaction.commit();
      return true;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.warn("Unable to write canonical accounting order snapshot:", err && err.message ? err.message : err);
    return false;
  }
}

async function deleteProductChildren(request, productId) {
  await request
    .input("ProductId", sql.Int, productId)
    .query(`
      DELETE FROM [Integration].[CjImportMappings] WHERE ProductId = @ProductId;
      DELETE FROM [Commerce].[StorefrontProductAddresses] WHERE ProductId = @ProductId;
      DELETE FROM [Commerce].[StorefrontProductImages] WHERE ProductId = @ProductId;
      IF OBJECT_ID(N'[dbo].[ProductVideos_tbl]', N'U') IS NOT NULL
        DELETE FROM [dbo].[ProductVideos_tbl] WHERE ProductId = @ProductId;
    `);
}

async function getProductAddressById(pool, productId) {
  const ensured = await ensureProductAddressesTable(pool);
  if (!ensured) return "";
  try {
    const result = await pool
      .request()
      .input("ProductId", sql.Int, productId)
      .query(`SELECT AddressLine FROM ${productAddressesTableName} WHERE ProductId = @ProductId`);
    const rows = normalizeResult(result);
    if (!rows.length) return "";
    const value = rows[0].AddressLine ?? rows[0].addressLine ?? rows[0].address ?? "";
    return typeof value === "string" ? value : "";
  } catch (err) {
    console.error("Unable to load product address:", err);
    return "";
  }
}

async function loadProductAddresses(pool) {
  const ensured = await ensureProductAddressesTable(pool);
  if (!ensured) return new Map();
  try {
    const result = await pool.request().query(`SELECT ProductId, AddressLine FROM ${productAddressesTableName}`);
    const rows = normalizeResult(result);
    const map = new Map();
    rows.forEach((row) => {
      const productId = Number(row.ProductId ?? row.productId ?? row.PID);
      const value = row.AddressLine ?? row.addressLine ?? row.address ?? "";
      if (!Number.isFinite(productId) || typeof value !== "string") return;
      map.set(productId, value);
    });
    return map;
  } catch (err) {
    console.error("Unable to load product addresses:", err);
    return new Map();
  }
}

async function saveProductAddress(pool, productId, address) {
  const ensured = await ensureProductAddressesTable(pool);
  if (!ensured) return;
  try {
    const sanitized = typeof address === "string" ? address.trim() : "";
    if (!sanitized) {
      await pool.request().input("ProductId", sql.Int, productId).query(`DELETE FROM ${productAddressesTableName} WHERE ProductId = @ProductId`);
      return;
    }
    await pool
      .request()
      .input("ProductId", sql.Int, productId)
      .input("AddressLine", sql.NVarChar, sanitized)
      .query(`
        MERGE ${productAddressesTableName} AS target
        USING (SELECT @ProductId AS ProductId, @AddressLine AS AddressLine) AS source
        ON target.ProductId = source.ProductId
        WHEN MATCHED THEN UPDATE SET AddressLine = source.AddressLine
        WHEN NOT MATCHED THEN INSERT (ProductId, AddressLine) VALUES (source.ProductId, source.AddressLine);
      `);
  } catch (err) {
    console.error("Unable to save product address:", err);
  }
}

let cjImportTableEnsured = false;
const cjImportSyncColumnsCache = { loaded: false, columns: new Set() };
async function ensureCjImportsTable(pool) {
  if (cjImportTableEnsured) return true;
  try {
    await requireSchemaObjects(pool, ["Integration.CjImportMappings"]);
    cjImportTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to verify Integration.CjImportMappings:", err);
    return false;
  }
}

async function getCjImportSyncColumns(pool) {
  if (cjImportSyncColumnsCache.loaded) return cjImportSyncColumnsCache.columns;
  try {
    const result = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'Integration'
        AND TABLE_NAME = 'CjImportMappings'
        AND COLUMN_NAME IN ('CjShopId', 'CjProductSaved', 'CjConnectionStatus', 'CjConnectionError', 'CjLastSyncedAt');
    `);
    normalizeResult(result).forEach((row) => {
      const name = String(row.COLUMN_NAME || row.column_name || "").trim();
      if (name) cjImportSyncColumnsCache.columns.add(name.toLowerCase());
    });
  } catch (err) {
    console.warn("Unable to inspect CJ import sync columns:", err && err.message ? err.message : err);
  } finally {
    cjImportSyncColumnsCache.loaded = true;
  }
  return cjImportSyncColumnsCache.columns;
}

async function updateCjImportSyncState(pool, pid, sync = {}) {
  const columns = await getCjImportSyncColumns(pool);
  const updates = [];
  const request = pool.request()
    .input("Pid", sql.NVarChar(120), String(pid || "").trim())
    .input("CjShopId", sql.NVarChar(50), sync.shopId ? String(sync.shopId).slice(0, 50) : null)
    .input("CjProductSaved", sql.Bit, Boolean(sync.storeProductSaved))
    .input("CjConnectionStatus", sql.NVarChar(30), String(sync.status || "not_attempted").slice(0, 30))
    .input("CjConnectionError", sql.NVarChar(600), sync.error ? String(sync.error).slice(0, 600) : null);

  if (columns.has("cjshopid")) updates.push("[CjShopId] = @CjShopId");
  if (columns.has("cjproductsaved")) updates.push("[CjProductSaved] = @CjProductSaved");
  if (columns.has("cjconnectionstatus")) updates.push("[CjConnectionStatus] = @CjConnectionStatus");
  if (columns.has("cjconnectionerror")) updates.push("[CjConnectionError] = @CjConnectionError");
  if (columns.has("cjlastsyncedat")) updates.push("[CjLastSyncedAt] = SYSUTCDATETIME()");
  if (!updates.length) return false;

  try {
    await request.query(`
      UPDATE [Integration].[CjImportMappings]
      SET ${updates.join(", ")}
      WHERE [Pid] = @Pid;
    `);
    return true;
  } catch (err) {
    console.warn("Unable to save CJ import sync state:", err && err.message ? err.message : err);
    return false;
  }
}

function mapCjImportSyncState(row = {}) {
  return {
    cjShopId: row.CjShopId ?? row.cjShopId ?? null,
    cjStoreProductSaved: booleanValue(row.CjProductSaved ?? row.cjProductSaved, false),
    cjConnectionStatus: row.CjConnectionStatus ?? row.cjConnectionStatus ?? "not_attempted",
    cjConnectionError: row.CjConnectionError ?? row.cjConnectionError ?? null,
    cjLastSyncedAt: row.CjLastSyncedAt ?? row.cjLastSyncedAt ?? null,
  };
}

function cjStoreSyncPublicError(error) {
  const providerMessage = String(error?.providerMessage || error?.message || "CJ store sync failed")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const code = error?.code === undefined || error?.code === null ? null : String(error.code).slice(0, 50);
  return { error: providerMessage.slice(0, 600) || "CJ store sync failed", code };
}

function extractCjProductImage(raw) {
  try {
    return normalizeCjProductData(raw, "")?.image || "";
  } catch (_error) {
    return "";
  }
}

async function syncImportedCjProduct(pool, { pid, productId, product, raw } = {}) {
  const normalizedProductId = Number(productId);
  const normalizedProduct = product || {};
  const image = extractCjProductImage(raw) || normalizedProduct.img || normalizedProduct.image || "";
  const sync = await syncCjStoreProduct({
    cjProductId: extractCjProductId(raw, pid),
    platformProductId: normalizedProductId,
    title: normalizedProduct.name || `CJ Product ${pid}`,
    image,
    description: normalizedProduct.description || "",
    salePrice: normalizedProduct.salePrice ?? normalizedProduct.price ?? 0,
    currency: normalizedProduct.currency || "USD",
    raw,
    defaultPlatformVariantId: normalizedProduct.variantId || "",
  });
  await updateCjImportSyncState(pool, pid, sync);
  return sync;
}

function getCjImportPublicError(err) {
  const code = String(err?.code || "").toUpperCase();
  const message = String(err?.message || "");

  if (code === "CJ_IMPORT_SCHEMA_MISSING" || code === "SCHEMA_MIGRATION_REQUIRED") {
    return {
      status: 503,
      error: "CJ imports are not configured yet. Apply database migration 011 and try again.",
    };
  }

  if (
    ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ESOCKET", "ETIMEOUT"].includes(code) ||
    /(?:failed to connect|connection (?:failed|is closed)|connect timeout|database connection)/i.test(message)
  ) {
    return {
      status: 503,
      error: "The product database is unavailable. Check its connection and try again.",
    };
  }

  return { status: 500, error: "Unable to import CJ product. Try again shortly." };
}

function firstCjText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function normalizeCjCommentList(value) {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.list)
    ? value.list
    : Array.isArray(value?.content)
    ? value.content
    : Array.isArray(value?.records)
    ? value.records
    : [];

  return list
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const rawImages = entry.commentUrls ?? entry.images ?? entry.imageList ?? entry.urls ?? [];
      const images = (Array.isArray(rawImages) ? rawImages : [rawImages])
        .map((image) => {
          if (typeof image === "string") return image.trim();
          if (image && typeof image === "object") {
            return firstCjText(image.url, image.imageUrl, image.src, image.path);
          }
          return "";
        })
        .filter(Boolean);
      const rating = Number(entry.score ?? entry.rating ?? entry.star ?? entry.stars);

      return {
        id: firstCjText(entry.commentId, entry.id, entry.uuid) || `cj-comment-${index}`,
        author: firstCjText(entry.commentUser, entry.userName, entry.username, entry.author, entry.nickName) || "CJ customer",
        text: firstCjText(entry.comment, entry.content, entry.message, entry.text, entry.remark),
        rating: Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : null,
        date: firstCjText(entry.commentDate, entry.createdAt, entry.createTime, entry.date),
        countryCode: firstCjText(entry.countryCode, entry.country),
        flagIconUrl: firstCjText(entry.flagIconUrl, entry.flagUrl),
        images: [...new Set(images)],
      };
    })
    .filter((entry) => entry.text || entry.images.length);
}

function normalizeCjProductData(raw, pid) {
  if (!raw) {
    return null;
  }

  const product = raw.product ?? raw.data ?? raw.result ?? raw;

  // If this is a detail payload, use the data object directly.
  const detailData = raw?.data && typeof raw.data === "object" ? raw.data : null;

  let container = product;
  if (Array.isArray(container?.content) && container.content.length && typeof container.content[0] === "object") {
    const first = container.content[0];
    if (Array.isArray(first?.productList) || Array.isArray(first?.relatedCategoryList) || first?.keyWord) {
      container = first;
    }
  }

  const listItem =
    Array.isArray(container?.productList) && container.productList.length ? container.productList[0] : null;
  const candidate = listItem || detailData || container;

  const detailProduct =
    detailData?.product ||
    detailData?.productInfo ||
    detailData?.productDetails ||
    detailData?.productDetail ||
    detailData?.detail ||
    null;

  const rich = (detailProduct && typeof detailProduct === "object" ? detailProduct : null) || candidate;

  const relatedCategory =
    Array.isArray(container?.relatedCategoryList) && container.relatedCategoryList.length
      ? container.relatedCategoryList[0]
      : null;

  const parsePriceRange = (value) => {
    if (value === undefined || value === null) return { min: null, max: null, text: null };
    if (typeof value === "number") {
      return Number.isFinite(value) ? { min: value, max: value, text: value.toFixed(2) } : { min: null, max: null, text: null };
    }
    const input = String(value).trim();
    if (!input) return { min: null, max: null, text: null };

    const direct = Number(input);
    if (Number.isFinite(direct)) return { min: direct, max: direct, text: direct.toFixed(2) };

    const matches = input.match(/(\d+(?:\.\d+)?)/g) || [];
    const nums = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
    if (!nums.length) return { min: null, max: null, text: null };

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const text = min === max ? min.toFixed(2) : `${min.toFixed(2)} - ${max.toFixed(2)}`;
    return { min, max, text };
  };

  const descriptionSource =
    rich.description ||
    rich.desc ||
    rich.productDescription ||
    rich.productDescriptionEn ||
    rich.detail ||
    rich.remark ||
    "";
  const images = extractCjImageUrls([rich, detailData, descriptionSource]);
  const placeholder = process.env.CJ_FALLBACK_IMAGE || "https://picsum.photos/seed/cj-product/600/400";
  const preferredImages = extractCjImageUrls([
    rich.mainImage,
    rich.cover,
    rich.image,
    rich.img,
    rich.imageUrl,
    rich.bigImage,
    rich.productImage,
  ]);
  const cover = preferredImages[0] || images[0] || placeholder;
  const description = sanitizeCjDescription(descriptionSource);

  const buyerReviews = normalizeCjCommentList(
    rich.buyerReviews ??
      rich.buyerReviewList ??
      rich.productComments ??
      detailData?.buyerReviews ??
      detailData?.buyerReviewList ??
      detailData?.productComments ??
      raw?.buyerReviews ??
      raw?.productComments
  );
  const reportedBuyerReviewTotal = Number(
    rich.buyerReviewTotal ??
      rich.buyerReviewsTotal ??
      rich.reviewTotal ??
      rich.commentTotal ??
      detailData?.buyerReviewTotal ??
      detailData?.buyerReviewsTotal ??
      detailData?.reviewTotal ??
      detailData?.commentTotal
  );

  const name =
    rich.nameEn ||
    rich.name ||
    rich.title ||
    rich.productName ||
    rich.productNameEn ||
    `CJ Product ${pid}`;
  const category =
    rich.category ||
    rich.categoryName ||
    rich.categoryNameEn ||
    relatedCategory?.name ||
    rich.threeCategoryName ||
    rich.categoryId ||
    "Dropshipping";
  const brand = hideSupplierBranding(
    rich.brand ||
    rich.vendorName ||
    rich.storeName ||
    rich.supplierName,
    configuredStoreName()
  );

  const priceRange = parsePriceRange(
    rich.price ??
      rich.nowPrice ??
      rich.sellPrice ??
      rich.wholesalePrice ??
      rich.costPrice ??
      rich.goodsPrice ??
      rich.salePrice ??
      rich.variantSellPrice ??
      rich.variantPrice
  );
  const stockValue = Number(
    rich.stock ??
      rich.warehouseInventoryNum ??
      rich.inventory ??
      rich.qty ??
      rich.quantity ??
      rich.storageNum ??
      rich.totalInventoryNum
  );

  const uniqImages = [...new Set(images)];

  return {
    pid,
    sku: rich.variantSku || rich.productSku || rich.sku || null,
    name,
    description,
    category,
    brand,
    price: Number.isFinite(priceRange.min) ? priceRange.min : null,
    priceMin: Number.isFinite(priceRange.min) ? priceRange.min : null,
    priceMax: Number.isFinite(priceRange.max) ? priceRange.max : null,
    priceText: priceRange.text,
    image: cover || placeholder,
    images: uniqImages.length ? uniqImages : cover ? [cover] : [placeholder],
    stock: Number.isFinite(stockValue) ? stockValue : 0,
    address: rich.warehouseName || rich.address || rich.location || "",
    buyerReviews,
    buyerReviewTotal: Number.isFinite(reportedBuyerReviewTotal) ? Math.max(0, reportedBuyerReviewTotal) : buyerReviews.length,
    raw: listItem ? { ...container, product: listItem } : rich,
  };
}

const CJ_TOKEN_ENDPOINT =
  process.env.CJ_API_TOKEN_URL ||
  "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken";

let cachedCjToken = { token: null, expiresAt: 0 };
let cjTokenPromise = null;
let cjTokenCooldownUntil = 0;
class CjRateLimitError extends Error {
  constructor(message, retryAfterSeconds = null) {
    super(message);
    this.name = "CjRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getRetryAfterSeconds(response) {
  try {
    const value = response?.headers?.get?.("retry-after");
    if (!value) return null;
    const num = Number(value);
    if (Number.isFinite(num)) return Math.max(0, num);
    const date = Date.parse(value);
    if (Number.isFinite(date)) {
      const secs = Math.ceil((date - Date.now()) / 1000);
      return Math.max(0, secs);
    }
  } catch (_err) {
    // ignore
  }
  return null;
}

function looksLikeCjPid(value) {
  const input = String(value || "").trim();
  // CJ PID is often UUID-like
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

async function cjFetchJson(url, { method = "GET", headers = {} } = {}) {
  const fetchFn = typeof fetch === "function" ? fetch : null;
  if (!fetchFn) return { ok: false, status: 0, payload: null, retryAfterSeconds: null };

  const response = await fetchFn(url, { method, headers });
  const retryAfterSeconds = response.status === 429 ? getRetryAfterSeconds(response) : null;
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload, retryAfterSeconds };
}

async function fetchCjProductReviews(pid, headers) {
  const productId = String(pid || "").trim();
  if (!productId) return { reviews: [], total: 0 };

  const reviewsBase =
    process.env.CJ_API_REVIEWS_URL ||
    "https://developers.cjdropshipping.com/api2.0/v1/product/productComments";
  const separator = reviewsBase.includes("?") ? "&" : "?";
  const url = `${reviewsBase}${separator}pid=${encodeURIComponent(productId)}&pageNum=1&pageSize=20`;

  try {
    const response = await cjFetchJson(url, { headers });
    const payload = response.payload;
    if (!response.ok || payload?.result === false || payload?.success === false || !payload?.data) {
      console.warn("CJ product review fetch skipped:", payload?.message || `HTTP ${response.status}`);
      return { reviews: [], total: 0 };
    }

    const data = payload.data;
    const reviews = normalizeCjCommentList(data);
    const total = Number(data.total ?? data.totalCount ?? data.count);
    return { reviews, total: Number.isFinite(total) ? Math.max(0, total) : reviews.length };
  } catch (err) {
    // A review failure must not prevent the product itself from being imported.
    console.warn("CJ product review fetch skipped:", err && err.message ? err.message : err);
    return { reviews: [], total: 0 };
  }
}

async function attachCjProductContent(detail, pid, headers) {
  if (!detail || !detail.data || typeof detail.data !== "object") return detail;

  const reviews = await fetchCjProductReviews(pid, headers);
  return {
    ...detail,
    data: {
      ...detail.data,
      buyerReviews: reviews.reviews,
      buyerReviewTotal: reviews.total,
    },
  };
}

async function getCjAccessToken() {
  const apiKey = process.env.CJ_API_TOKEN || process.env.CJ_API_KEY || process.env.CJ_TOKEN;
  const fetchFn = typeof fetch === "function" ? fetch : null;
  if (!apiKey || !fetchFn) return null;

  // Return cached token if still valid for at least 60 seconds
  if (cachedCjToken.token && Date.now() < cachedCjToken.expiresAt - 60_000) {
    return cachedCjToken.token;
  }

  // Respect 5-minute QPS limit if we were recently throttled
  if (Date.now() < cjTokenCooldownUntil) {
    return null;
  }

  // Coalesce concurrent token fetches
  if (cjTokenPromise) return cjTokenPromise;

  try {
    cjTokenPromise = (async () => {
      const resp = await fetchFn(CJ_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const payload = await resp.json().catch(() => null);
      if (payload?.result && payload?.data?.accessToken) {
        const expiry = payload.data.accessTokenExpiryDate
          ? new Date(payload.data.accessTokenExpiryDate).getTime()
          : Date.now() + 15 * 24 * 60 * 60 * 1000;
        cachedCjToken = {
          token: payload.data.accessToken,
          expiresAt: Number.isFinite(expiry) ? expiry : Date.now() + 30 * 60 * 1000,
        };
        return cachedCjToken.token;
      }

      // If throttled, back off for 5 minutes
      if (payload?.code === 1600200 || /Too Many Requests/i.test(payload?.message || "")) {
        cjTokenCooldownUntil = Date.now() + 5 * 60 * 1000;
      }

      console.warn("CJ token fetch failed:", payload);
      return null;
    })();

    const token = await cjTokenPromise;
    return token;
  } catch (err) {
    console.warn("CJ token fetch error:", err && err.message ? err.message : err);
    return null;
  } finally {
    cjTokenPromise = null;
  }
}

async function fetchCjProduct(pid) {
  const input = String(pid || "").trim();
  if (!input) return null;

  const base =
    process.env.CJ_API_BASE_URL ||
    process.env.CJ_API_BASE ||
    "https://developers.cjdropshipping.com/api2.0/v1/product/query";
  const listBase =
    process.env.CJ_API_LIST_URL ||
    "https://developers.cjdropshipping.com/api2.0/v1/product/listV2";

  // For SKU input, search listV2 first (avoids hitting product detail endpoint multiple times).
  const shouldTreatAsPid = looksLikeCjPid(input);

  const accessToken = await getCjAccessToken();
  if (!accessToken) {
    const cooldownSeconds = Math.max(0, Math.ceil((cjTokenCooldownUntil - Date.now()) / 1000));
    if (cooldownSeconds > 0) {
      throw new CjRateLimitError("CJ token rate limited", cooldownSeconds);
    }
    console.warn("CJ fetch skipped: unable to obtain CJ access token.");
    return null;
  }

  const headers = { "Content-Type": "application/json", "CJ-Access-Token": accessToken };

  const tryDetail = async (candidate) => {
    const value = String(candidate || "").trim();
    if (!value) return null;
    const params = ["pid", "productId", "id", "PID"];
    for (const key of params) {
      const url = `${base}${base.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
      const detailRes = await cjFetchJson(url, { headers });
      if (detailRes.status === 429) {
        throw new CjRateLimitError("CJ rate limited (detail)", detailRes.retryAfterSeconds);
      }
      const payload = detailRes.payload;
      if (payload && payload.result === false) continue;
      if (detailRes.ok && payload?.data) {
        const reviewPid = payload.data?.pid || payload.data?.product?.pid || payload.data?.productInfo?.pid || value;
        return attachCjProductContent(payload, reviewPid, headers);
      }
    }
    return null;
  };

  let resolvedPid = shouldTreatAsPid ? input : null;
  if (!resolvedPid) {
    const listUrl = `${listBase}${listBase.includes("?") ? "&" : "?"}page=1&size=20&keyWord=${encodeURIComponent(input)}&features=enable_description`;
    const listRes = await cjFetchJson(listUrl, { headers });
    if (listRes.status === 429) {
      throw new CjRateLimitError("CJ rate limited (search)", listRes.retryAfterSeconds);
    }
    const listPayload = listRes.payload;
    const list =
      listPayload?.data?.list ??
      listPayload?.data?.content ??
      listPayload?.data?.records ??
      listPayload?.data?.productList ??
      null;
    if (!(listRes.ok && listPayload?.result && Array.isArray(list) && list.length)) {
      console.warn("CJ SKU search empty:", listPayload && listPayload.message ? listPayload.message : "no data");
      return null;
    }

    const needle = input.toLowerCase();
    const best =
      list.find((item) => String(item?.variantSku || "").toLowerCase() === needle) ||
      list.find((item) => String(item?.productSku || "").toLowerCase() === needle) ||
      list.find((item) => String(item?.sku || "").toLowerCase() === needle) ||
      list.find((item) => needle.startsWith(String(item?.sku || "").toLowerCase())) ||
      list[0];

    const candidatePid =
      best?.pid ||
      best?.PID ||
      best?.productId ||
      best?.ProductId ||
      best?.productPid ||
      best?.productPID ||
      null;

    if (!candidatePid) {
      const candidateId = best?.id ? String(best.id).trim() : "";
      if (candidateId) {
        const detail = await tryDetail(candidateId);
        if (detail) return detail;
      }

      // Some listV2 responses don't include the pid; still return the list item so UI can show details.
      return { data: { ...listPayload?.data, productList: [best] }, result: true };
    }

    resolvedPid = String(candidatePid);
  }

  const detail = await tryDetail(resolvedPid);
  return detail;
}


async function upsertCjImportMapping(pool, pid, productId, price, rawJson) {
  const ensured = await ensureCjImportsTable(pool);
  if (!ensured) return;
  try {
    const serializedRawJson = rawJson ? JSON.stringify(rawJson) : null;
    await pool
      .request()
      .input("Pid", sql.NVarChar, pid)
      .input("ProductId", sql.Int, productId)
      .input("Price", sql.Decimal(18, 2), Number(price) || 0)
      .input("RawJson", sql.NVarChar(sql.MAX), serializedRawJson)
      .query(`
        MERGE [Integration].[CjImportMappings] AS target
        USING (SELECT @Pid AS Pid) AS source
        ON target.Pid = source.Pid
        WHEN MATCHED THEN
          UPDATE SET ProductId = @ProductId, Price = @Price, RawJson = @RawJson, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (Pid, ProductId, Price, RawJson) VALUES (@Pid, @ProductId, @Price, @RawJson);
      `);
  } catch (err) {
    console.error("Unable to upsert CJ import mapping:", err);
  }
}

async function insertOrUpdateCjProduct(pool, pid, desiredSalePrice, cjPayload, desiredBuyPrice = null) {
  const normalized = normalizeCjProductData(cjPayload, pid);
  const price = Number.isFinite(Number(desiredSalePrice))
    ? Number(desiredSalePrice)
    : Number.isFinite(normalized.price)
    ? normalized.price
    : 0;
  const buyPrice = Number.isFinite(Number(desiredBuyPrice))
    ? Number(desiredBuyPrice)
    : Number.isFinite(normalized.price)
    ? normalized.price
    : 0;

  await ensureCjImportsTable(pool);
  const schemaOk = await ensureProductsSchemaForCj(pool);

  const categoryDb = schemaOk
    ? normalized.category || "Dropshipping"
    : truncateString(normalized.category || "Dropshipping", 50);
  const brandDb = schemaOk
    ? normalized.brand || configuredStoreName()
    : truncateString(normalized.brand || configuredStoreName(), 50);
  const nameDb = schemaOk
    ? normalized.name || `CJ Product ${pid}`
    : truncateString(normalized.name || `CJ Product ${pid}`, 50);
  const descriptionDb = schemaOk ? normalized.description || "" : truncateString(normalized.description || "", 255);
  const altDb = truncateString(`cj:${pid}`, 255);

  const rawImg = typeof normalized.image === "string" ? normalized.image : null;
  const imgDb = schemaOk
    ? (rawImg && rawImg.trim()) || process.env.CJ_FALLBACK_IMAGE || "https://picsum.photos/seed/cj-product/600/400"
    : await ensureCjPrimaryImagePath(rawImg, pid);

  const existing = await pool
    .request()
    .input("Pid", sql.NVarChar, pid)
    .query("SELECT TOP 1 ProductId FROM [Integration].[CjImportMappings] WHERE Pid = @Pid");

  const existingRows = normalizeResult(existing);
  const imagesRaw = Array.isArray(normalized.images)
    ? normalized.images.filter((img) => typeof img === "string" && img.trim().length > 0)
    : [];
  const address = typeof normalized.address === "string" ? normalized.address : "";

  if (existingRows.length) {
    const productId = Number(existingRows[0].ProductId);
    const current = await loadProductById(pool, productId);
    const stockColumn = await getProductStockColumn(pool);

    const setClauses = [
      "Category = @Category",
      "Brand = @Brand",
      "Name = @Name",
      "Description = @Description",
      "Price = @Price",
      "Alt = @Alt",
      "Img = @Img",
    ];

    let request = pool
      .request()
      .input("ProductId", sql.Int, productId)
      .input("Category", sql.NVarChar(100), categoryDb || current?.category || "Dropshipping")
      .input("Brand", sql.NVarChar(100), brandDb || current?.brand || configuredStoreName())
      .input("Name", sql.NVarChar(255), nameDb || current?.name || `CJ Product ${pid}`)
      .input("Description", sql.NVarChar(sql.MAX), descriptionDb || current?.description || "")
      .input("Price", sql.Decimal(18, 2), price)
      .input("Alt", sql.NVarChar, altDb)
      .input("Img", sql.NVarChar(schemaOk ? 500 : 50), imgDb || current?.img || "");

    if (stockColumn) {
      setClauses.push(`[${stockColumn}] = @Stock`);
      request = request.input("Stock", sql.Int, Number.isFinite(normalized.stock) ? normalized.stock : current?.stock ?? 0);
    }

    await request.query(`
      UPDATE [dbo].[Products_tbl]
      SET ${setClauses.join(", ")}
      WHERE PID = @ProductId
    `);

    await persistLegacyPricing(pool, productId, { buyPrice, salePrice: price });
    await ensureCanonicalProductForLegacy(pool, productId, {
      name: nameDb,
      description: descriptionDb,
      brand: brandDb,
      alt: altDb,
      buyPrice,
      salePrice: price,
      stock: Number.isFinite(normalized.stock) ? normalized.stock : current?.stock ?? 0,
      currency: "USD",
      sku: current?.sku || `CJ-${pid}`,
    }, [imgDb, ...imagesRaw]);

    const imagesForDb = [...new Set([imgDb, ...imagesRaw])]
      .filter((img) => typeof img === "string" && img.trim().length > 0)
      .map((img) => img.trim())
      .filter((img) => img.length <= 500);

    if (imagesForDb.length) {
      await saveProductImages(pool, productId, imagesForDb);
    }
    if (address) {
      await saveProductAddress(pool, productId, address);
    }

    await upsertCjImportMapping(pool, pid, productId, buyPrice, normalized.raw);

    const updated = await loadProductById(pool, productId);
    if (updated) {
      updated.images = await getProductImagesById(pool, productId);
      updated.address = await getProductAddressById(pool, productId);
    }
    return updated;
  }

  const stockColumn = await getProductStockColumn(pool);
  const insertColumns = ["Category", "Brand", "Name", "Description", "Price", "Alt", "Img"];
  const insertValues = ["@Category", "@Brand", "@Name", "@Description", "@Price", "@Alt", "@Img"];

  let request = pool
    .request()
    .input("Category", sql.NVarChar(100), categoryDb)
    .input("Brand", sql.NVarChar(100), brandDb)
    .input("Name", sql.NVarChar(255), nameDb)
    .input("Description", sql.NVarChar(sql.MAX), descriptionDb)
    .input("Price", sql.Decimal(18, 2), price)
    .input("Alt", sql.NVarChar, altDb)
    .input("Img", sql.NVarChar(schemaOk ? 500 : 50), imgDb || "");

  if (stockColumn) {
    insertColumns.push(`[${stockColumn}]`);
    insertValues.push("@Stock");
    request = request.input("Stock", sql.Int, Number.isFinite(normalized.stock) ? normalized.stock : 0);
  }

  const result = await request.query(`
    INSERT INTO [dbo].[Products_tbl] (${insertColumns.join(", ")})
    OUTPUT INSERTED.*
    VALUES (${insertValues.join(", ")})
  `);

  const rows = normalizeResult(result);
  const inserted = rows[0];
  const insertedId = inserted.PID ?? inserted.id ?? inserted.ProductId;

  const imagesForDb = [...new Set([imgDb, ...imagesRaw])]
    .filter((img) => typeof img === "string" && img.trim().length > 0)
    .map((img) => img.trim())
    .filter((img) => img.length <= 500);

  if (imagesForDb.length) {
    await saveProductImages(pool, insertedId, imagesForDb);
  }
  if (address) {
    await saveProductAddress(pool, insertedId, address);
  }

  await upsertCjImportMapping(pool, pid, insertedId, buyPrice, normalized.raw);

  await persistLegacyPricing(pool, insertedId, { buyPrice, salePrice: price });
  await ensureCanonicalProductForLegacy(pool, insertedId, {
    name: nameDb,
    description: descriptionDb,
    brand: brandDb,
    alt: altDb,
    buyPrice,
    salePrice: price,
    stock: Number.isFinite(normalized.stock) ? normalized.stock : 0,
    currency: "USD",
    sku: `CJ-${pid}`,
  }, [imgDb, ...imagesRaw]);

  const decorated = mapProductRow(inserted, { buyPrice, salePrice: price, currency: "USD", stock: normalized.stock });
  decorated.images = await getProductImagesById(pool, insertedId);
  decorated.address = await getProductAddressById(pool, insertedId);
  return decorated;
}

async function loadCjImports(pool) {
  const ensured = await ensureCjImportsTable(pool);
  if (!ensured) return [];
  try {
    const syncColumns = await getCjImportSyncColumns(pool);
    const optionalSelects = [
      ["cjshopid", "map.CjShopId"],
      ["cjproductsaved", "map.CjProductSaved"],
      ["cjconnectionstatus", "map.CjConnectionStatus"],
      ["cjconnectionerror", "map.CjConnectionError"],
      ["cjlastsyncedat", "map.CjLastSyncedAt"],
    ]
      .filter(([column]) => syncColumns.has(column))
      .map(([, expression]) => expression)
      .join(",\n              ");
    const result = await pool.request().query(`
      SELECT map.Pid, map.ProductId, map.Price AS ImportedPrice, map.RawJson, map.CreatedAt, map.UpdatedAt${optionalSelects ? `,\n              ${optionalSelects}` : ""},
              p.*
      FROM [Integration].[CjImportMappings] map
      LEFT JOIN [dbo].[Products_tbl] p ON p.PID = map.ProductId
      ORDER BY map.UpdatedAt DESC
    `);
    const rows = normalizeResult(result);
    const imagesMap = await loadProductImages(pool);
    const pricingMap = await loadCanonicalProductPricing(pool, rows.map((row) => row.ProductId));
    return rows.map((row) => {
      let cjProduct = null;
      try {
        cjProduct = row.RawJson ? normalizeCjProductData(JSON.parse(row.RawJson), row.Pid) : null;
      } catch (_error) {
        // The product record and any previously stored images remain available for older imports.
      }
      const images = [...new Set([...(imagesMap.get(Number(row.ProductId)) || []), ...(cjProduct?.images || [])])];
      const salePrice = numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.salePrice, row.SalePrice, row.Price), 0);
      const buyPrice = numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.buyPrice, row.BuyPrice, row.ImportedPrice), 0);
      return {
        pid: row.Pid,
        productId: row.ProductId,
        price: salePrice,
        salePrice,
        buyPrice,
        unitProfit: salePrice - buyPrice,
        createdAt: row.CreatedAt ?? null,
        updatedAt: row.UpdatedAt ?? null,
        name: row.Name ?? null,
        description: cjProduct?.description || row.Description || null,
        images,
        img: row.Img ?? row.IMG ?? images[0] ?? null,
        ...mapCjImportSyncState(row),
      };
    });
  } catch (err) {
    console.error("Unable to load CJ import mappings:", err);
    return [];
  }
}

async function loadCjStorefrontContent(pool) {
  const ensured = await ensureCjImportsTable(pool);
  if (!ensured) return new Map();

  try {
    const result = await pool.request().query(`
      SELECT ProductId, Pid, RawJson
      FROM [Integration].[CjImportMappings]
      WHERE RawJson IS NOT NULL;
    `);
    const contentByProductId = new Map();

    for (const row of normalizeResult(result)) {
      const productId = Number(row.ProductId);
      if (!Number.isFinite(productId) || !row.RawJson) continue;

      try {
        const normalized = normalizeCjProductData(JSON.parse(row.RawJson), row.Pid);
        if (!normalized) continue;
        contentByProductId.set(productId, {
          cjPid: String(row.Pid || normalized.pid || ""),
          description: normalized.description || "",
          images: normalized.images || [],
          buyerReviews: normalized.buyerReviews || [],
          buyerReviewTotal: normalized.buyerReviewTotal || 0,
        });
      } catch (_err) {
        // Older imports may contain a pre-JSON-truncation payload. Their product data still loads normally.
      }
    }

    return contentByProductId;
  } catch (err) {
    console.warn("Unable to load CJ storefront content:", err && err.message ? err.message : err);
    return new Map();
  }
}

function parseImageList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
      }
    } catch (err) {
      // ignore JSON parse error and fall through to delimiter parsing
    }
    return trimmed
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function collectAdditionalImages(req, pool, productId) {
  const uploaded = Array.isArray(req.files?.gallery)
    ? req.files.gallery.map((file) => `/uploads/${file.filename}`)
    : [];
  const manualList = parseImageList(req.body.additionalImages);
  const existingList = parseImageList(req.body.existingImages);

  let fallbackExisting = [];
  if (!existingList.length && !manualList.length && uploaded.length === 0 && Number.isFinite(productId)) {
    fallbackExisting = await getProductImagesById(pool, productId);
  }

  const combined = [...existingList, ...manualList, ...uploaded, ...fallbackExisting];
  const deduped = [];
  const seen = new Set();
  combined.forEach((path) => {
    if (typeof path !== "string") return;
    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    deduped.push(trimmed);
  });
  return deduped;
}

function extractAddress(body) {
  const value = body?.address ?? body?.Address ?? "";
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function extractPrimaryImagePath(req) {
  const primary = Array.isArray(req.files?.primaryImage) ? req.files.primaryImage[0] : null;
  const legacy = Array.isArray(req.files?.image) ? req.files.image[0] : null;
  const file = primary || legacy || null;
  return file ? `/uploads/${file.filename}` : null;
}

// REGISTER
router.post("/api/register", async (req, res) => {
  const { username, email, password, country, state, city, zip, address, phone, emailMarketing, smsMarketing, firstName, lastName, birthdayMonth, birthdayDay } = req.body;
  const generatedUsername = String(username || `${firstName || "user"}.${lastName || "account"}`).trim().slice(0, 100);
  const normalizedEmail = normalizeResetEmail(email);

  if (!generatedUsername || !isValidEmail(normalizedEmail) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Provide a valid email and a password between 8 and 128 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const pool = await getPool();
    const clientIp = getRequestIp(req);

    const existing = await findUserByEmail(pool, normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    await pool.request()
      .input("Username", sql.NVarChar, generatedUsername)
      .input("Email", sql.NVarChar(255), normalizedEmail)
      .input("PasswordHash", sql.NVarChar, hashedPassword)
      .input("Role", sql.NVarChar, "customer")
      .query(`
        INSERT INTO User_tbl (Username, Email, PasswordHash, Role, CreatedAt)
        VALUES (@Username, @Email, @PasswordHash, @Role, GETDATE())
      `);

    const registeredUserResult = await pool.request()
      .input("Email", sql.NVarChar(255), normalizedEmail)
      .query("SELECT TOP 1 UserID FROM User_tbl WHERE Email = @Email");
    const registeredUserId = normalizeResult(registeredUserResult)[0]?.UserID;
    if (!registeredUserId) throw new Error("Registered customer could not be loaded");

    // Optionally persist metadata if columns exist
    const optionalUpdates = [];
    if (clientIp && (await hasUserColumn(pool, "signupip"))) {
      optionalUpdates.push({ name: "SignupIP", value: clientIp });
    }
    if (country && (await hasUserColumn(pool, "Country"))) optionalUpdates.push({ name: "Country", value: country });
    if (state && (await hasUserColumn(pool, "State"))) optionalUpdates.push({ name: "State", value: state });
    if (city && (await hasUserColumn(pool, "City"))) optionalUpdates.push({ name: "City", value: city });
    if (zip && (await hasUserColumn(pool, "Zip"))) optionalUpdates.push({ name: "Zip", value: zip });
    if (address && (await hasUserColumn(pool, "Address"))) optionalUpdates.push({ name: "Address", value: address });
    if (phone && (await hasUserColumn(pool, "Phone"))) optionalUpdates.push({ name: "Phone", value: phone });
    if (typeof smsMarketing === "boolean" && (await hasUserColumn(pool, "SMSMarketing"))) optionalUpdates.push({ name: "SMSMarketing", value: smsMarketing ? 1 : 0 });
    if (firstName && (await hasUserColumn(pool, "FirstName"))) optionalUpdates.push({ name: "FirstName", value: firstName });
    if (lastName && (await hasUserColumn(pool, "LastName"))) optionalUpdates.push({ name: "LastName", value: lastName });
    if (birthdayMonth && (await hasUserColumn(pool, "BirthdayMonth"))) optionalUpdates.push({ name: "BirthdayMonth", value: birthdayMonth });
    if (birthdayDay && (await hasUserColumn(pool, "BirthdayDay"))) optionalUpdates.push({ name: "BirthdayDay", value: birthdayDay });

    if (optionalUpdates.length) {
      let updateReq = pool.request().input("Email", sql.NVarChar(255), normalizedEmail);
      const setClauses = [];
      optionalUpdates.forEach((field, idx) => {
        setClauses.push(`[${field.name}] = @opt${idx}`);
        updateReq = updateReq.input(`opt${idx}`, sql.NVarChar, field.value);
      });
      await updateReq.query(`UPDATE User_tbl SET ${setClauses.join(", ")} WHERE Email = @Email`);
    }

    await persistSignupPreferences(pool, registeredUserId, { emailMarketing, smsMarketing });
    await sendNewCustomerEmails({
      pool,
      userId: registeredUserId,
      email: normalizedEmail,
      name: [firstName, lastName].filter(Boolean).join(" ") || generatedUsername,
      emailMarketing,
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("/api/register error:", err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/api/register/admin", requireStaffManage, async (req, res) => {
  const { username, email, password } = req.body;
  const normalizedUsername = String(username || "").trim().slice(0, 100);
  const normalizedEmail = normalizeResetEmail(email);

  if (!normalizedUsername || !isValidEmail(normalizedEmail) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Provide a valid username, email, and a password between 8 and 128 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const pool = await getPool();
    const clientIp = getRequestIp(req);

    const existing = await findUserByEmail(pool, normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    await pool.request()
      .input("Username", sql.NVarChar(100), normalizedUsername)
       .input("Email", sql.NVarChar(255), normalizedEmail)
      .input("PasswordHash", sql.NVarChar, hashedPassword)
      .input("Role", sql.NVarChar, "admin")
      .query(`
        INSERT INTO User_tbl (Username, Email, PasswordHash, Role, CreatedAt)
        VALUES (@Username, @Email, @PasswordHash, @Role, GETDATE())
      `);

    if (clientIp && (await hasUserColumn(pool, "signupip"))) {
      await pool
        .request()
        .input("Email", sql.NVarChar(255), normalizedEmail)
        .input("SignupIP", sql.NVarChar, clientIp)
        .query("UPDATE User_tbl SET SignupIP = @SignupIP WHERE Email = @Email");
    }

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    console.error("/api/register/admin error:", err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// CUSTOMER PASSWORD RESET
router.post("/api/password-reset/request", async (req, res) => {
  const email = normalizeResetEmail(req.body?.email);
  const genericMessage = getPasswordResetGenericMessage();

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  try {
    const pool = await getPool();
    await ensurePasswordResetTable(pool);

    const userResult = await pool.request()
      .input("Email", sql.NVarChar(255), email)
      .query(`
        SELECT TOP 1 UserID, Email, Role
        FROM User_tbl
        WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
          AND LOWER(ISNULL(Role, 'customer')) NOT IN ('admin', 'owner')
      `);
    const users = normalizeResult(userResult);

    // A reset can only be started for an email registered in User_tbl.
    if (!users.length) return res.json({ ok: true, message: genericMessage });

    // Do not accept reset requests until the server has a real transactional mailer.
    if (!isSendPulseMailerConfigured()) {
      return res.status(503).json({ error: "Password reset email is not configured" });
    }

    const recentResult = await pool.request()
      .input("Email", sql.NVarChar(255), email)
      .input("DelaySeconds", sql.Int, passwordResetResendDelaySeconds)
      .query(`
        SELECT TOP 1 Id
        FROM dbo.password_reset_codes
        WHERE Email = @Email
          AND CreatedAt > DATEADD(SECOND, -@DelaySeconds, SYSUTCDATETIME())
        ORDER BY CreatedAt DESC
      `);
    if (normalizeResult(recentResult).length) {
      return res.json({ ok: true, message: genericMessage });
    }

    const code = createPasswordResetCode();
    const codeHash = hashResetValue(code);

    await pool.request()
      .input("UserID", sql.Int, users[0].UserID)
      .input("Email", sql.NVarChar(255), email)
      .input("CodeHash", sql.NVarChar(64), codeHash)
      .input("TtlMinutes", sql.Int, passwordResetCodeTtlMinutes)
      .query(`
        UPDATE dbo.password_reset_codes
        SET UsedAt = SYSUTCDATETIME()
        WHERE Email = @Email AND UsedAt IS NULL;

        INSERT INTO dbo.password_reset_codes (UserID, Email, CodeHash, ExpiresAt)
        VALUES (@UserID, @Email, @CodeHash, DATEADD(MINUTE, @TtlMinutes, SYSUTCDATETIME()))
      `);

    try {
      await sendPasswordResetCodeEmail({
        email,
        code,
        expiresInMinutes: passwordResetCodeTtlMinutes,
      });
    } catch (mailError) {
      await pool.request()
        .input("CodeHash", sql.NVarChar(64), codeHash)
        .query("UPDATE dbo.password_reset_codes SET UsedAt = SYSUTCDATETIME() WHERE CodeHash = @CodeHash AND UsedAt IS NULL");
      console.error("Password reset email delivery failed:", mailError && mailError.message ? mailError.message : mailError);
      return res.status(502).json({ error: "We could not send the verification email. Please try again." });
    }

    return res.json({ ok: true, message: genericMessage });
  } catch (err) {
    console.error("/api/password-reset/request error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Unable to start password reset" });
  }
});

router.post("/api/password-reset/verify", async (req, res) => {
  const email = normalizeResetEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the six-digit verification code" });
  }

  try {
    const pool = await getPool();
    await ensurePasswordResetTable(pool);
    const codeHash = hashResetValue(code);
    const result = await pool.request()
      .input("Email", sql.NVarChar(255), email)
      .input("CodeHash", sql.NVarChar(64), codeHash)
      .input("MaxAttempts", sql.Int, passwordResetMaxAttempts)
      .query(`
        SELECT TOP 1 Id, CodeHash, Attempts
        FROM dbo.password_reset_codes
        WHERE Email = @Email
          AND CodeHash = @CodeHash
          AND UsedAt IS NULL
          AND ExpiresAt > SYSUTCDATETIME()
          AND Attempts < @MaxAttempts
        ORDER BY CreatedAt DESC
      `);
    const rows = normalizeResult(result);
    const resetCode = rows[0];

    if (!resetCode) {
      const latestResult = await pool.request()
        .input("Email", sql.NVarChar(255), email)
        .input("MaxAttempts", sql.Int, passwordResetMaxAttempts)
        .query(`
          SELECT TOP 1 Id
          FROM dbo.password_reset_codes
          WHERE Email = @Email
            AND UsedAt IS NULL
            AND VerifiedAt IS NULL
            AND ExpiresAt > SYSUTCDATETIME()
            AND Attempts < @MaxAttempts
          ORDER BY CreatedAt DESC
        `);
      const latestResetCode = normalizeResult(latestResult)[0];
      if (latestResetCode) {
        await pool.request()
          .input("Id", sql.BigInt, latestResetCode.Id)
          .query("UPDATE dbo.password_reset_codes SET Attempts = Attempts + 1 WHERE Id = @Id AND UsedAt IS NULL AND VerifiedAt IS NULL");
      }
      return res.status(400).json({ error: "That code is invalid or expired" });
    }

    const resetToken = createResetToken();
    const resetTokenHash = hashResetValue(resetToken);
    const updateResult = await pool.request()
      .input("Id", sql.BigInt, resetCode.Id)
      .input("ResetTokenHash", sql.NVarChar(64), resetTokenHash)
      .query(`
        UPDATE dbo.password_reset_codes
        SET ResetTokenHash = @ResetTokenHash,
            VerifiedAt = COALESCE(VerifiedAt, SYSUTCDATETIME())
        OUTPUT INSERTED.Id
        WHERE Id = @Id
          AND UsedAt IS NULL
          AND ExpiresAt > SYSUTCDATETIME()
      `);
    if (!normalizeResult(updateResult).length) {
      return res.status(400).json({ error: "That code is invalid or expired" });
    }

    return res.json({ ok: true, resetToken });
  } catch (err) {
    console.error("/api/password-reset/verify error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Unable to verify the password reset code" });
  }
});

router.post("/api/password-reset/reset", async (req, res) => {
  const email = normalizeResetEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || "").trim();
  const password = String(req.body?.password || "");

  if (!isValidEmail(email) || resetToken.length < 32) {
    return res.status(400).json({ error: "Your password reset session is invalid or expired" });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be between 8 and 128 characters" });
  }

  try {
    const pool = await getPool();
    await ensurePasswordResetTable(pool);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const resetTokenHash = hashResetValue(resetToken);
      const resetResult = await new sql.Request(transaction)
        .input("Email", sql.NVarChar(255), email)
        .input("ResetTokenHash", sql.NVarChar(64), resetTokenHash)
        .query(`
          SELECT TOP 1 r.Id, r.UserID
          FROM dbo.password_reset_codes r
          INNER JOIN User_tbl u ON u.UserID = r.UserID
          WHERE r.Email = @Email
            AND r.ResetTokenHash = @ResetTokenHash
            AND r.UsedAt IS NULL
            AND r.VerifiedAt IS NOT NULL
            AND r.ExpiresAt > SYSUTCDATETIME()
            AND LOWER(ISNULL(u.Role, 'customer')) NOT IN ('admin', 'owner')
          ORDER BY r.VerifiedAt DESC
        `);
      const resetRows = normalizeResult(resetResult);
      if (!resetRows.length) {
        await transaction.rollback();
        return res.status(400).json({ error: "Your password reset session is invalid or expired" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const passwordResult = await new sql.Request(transaction)
        .input("UserID", sql.Int, resetRows[0].UserID)
        .input("PasswordHash", sql.NVarChar(255), passwordHash)
        .query(`
          UPDATE User_tbl
          SET PasswordHash = @PasswordHash
          OUTPUT INSERTED.UserID
          WHERE UserID = @UserID
            AND LOWER(ISNULL(Role, 'customer')) NOT IN ('admin', 'owner')
        `);
      if (!normalizeResult(passwordResult).length) {
        await transaction.rollback();
        return res.status(400).json({ error: "Your password reset session is invalid or expired" });
      }

      await new sql.Request(transaction)
        .input("UserID", sql.Int, resetRows[0].UserID)
        .query(`
          UPDATE dbo.password_reset_codes SET UsedAt = SYSUTCDATETIME() WHERE UserID = @UserID AND UsedAt IS NULL;
          UPDATE [Security].[AuthSessions]
          SET [revoked_at] = COALESCE([revoked_at], SYSUTCDATETIME()), [revocation_reason] = N'password_reset'
          WHERE [user_id] = @UserID AND [revoked_at] IS NULL;
        `);

      await transaction.commit();
      return res.json({ ok: true, message: "Password updated successfully" });
    } catch (transactionError) {
      try { await transaction.rollback(); } catch (_rollbackError) {}
      throw transactionError;
    }
  } catch (err) {
    console.error("/api/password-reset/reset error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Unable to reset your password" });
  }
});

// GOOGLE OAUTH
router.get("/api/auth/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: "Google sign-in is not configured" });
  }

  try {
    const state = crypto.randomBytes(32).toString("hex");
    const redirectUri = getGoogleRedirectUri(req);
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();

    res.cookie(GOOGLE_STATE_COOKIE_NAME, state, googleStateCookieOptions());
    return res.redirect(302, authorizationUrl.toString());
  } catch (err) {
    console.error("/api/auth/google setup error:", err);
    return res.redirect(302, googleErrorRedirect(req, "google_unavailable"));
  }
});

router.get("/api/auth/google/callback", async (req, res) => {
  const state = req.query?.state;
  const savedState = req.cookies?.[GOOGLE_STATE_COOKIE_NAME];
  res.clearCookie(GOOGLE_STATE_COOKIE_NAME, googleStateCookieOptions(0));

  if (req.query?.error) {
    return res.redirect(302, googleErrorRedirect(req, "google_cancelled"));
  }
  if (!hasMatchingOAuthState(savedState, state) || !req.query?.code) {
    return res.redirect(302, googleErrorRedirect(req, "google_invalid_state"));
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(302, googleErrorRedirect(req, "google_unavailable"));
  }

  try {
    const profile = await exchangeGoogleCode(String(req.query.code), getGoogleRedirectUri(req));
    const pool = await getPool();
    const user = await findOrCreateGoogleUser(pool, profile, getRequestIp(req));
    if (user.isNew) {
      await sendNewCustomerEmails({ pool, userId: user.id, email: user.email, name: profile.name || "", emailMarketing: false });
    }
    if (!JWT_SECRET) {
      throw new Error("Server misconfiguration: auth secret not configured");
    }

    const { token } = await issueSession(pool, { sub: user.id, email: user.email, role: user.role }, req);
    await mergeGuestCartAfterLogin(req, res, pool, user.id);
    res.cookie(CUSTOMER_AUTH_COOKIE_NAME, token, authCookieOptions());
    res.clearCookie(ADMIN_AUTH_COOKIE_NAME, clearCookieOptions());
    res.clearCookie(LEGACY_AUTH_COOKIE_NAME, clearCookieOptions());
    return res.redirect(302, `${getFrontendOrigin(req)}/account`);
  } catch (err) {
    console.error("/api/auth/google/callback error:", err && err.stack ? err.stack : err);
    const errorCode = /administrator accounts/i.test(err?.message || "")
      ? "google_admin_not_allowed"
      : "google_signin_failed";
    return res.redirect(302, googleErrorRedirect(req, errorCode));
  }
});

// LOGIN
async function handleLogin(req, res, expectedRoleOverride = null) {
  const { email, password, expectedRole } = req.body || {};
  const desiredRole = expectedRoleOverride || expectedRole;
  const clientIp = getRequestIp(req);
  const normalizedEmail = normalizeResetEmail(email);

  if (!isValidEmail(normalizedEmail) || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "A valid email and password are required" });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("Email", sql.NVarChar(255), normalizedEmail)
      .query(`SELECT TOP 1 * FROM User_tbl WHERE Email = @Email`);

    const rows = normalizeResult(result);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const normalizedRole = normalizeRole(user.Role);
    const normalizedDesiredRole = desiredRole ? String(desiredRole).toLowerCase() : null;
    const validDesiredRole = !normalizedDesiredRole || ["owner", "admin", "customer", "user"].includes(normalizedDesiredRole);
    const roleAllowed = normalizedDesiredRole === "owner"
      ? normalizedRole === "owner"
      : normalizedDesiredRole === "admin"
        ? isStaffRole(normalizedRole)
        : true;
    if (!validDesiredRole || !roleAllowed) {
      return res.status(403).json({ error: "Role not permitted for this login" });
    }

    // An administrator may also use the customer portal. The resulting JWT is
    // deliberately customer-scoped even though it belongs to the admin's
    // account, so it cannot be used to call admin APIs.
    const sessionRole = ["user", "customer"].includes(normalizedDesiredRole)
      ? "customer"
      : isStaffRole(normalizedRole)
        ? normalizedRole
        : "customer";

    // Update last login info, guard IP column presence
    const setClauses = ["LastLogin = GETDATE()"];
    let updateReq = pool.request().input("UserId", sql.Int, user.UserID);
    if (clientIp && (await hasUserColumn(pool, "lastip"))) {
      setClauses.push("LastIP = @LastIp");
      updateReq = updateReq.input("LastIp", sql.NVarChar, clientIp);
    }
    if (setClauses.length) {
      await updateReq.query(`UPDATE User_tbl SET ${setClauses.join(", ")} WHERE UserID = @UserId`);
    }

    // Ensure JWT secret is configured
    if (!JWT_SECRET) {
        console.error('/api/login error: JWT_SECRET is not set');
      return res.status(500).json({ error: 'Server misconfiguration: auth secret not configured' })
    }

    // Sign JWT (use the actual PK column name)
    if (sessionRole === "customer") {
      await mergeGuestCartAfterLogin(req, res, pool, user.UserID);
    }

    const { token } = await issueSession(pool, {
      sub: user.UserID,
      email: user.Email,
      role: sessionRole,
      accountRole: normalizedRole,
    }, req);

  const sessionCookieName = isStaffRole(sessionRole)
    ? ADMIN_AUTH_COOKIE_NAME
    : CUSTOMER_AUTH_COOKIE_NAME;
  res.cookie(sessionCookieName, token, authCookieOptions());
  // Keep the staff and customer portal sessions separate so staff can use both portals.
  res.clearCookie(LEGACY_AUTH_COOKIE_NAME, clearCookieOptions());
  // For SPA clients, return JSON rather than performing a server-side redirect.
  res.status(200).json({ message: 'Logged in', role: sessionRole });
} catch (err) {
      console.error("/api/login error:", err && err.stack ? err.stack : err);
      res.status(500).json({ error: "Login failed" });
  }
}

router.post("/api/login", async (req, res) => {
  return handleLogin(req, res, null);
});

router.post("/api/login/admin", async (req, res) => {
  return handleLogin(req, res, "admin");
});

router.post("/api/login/user", async (req, res) => {
  return handleLogin(req, res, "user");
});
router.post("/api/logout", async (req, res) => {
  const sessionType = String(req.query?.role || "customer").toLowerCase();
  const cookieName = sessionType === "admin" ? ADMIN_AUTH_COOKIE_NAME : CUSTOMER_AUTH_COOKIE_NAME;
  try {
    const token = tokenFromRequest(req, sessionType === "admin" ? "admin" : "customer");
    if (token) await revokeToken(await getPool(), token, "logout");
  } catch (error) {
    await recordSecurityEvent({ eventType: "auth.logout_revocation_failed", severity: "high", metadata: { code: String(error?.code || "database_error") } });
    if (process.env.NODE_ENV === "production") return res.status(503).json({ error: "Session could not be revoked" });
  }
  res.clearCookie(cookieName, clearCookieOptions());
  res.clearCookie(LEGACY_AUTH_COOKIE_NAME, clearCookieOptions());
  return res.json({ ok: true });
});

router.get("/api/session/validate", async (req, res) => {
  const sessionType = String(req.query?.role || "customer").toLowerCase() === "admin" ? "admin" : "customer";
  const auth = await authenticateRequest(req, sessionType);
  if (!auth) return res.status(401).json({ valid: false });
  return res.json({ valid: true, user: { id: auth.decoded.sub, email: auth.decoded.email, role: auth.decoded.role, jti: auth.decoded.jti } });
});

router.get("/api/session", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const profile = await loadUserProfile(pool, req.user.id, req.user.email);
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        name: profile?.name || null,
        username: profile?.username || req.user.email?.split("@")?.[0] || "member",
        createdAt: profile?.createdAt || null,
        lastLogin: profile?.lastLogin || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Session lookup failed" });
  }
});

router.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const profile = await loadUserProfile(pool, req.user.id, req.user.email);
    const fallback = {
      id: req.user.id,
      email: req.user.email,
      name: null,
      username: req.user.email?.split("@")?.[0] || "member",
      role: req.user.role,
      createdAt: null,
      lastLogin: null,
    };
    res.json(profile ? { ...profile, role: req.user.role } : fallback);
  } catch (err) {
    res.status(500).json({ error: "Profile lookup failed" });
  }
});

router.put("/api/profile/name", requireAuth, async (req, res) => {
  const { username } = req.body || {};
  const trimmed = typeof username === "string" ? username.trim() : "";
  if (!trimmed) {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const pool = await getPool();
    const hasUsername = await hasUserColumn(pool, "Username");
    if (!hasUsername) {
      return res.status(400).json({ error: "Username column not available" });
    }

    await pool
      .request()
      .input("Username", sql.NVarChar, trimmed)
      .input("UserId", sql.Int, Number(req.user.id))
      .query("UPDATE User_tbl SET Username = @Username WHERE UserID = @UserId");

    const updated = await loadUserProfile(pool, req.user.id, req.user.email);
    res.json(updated || { username: trimmed });
  } catch (err) {
    console.error("/api/profile/name update error:", err);
    res.status(500).json({ error: "Unable to update username" });
  }
});

router.get("/api/account/details", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const details = await loadCustomerAccountDetails(pool, req.user.id, req.user.email);
    res.json(details);
  } catch (err) {
    console.error("/api/account/details error:", err);
    res.status(500).json({ error: "Unable to load account details" });
  }
});

router.put("/api/account/profile", requireAuth, async (req, res) => {
  const name = cleanAccountValue(req.body?.name || req.body?.username, 100);
  const email = normalizeAccountEmail(req.body?.email);
  const phone = cleanAccountValue(req.body?.phone, 40);
  if (!name || !email) return res.status(400).json({ error: "A valid name and email are required" });

  try {
    const pool = await getPool();
    await ensureCustomerAccountTables(pool);
    const current = await loadCustomerAccountDetails(pool, req.user.id, req.user.email);
    if (email !== String(current.profile.email || req.user.email || "").toLowerCase()) {
      const existing = await findUserByEmail(pool, email);
      if (existing && Number(existing.UserID) !== Number(req.user.id)) {
        return res.status(409).json({ error: "That email address is already in use" });
      }
    }

    await updateLegacyUser(pool, req.user.id, { username: name, fullName: name, email });
    await pool.request()
      .input("UserId", sql.Int, Number(req.user.id))
      .input("Phone", sql.NVarChar(40), phone)
      .query(`
        UPDATE dbo.CustomerAccountProfile SET Phone = @Phone, UpdatedAt = SYSUTCDATETIME() WHERE UserID = @UserId;
        IF @@ROWCOUNT = 0 INSERT INTO dbo.CustomerAccountProfile (UserID, Phone) VALUES (@UserId, @Phone);
      `);

    if (email !== String(req.user.email || "").toLowerCase()) {
      if (!JWT_SECRET) return res.status(500).json({ error: "Server authentication is not configured" });
      await revokeAllUserSessions(pool, req.user.id, "email_changed");
      const { token } = await issueSession(pool, { sub: req.user.id, email, role: req.user.role }, req);
      res.cookie(CUSTOMER_AUTH_COOKIE_NAME, token, authCookieOptions());
    }

    res.json((await loadCustomerAccountDetails(pool, req.user.id, email)).profile);
  } catch (err) {
    console.error("/api/account/profile update error:", err);
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "That email address is already in use" });
    res.status(500).json({ error: "Unable to update account details" });
  }
});

router.put("/api/account/preferences", requireAuth, async (req, res) => {
  if (typeof req.body?.emailMarketing !== "boolean") {
    return res.status(400).json({ error: "Email preference must be true or false" });
  }

  try {
    const pool = await getPool();
    await ensureCustomerAccountTables(pool);
    const previousResult = await pool.request()
      .input("UserId", sql.Int, Number(req.user.id))
      .query("SELECT TOP 1 EmailMarketing FROM dbo.CustomerAccountProfile WHERE UserID = @UserId");
    const previouslyOptedIn = Boolean(normalizeResult(previousResult)[0]?.EmailMarketing);
    await pool.request()
      .input("UserId", sql.Int, Number(req.user.id))
      .input("EmailMarketing", sql.Bit, req.body.emailMarketing)
      .query(`
        UPDATE dbo.CustomerAccountProfile SET EmailMarketing = @EmailMarketing, UpdatedAt = SYSUTCDATETIME() WHERE UserID = @UserId;
        IF @@ROWCOUNT = 0 INSERT INTO dbo.CustomerAccountProfile (UserID, EmailMarketing) VALUES (@UserId, @EmailMarketing);
      `);
    const details = await loadCustomerAccountDetails(pool, req.user.id, req.user.email);
    if (!previouslyOptedIn && req.body.emailMarketing === true) {
      await queueJourneyEvent({
        pool,
        userId: req.user.id,
        email: req.user.email,
        name: details.profile?.fullName || details.profile?.username || "Customer",
        eventType: "email_opt_in",
        eventKey: `email-opt-in:${req.user.id}:${Date.now()}`,
        marketingConsent: true,
      });
      await runCustomerEmailAutomationOnce({ pool });
    }
    res.json(details.preferences);
  } catch (err) {
    console.error("/api/account/preferences update error:", err);
    res.status(500).json({ error: "Unable to update email preferences" });
  }
});

router.post("/api/account/password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Current and new passwords are required" });
  if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ error: "Your new password must be between 8 and 128 characters" });
  if (currentPassword === newPassword) return res.status(400).json({ error: "Your new password must be different" });

  try {
    const pool = await getPool();
    const currentHash = await getCurrentPasswordHash(pool, req.user.id);
    if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
      return res.status(400).json({ error: "Your current password is not correct" });
    }
    await updatePasswordHash(pool, req.user.id, await bcrypt.hash(newPassword, 12));
    await revokeAllUserSessions(pool, req.user.id, "password_changed");
    const { token } = await issueSession(pool, { sub: req.user.id, email: req.user.email, role: "user" }, req);
    res.cookie(CUSTOMER_AUTH_COOKIE_NAME, token, authCookieOptions());
    res.json({ ok: true });
  } catch (err) {
    console.error("/api/account/password update error:", err);
    res.status(500).json({ error: "Unable to change password" });
  }
});

router.get("/api/account/addresses", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const details = await loadCustomerAccountDetails(pool, req.user.id, req.user.email);
    res.json({ addresses: details.addresses });
  } catch (err) {
    console.error("/api/account/addresses lookup error:", err);
    res.status(500).json({ error: "Unable to load addresses" });
  }
});

router.post("/api/account/addresses", requireAuth, async (req, res) => {
  const address = normalizeAddressInput(req.body);
  if (!validateAddressInput(address)) return res.status(400).json({ error: "Please complete the required address fields" });

  try {
    const pool = await getPool();
    await ensureCustomerAccountTables(pool);
    const countResult = await pool.request()
      .input("UserId", sql.Int, Number(req.user.id))
      .input("AddressType", sql.NVarChar(20), address.addressType)
      .query("SELECT COUNT(1) AS Count FROM dbo.CustomerAccountAddresses WHERE UserID = @UserId AND AddressType = @AddressType");
    const isDefault = address.isDefault || Number(normalizeResult(countResult)[0]?.Count || 0) === 0;
    if (isDefault) {
      await pool.request()
        .input("UserId", sql.Int, Number(req.user.id))
        .input("AddressType", sql.NVarChar(20), address.addressType)
        .query("UPDATE dbo.CustomerAccountAddresses SET IsDefault = 0 WHERE UserID = @UserId AND AddressType = @AddressType");
    }

    const result = await pool.request()
      .input("UserId", sql.Int, Number(req.user.id))
      .input("AddressType", sql.NVarChar(20), address.addressType)
      .input("Label", sql.NVarChar(80), address.label)
      .input("FirstName", sql.NVarChar(120), address.firstName)
      .input("LastName", sql.NVarChar(120), address.lastName)
      .input("Company", sql.NVarChar(200), address.company)
      .input("Phone", sql.NVarChar(40), address.phone)
      .input("AddressLine1", sql.NVarChar(255), address.addressLine1)
      .input("AddressLine2", sql.NVarChar(255), address.addressLine2)
      .input("City", sql.NVarChar(120), address.city)
      .input("StateProvince", sql.NVarChar(120), address.stateProvince)
      .input("PostalCode", sql.NVarChar(30), address.postalCode)
      .input("Country", sql.NVarChar(100), address.country)
      .input("IsDefault", sql.Bit, isDefault)
      .query(`
        INSERT INTO dbo.CustomerAccountAddresses
          (UserID, AddressType, Label, FirstName, LastName, Company, Phone, AddressLine1, AddressLine2, City, StateProvince, PostalCode, Country, IsDefault)
        OUTPUT INSERTED.*
        VALUES
          (@UserId, @AddressType, @Label, @FirstName, @LastName, @Company, @Phone, @AddressLine1, @AddressLine2, @City, @StateProvince, @PostalCode, @Country, @IsDefault)
      `);
    res.status(201).json({ address: mapAccountAddress(normalizeResult(result)[0]) });
  } catch (err) {
    console.error("/api/account/addresses create error:", err);
    res.status(500).json({ error: "Unable to save address" });
  }
});

router.put("/api/account/addresses/:addressId", requireAuth, async (req, res) => {
  const addressId = String(req.params.addressId || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(addressId)) return res.status(400).json({ error: "Invalid address" });
  const address = normalizeAddressInput(req.body);
  if (!validateAddressInput(address)) return res.status(400).json({ error: "Please complete the required address fields" });

  try {
    const pool = await getPool();
    await ensureCustomerAccountTables(pool);
    const existingResult = await pool.request()
      .input("AddressId", sql.UniqueIdentifier, addressId)
      .input("UserId", sql.Int, Number(req.user.id))
      .query("SELECT TOP 1 AddressType FROM dbo.CustomerAccountAddresses WHERE Id = @AddressId AND UserID = @UserId");
    const existingAddressType = normalizeResult(existingResult)[0]?.AddressType;
    if (!existingAddressType) return res.status(404).json({ error: "Address not found" });

    if (address.isDefault) {
      await pool.request()
        .input("UserId", sql.Int, Number(req.user.id))
        .input("AddressType", sql.NVarChar(20), address.addressType)
        .query("UPDATE dbo.CustomerAccountAddresses SET IsDefault = 0 WHERE UserID = @UserId AND AddressType = @AddressType");
    }

    const result = await pool.request()
      .input("AddressId", sql.UniqueIdentifier, addressId)
      .input("UserId", sql.Int, Number(req.user.id))
      .input("AddressType", sql.NVarChar(20), address.addressType)
      .input("Label", sql.NVarChar(80), address.label)
      .input("FirstName", sql.NVarChar(120), address.firstName)
      .input("LastName", sql.NVarChar(120), address.lastName)
      .input("Company", sql.NVarChar(200), address.company)
      .input("Phone", sql.NVarChar(40), address.phone)
      .input("AddressLine1", sql.NVarChar(255), address.addressLine1)
      .input("AddressLine2", sql.NVarChar(255), address.addressLine2)
      .input("City", sql.NVarChar(120), address.city)
      .input("StateProvince", sql.NVarChar(120), address.stateProvince)
      .input("PostalCode", sql.NVarChar(30), address.postalCode)
      .input("Country", sql.NVarChar(100), address.country)
      .input("IsDefault", sql.Bit, address.isDefault)
      .query(`
        UPDATE dbo.CustomerAccountAddresses
        SET AddressType = @AddressType, Label = @Label, FirstName = @FirstName, LastName = @LastName, Company = @Company,
            Phone = @Phone, AddressLine1 = @AddressLine1, AddressLine2 = @AddressLine2, City = @City, StateProvince = @StateProvince,
            PostalCode = @PostalCode, Country = @Country, IsDefault = @IsDefault, UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE Id = @AddressId AND UserID = @UserId
      `);
    await ensureAddressDefault(pool, req.user.id, address.addressType);
    if (existingAddressType !== address.addressType) await ensureAddressDefault(pool, req.user.id, existingAddressType);
    res.json({ address: mapAccountAddress(normalizeResult(result)[0]) });
  } catch (err) {
    console.error("/api/account/addresses update error:", err);
    res.status(500).json({ error: "Unable to update address" });
  }
});

router.delete("/api/account/addresses/:addressId", requireAuth, async (req, res) => {
  const addressId = String(req.params.addressId || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(addressId)) return res.status(400).json({ error: "Invalid address" });

  try {
    const pool = await getPool();
    await ensureCustomerAccountTables(pool);
    const existingResult = await pool.request()
      .input("AddressId", sql.UniqueIdentifier, addressId)
      .input("UserId", sql.Int, Number(req.user.id))
      .query("SELECT TOP 1 AddressType FROM dbo.CustomerAccountAddresses WHERE Id = @AddressId AND UserID = @UserId");
    const existing = normalizeResult(existingResult)[0];
    if (!existing) return res.status(404).json({ error: "Address not found" });

    await pool.request()
      .input("AddressId", sql.UniqueIdentifier, addressId)
      .input("UserId", sql.Int, Number(req.user.id))
      .query("DELETE FROM dbo.CustomerAccountAddresses WHERE Id = @AddressId AND UserID = @UserId");
    await ensureAddressDefault(pool, req.user.id, existing.AddressType);
    res.json({ ok: true });
  } catch (err) {
    console.error("/api/account/addresses delete error:", err);
    res.status(500).json({ error: "Unable to remove address" });
  }
});

router.post("/api/account/checkout-details", requireAuth, async (req, res) => {
  const requestedShippingMethod = normalizeShippingServiceName(req.body?.shipping?.logisticName || req.body?.shipping?.method);

  // The account email comes from the authenticated session, not the browser
  // payload. Checkout may use a separate contact email for an order, but it
  // must not be able to change which account owns these saved details.
  const checkoutDetails = normalizeCheckoutDetails(req.body, String(req.user.email || "").trim().toLowerCase(), requestedShippingMethod);
  if (!checkoutDetails) {
    return res.status(400).json({ error: "Complete customer and shipping information before saving" });
  }

  try {
    const pool = await getPool();
    await saveCheckoutDetailsForCustomer(pool, req.user, checkoutDetails);
    res.json({ ok: true });
  } catch (err) {
    console.error("/api/account/checkout-details save error:", err);
    res.status(500).json({ error: "Unable to save checkout details" });
  }
});

router.get("/api/orders", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const orders = await loadOrdersForUser(pool, String(req.user.id));
    res.json({ orders });
  } catch (err) {
    console.error("/api/orders error", err);
    res.status(500).json({ error: "Unable to load orders" });
  }
});

router.get("/api/orders/track/:orderId", requireCheckoutIdentity, async (req, res) => {
  try {
    const pool = await getPool();
    const order = await loadOrderById(pool, req.checkoutUserId, req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    let syncedOrder = order;
    let sync = { provider: "cj", configured: cjTrackingConfigured(), checkedAt: new Date().toISOString() };
    try {
      const result = await syncCjTrackingForOrder(pool, req.checkoutUserId, order);
      syncedOrder = result.order || order;
      sync = result.sync || sync;
    } catch (error) {
      console.warn("CJ tracking sync failed", error?.name || "unknown_error");
    }
    const tracking = await loadOrderTracking(pool, req.checkoutUserId, syncedOrder);
    res.json({ order: { ...syncedOrder, tracking: { ...tracking, sync } } });
  } catch (err) {
    console.error("/api/orders/track error", err);
    res.status(500).json({ error: "Unable to track order" });
  }
});

router.post("/api/payment/create", requireCheckoutIdentity, async (req, res) => {
  const userId = req.checkoutUserId;
  const provider = getPaymentProviderConfig();
  if (!provider.configured) {
    return res.status(503).json({ error: "Payment provider is not configured. Checkout is temporarily unavailable." });
  }

  const method = req.body?.method === "card" ? "card" : null;
  if (!method) return res.status(400).json({ error: "Unsupported payment method" });

  let checkoutPool;
  let cart;
  let cartState;
  try {
    checkoutPool = await getPool();
    cartState = await loadCartState(checkoutPool, userId);
    cart = cartState.cart;
    if (!cart.length) return res.status(400).json({ error: "Cart is empty" });
    const refreshed = await refreshCartForCheckout(checkoutPool, userId);
    if (refreshed.missing.length) {
      return res.status(409).json({ error: "Your cart contains products that are no longer available", productIds: refreshed.missing });
    }
    cart = refreshed.cart;
  } catch (error) {
    console.error("/api/payment/create cart refresh error", error);
    return res.status(503).json({ error: "Checkout is temporarily unavailable" });
  }

  const subtotal = roundCurrency(cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0));
  const requestedShippingMethod = normalizeShippingServiceName(req.body?.shippingMethod || req.body?.checkoutDetails?.shipping?.logisticName);
  if (!requestedShippingMethod) return res.status(400).json({ error: "Choose a shipping service before payment" });
  const sessionCoupon = cartState.coupon;
  const requestedCouponCode = normalizeCouponCode(req.body?.couponCode || sessionCoupon?.code);
  const currency = checkoutCurrency();
  if (req.body?.currency && String(req.body.currency).trim().toUpperCase() !== currency) {
    return res.status(400).json({ error: `Checkout currency must be ${currency}` });
  }
  const customerEmail = String(req.body?.customerEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({ error: "A valid checkout email is required" });
  }
  let checkoutDetails = normalizeCheckoutDetails(req.body?.checkoutDetails, customerEmail, requestedShippingMethod);
  if (!checkoutDetails) {
    return res.status(400).json({ error: "Complete customer and shipping information before starting payment" });
  }

  let selectedShipping;
  try {
    const estimates = await quoteCjShippingForCart(checkoutPool, cart, checkoutDetails.shipping);
    selectedShipping = selectCjShippingOption(estimates, requestedShippingMethod);
    if (!selectedShipping) {
      return res.status(409).json({ error: "That shipping service is no longer available. Choose another option.", estimates });
    }
  } catch (error) {
    console.error("/api/payment/create shipping quote error", {
      message: error?.message || String(error),
      statusCode: error?.statusCode || null,
      code: error?.code || null,
      providerMessage: error?.providerMessage || null,
      path: error?.path || null,
    });
    return res.status(422).json({ error: "Unable to verify shipping for this cart and destination" });
  }
  const shippingMethod = selectedShipping.logisticName;
  const shippingAmount = roundCurrency(selectedShipping.cost);
  checkoutDetails = {
    ...checkoutDetails,
    shipping: {
      ...checkoutDetails.shipping,
      method: shippingMethod,
      logisticName: shippingMethod,
      label: selectedShipping.label,
      window: selectedShipping.window,
      cost: shippingAmount,
      fromCountryCode: selectedShipping.fromCountryCode,
      quotedAt: new Date().toISOString(),
    },
  };

  if (req.user?.id) {
    try {
      await saveCheckoutDetailsForCustomer(checkoutPool, req.user, checkoutDetails);
    } catch (error) {
      console.error("Unable to save customer checkout details", error);
      return res.status(503).json({ error: "Unable to save your checkout details to your account. Please try again." });
    }
  }

  let durableCheckout = null;
  try {
    let coupon = null;
    if (requestedCouponCode) {
      coupon = await findCouponByCode(checkoutPool, requestedCouponCode);
      if (!coupon) {
        await mutateCartState(checkoutPool, userId, (state) => ({ ...state, coupon: null }));
        return res.status(400).json({ error: "That promo code is not valid" });
      }
      if (!couponIsUsable(coupon)) {
        await mutateCartState(checkoutPool, userId, (state) => ({ ...state, coupon: null }));
        return res.status(400).json({ error: coupon.status === "Expired" ? "That promo code has expired" : "That promo code is inactive" });
      }
      if (await hasCouponBeenRedeemed(checkoutPool, coupon, { userId, customerEmail })) {
        await mutateCartState(checkoutPool, userId, (state) => ({ ...state, coupon: null }));
        return res.status(400).json({ error: "That promo code has already been used by this customer" });
      }
      await mutateCartState(checkoutPool, userId, (state) => ({ ...state, coupon: { code: coupon.code, discountPercent: coupon.discountPercent, expiresAt: coupon.expiresAt } }));
    }
    const discountAmount = calculateCouponDiscount(subtotal, coupon);
    const amount = Math.max(0, subtotal + shippingAmount - discountAmount);
    durableCheckout = await createDurableCheckout(checkoutPool, {
      userId, cart, amount, currency, customerEmail, shippingMethod, shippingAmount, subtotal, discountAmount,
      couponCode: coupon?.code || null, checkoutDetails,
    });
    const session = await stripeRequest("/checkout/sessions", buildStripeCheckoutBody({
      checkoutId: durableCheckout.id,
      checkoutExpiresAt: durableCheckout.providerExpiresAt,
      userId,
      cart,
      amount,
      currency,
      customerEmail,
      shippingMethod,
      shippingAmount,
      shippingLabel: selectedShipping.label,
      discountAmount,
      couponCode: coupon?.code || "",
      discountPercent: coupon?.discountPercent || 0,
    }));
    if (!session.id || !session.url) {
      throw new Error("Stripe did not return a hosted checkout URL");
    }
    await activateDurableCheckout(checkoutPool, durableCheckout.id, session.id);

    const payment = {
      id: session.id,
      provider: "stripe",
      providerSessionId: session.id,
      checkoutId: durableCheckout.id,
      userId,
      amount,
      subtotal,
      discountAmount,
      couponCode: coupon?.code || null,
      discountPercent: coupon?.discountPercent || 0,
      currency,
      method,
      shippingMethod,
      customerEmail,
      checkoutUrl: session.url,
      status: "requires_payment",
      createdAt: new Date().toISOString(),
    };
    await recordCheckoutAttempt({
      attemptId: payment.id,
      paymentId: payment.id,
      userId,
      cartId: userId,
      customerEmail: payment.customerEmail,
      status: "payment_created",
    });
    return res.json({ ok: true, payment });
  } catch (error) {
    console.error("/api/payment/create error", error);
    if (durableCheckout?.id) await releaseDurableCheckout(checkoutPool, durableCheckout.id).catch((releaseError) => console.error("checkout reservation release failed", releaseError));
    if (Number(error?.number) === 50002) return res.status(409).json({ error: "One or more items no longer have enough stock" });
    if (Number(error?.number) === 50001) return res.status(503).json({ error: "Product inventory is not ready for checkout" });
    return res.status(502).json({ error: "Unable to start secure payment checkout" });
  }
});

router.post("/api/payment/confirm", requireCheckoutIdentity, async (req, res) => {
  const userId = req.checkoutUserId;
  const paymentId = String(req.body?.paymentId || "");
  const provider = getPaymentProviderConfig();
  if (!provider.configured) {
    return res.status(503).json({ error: "Payment provider is not configured. Checkout is temporarily unavailable." });
  }
  if (!paymentId) return res.status(400).json({ error: "Payment session is required" });

  try {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(paymentId)}`);
    const sessionUserId = String(session.metadata?.user_id || "");
    if (sessionUserId !== String(userId)) {
      return res.status(403).json({ error: "Payment session does not belong to this checkout" });
    }
    const checkoutPool = await getPool();
    const durable = await loadDurableCheckout(checkoutPool, userId, paymentId);
    if (!durable || String(session.metadata?.checkout_id || "").toLowerCase() !== String(durable.id).toLowerCase()) {
      return res.status(404).json({ error: "Durable checkout session was not found" });
    }
    if (String(session.currency || "").toUpperCase() !== String(durable.currency).toUpperCase()) {
      return res.status(409).json({ error: "Payment currency does not match the checkout" });
    }

    const payment = {
        id: paymentId,
        provider: "stripe",
        providerSessionId: paymentId,
        userId,
        checkoutId: durable.id,
        amount: Number(durable.total_amount),
        subtotal: Number(durable.subtotal_amount),
        discountAmount: Number(durable.discount_amount),
        couponCode: normalizeCouponCode(durable.coupon_code || "") || null,
        discountPercent: Math.max(0, Number(session.metadata?.discount_percent || 0)),
        currency: String(durable.currency).toUpperCase(),
        method: "card",
        shippingMethod: durable.shipping_method,
        customerEmail: durable.customer_email,
        cartSnapshot: JSON.parse(durable.cart_json),
        status: "requires_payment",
        createdAt: new Date().toISOString(),
      };

    if (Number(session.amount_total || 0) !== Math.round(Number(durable.total_amount) * 100)) {
      return res.status(409).json({ error: "Payment amount does not match the current checkout" });
    }
    if (session.payment_status !== "paid") {
      await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: payment.customerEmail, status: "payment_pending", paymentError: "Stripe payment has not been completed" });
      return res.status(402).json({ error: "Payment has not been completed" });
    }

    payment.status = "succeeded";
    payment.confirmedAt = new Date().toISOString();
    await markDurableCheckoutPaid(checkoutPool, durable.id);
    await recordCheckoutAttempt({
      attemptId: payment.id,
      paymentId: payment.id,
      userId,
      cartId: userId,
      customerEmail: payment.customerEmail,
      status: "payment_confirmed",
    });
    return res.json({ ok: true, payment });
  } catch (error) {
    console.error("/api/payment/confirm error", error);
    return res.status(502).json({ error: "Unable to verify payment with the provider" });
  }
});

router.post("/api/orders/create", requireCheckoutIdentity, async (req, res) => {
  const userId = req.checkoutUserId;
  const paymentId = String(req.body?.paymentId || "");
  let checkoutPool;
  let durable;
  let cart;
  try {
    checkoutPool = await getPool();
    durable = await loadDurableCheckout(checkoutPool, userId, paymentId);
    if (!durable) return res.status(404).json({ error: "Checkout session was not found" });
    if (durable.order_id) {
      const existingOrder = await loadOrderById(checkoutPool, userId, durable.order_id);
      if (!existingOrder) return res.status(409).json({ error: "Checkout already has an order" });

      let fulfilledOrder = existingOrder;
      let fulfillment = { enabled: cjFulfillmentEnabled(), submitted: false };
      if (cjFulfillmentEnabled()) {
        try {
          const result = await submitCjOrderForFulfillment(checkoutPool, userId, existingOrder);
          fulfilledOrder = result.order;
          fulfillment = result.fulfillment;
        } catch (error) {
          console.error("CJ fulfillment retry failed", cjSubmissionFailureMessage(error));
          await markCjFulfillmentFailed(checkoutPool, userId, existingOrder.id, error).catch(() => {});
          await notifyOwnerCjFailure(existingOrder, error, "CJ fulfillment retry");
          fulfillment = { enabled: true, submitted: false };
        }
      }
      const existingAddress = existingOrder.shippingAddress || {};
      await queueJourneyEvent({
        pool: checkoutPool,
        userId,
        email: existingAddress.email,
        name: existingAddress.fullName,
        eventType: "payment_confirmed",
        eventKey: `payment-confirmed:${existingOrder.id}`,
        orderId: existingOrder.id,
      }).catch((error) => console.warn("Unable to schedule order confirmation email:", error?.message || error));
      void runCustomerEmailAutomationOnce({ pool: checkoutPool }).catch((error) => console.warn("Unable to deliver order confirmation email:", error?.message || error));
      return res.json({ ok: true, order: fulfilledOrder, fulfillment, idempotent: true });
    }
    if (durable.payment_status !== "Paid") return res.status(402).json({ error: "Payment webhook confirmation is required before creating the order" });
    cart = JSON.parse(durable.cart_json);
    if (!Array.isArray(cart) || !cart.length) throw new Error("Durable checkout cart is invalid");
  } catch (error) {
    console.error("/api/orders/create durable checkout error", error);
    return res.status(503).json({ error: "Checkout is temporarily unavailable" });
  }

  const payment = {
    id: paymentId,
    checkoutId: durable.id,
    provider: "stripe",
    status: "succeeded",
    amount: Number(durable.total_amount),
    subtotal: Number(durable.subtotal_amount),
    discountAmount: Number(durable.discount_amount),
    couponCode: durable.coupon_code || null,
    currency: durable.currency,
    method: "card",
    shippingMethod: durable.shipping_method,
    customerEmail: durable.customer_email,
  };
  if (req.body?.shippingMethod && req.body.shippingMethod !== payment.shippingMethod) {
    return res.status(409).json({ error: "Shipping method does not match the paid checkout" });
  }

  const persistedCheckoutDetails = parseCheckoutDetails(durable.checkout_details_json);
  const persistedInformation = persistedCheckoutDetails?.information || persistedCheckoutDetails?.customer || {};
  const persistedShipping = persistedCheckoutDetails?.shipping || persistedCheckoutDetails?.shippingAddress || {};
  const inputShipping = req.body?.shippingAddress && typeof req.body.shippingAddress === "object" ? req.body.shippingAddress : {};
  const shippingAddress = {
    fullName: String(persistedShipping.fullName || inputShipping.fullName || "").trim(),
    email: String(durable.customer_email || persistedInformation.email || inputShipping.email || "").trim(),
    phone: String(persistedInformation.phone || inputShipping.phone || "").trim(),
    addressLine1: String(persistedShipping.addressLine1 || inputShipping.addressLine1 || "").trim(),
    addressLine2: String(persistedShipping.addressLine2 || inputShipping.addressLine2 || "").trim(),
    city: String(persistedShipping.city || inputShipping.city || "").trim(),
    region: String(persistedShipping.region || inputShipping.region || "").trim(),
    postalCode: String(persistedShipping.postalCode || inputShipping.postalCode || "").trim(),
    country: String(persistedShipping.country || inputShipping.country || "").trim(),
    shippingMethod: payment.shippingMethod,
    logisticName: normalizeShippingServiceName(persistedShipping.logisticName || payment.shippingMethod),
    shippingLabel: String(persistedShipping.label || payment.shippingMethod || "Shipping").trim(),
    shippingWindow: String(persistedShipping.window || "").trim(),
    fromCountryCode: String(persistedShipping.fromCountryCode || process.env.CJ_FROM_COUNTRY_CODE || "").trim().toUpperCase(),
  };
  const missingShipping = ["fullName", "email", "phone", "addressLine1", "city", "region", "postalCode", "country"]
    .some((field) => !shippingAddress[field]);
  if (missingShipping) {
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: "Incomplete shipping and customer information" });
    return res.status(400).json({ error: "Complete shipping and customer information before creating the order" });
  }

  const subtotal = roundCurrency(cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0));
  const shipping = roundCurrency(Math.max(0, Number(durable.shipping_amount) || 0));
  const discountAmount = Math.min(subtotal, Math.max(0, Number(payment.discountAmount) || 0));
  const expectedTotal = Math.max(0, subtotal + shipping - discountAmount);
  if (Math.round(Number(payment.amount || 0) * 100) !== Math.round(expectedTotal * 100)) {
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: "Payment amount does not match the current cart" });
    return res.status(409).json({ error: "Payment amount does not match the current cart" });
  }
  if (!(await claimDurableCheckoutForOrder(checkoutPool, durable.id))) {
    return res.status(409).json({ error: "Order creation is already in progress for this checkout" });
  }
  const order = {
    id: `WLX-${String(durable.id).replace(/-/g, "").slice(0, 24).toUpperCase()}`,
    status: "Processing",
    total: expectedTotal,
    subtotal,
    discountAmount,
    couponCode: payment.couponCode || null,
    shippingAmount: shipping,
    placedAt: new Date().toISOString(),
    estimatedDelivery: addOrderDays(new Date(), shippingDeliveryDays(shippingAddress.shippingWindow)),
    items: cart.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      title: item.title,
      image: item.image || null,
      quantity: item.quantity,
      price: item.price,
      unitCost: item.buyPrice ?? item.unitCost ?? null,
    })),
    shippingAddress,
    paymentMethod: payment.method,
    paymentStatus: "paid",
  };

  try {
    const pool = checkoutPool || await getPool();
    let coupon = null;
    const couponCustomerEmail = shippingAddress.email || payment.customerEmail;
    if (payment.couponCode) {
      coupon = await findCouponByCode(pool, payment.couponCode);
      if (!coupon) {
        await releaseDurableOrderClaim(pool, durable.id);
        await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: couponCustomerEmail, status: "order_failed", paymentError: "Unable to verify coupon redemption" });
        return res.status(409).json({ error: "Unable to verify coupon redemption" });
      }
      if (await hasCouponBeenRedeemed(pool, coupon, { userId, customerEmail: couponCustomerEmail })) {
        await releaseDurableOrderClaim(pool, durable.id);
        await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: couponCustomerEmail, status: "order_failed", paymentError: "Coupon has already been used by this customer" });
        return res.status(409).json({ error: "That promo code has already been used by this customer" });
      }
    }

    const saved = await saveOrder(pool, userId, order, coupon ? {
      couponId: coupon.id,
      customerEmail: couponCustomerEmail,
    } : null);
    if (!saved || saved.saved === false) {
      await releaseDurableOrderClaim(pool, durable.id);
      await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: "Unable to save order" });
      if (saved?.couponAlreadyUsed) {
        return res.status(409).json({ error: "That promo code has already been used by this customer" });
      }
      return res.status(500).json({ error: "Unable to save order" });
    }
    let fulfilledOrder = order;
    let fulfillment = { enabled: cjFulfillmentEnabled(), submitted: false };
    if (cjFulfillmentEnabled()) {
      try {
        const result = await submitCjOrderForFulfillment(pool, userId, order);
        fulfilledOrder = result.order;
        fulfillment = result.fulfillment;
      } catch (error) {
        console.error("CJ fulfillment submission failed", cjSubmissionFailureMessage(error));
        await markCjFulfillmentFailed(pool, userId, order.id, error).catch(() => {});
        await notifyOwnerCjFailure(order, error);
        fulfillment = { enabled: true, submitted: false };
      }
    }

    await saveCanonicalOrderSnapshot(pool, userId, fulfilledOrder);
    await finishDurableCheckoutOrder(pool, durable.id, order.id);
    await queueJourneyEvent({
      pool,
      userId,
      email: shippingAddress.email || payment.customerEmail,
      name: shippingAddress.fullName,
      eventType: "payment_confirmed",
      eventAt: order.placedAt,
      eventKey: `payment-confirmed:${order.id}`,
      orderId: order.id,
    }).catch((error) => console.warn("Unable to schedule order confirmation email:", error?.message || error));
    void runCustomerEmailAutomationOnce({ pool }).catch((error) => console.warn("Unable to deliver order confirmation email:", error?.message || error));
    await notifyOwnerOrderPaid(fulfilledOrder, payment, fulfillment);
    payment.status = "consumed";
    await mutateCartState(pool, userId, (state) => ({ ...state, cart: [], coupon: null }));
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "completed" });
    res.json({ ok: true, order: fulfilledOrder, fulfillment });
  } catch (err) {
    console.error("/api/orders/create error", err);
    await releaseDurableOrderClaim(checkoutPool, durable.id).catch(() => {});
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: err.message || "Unable to create order" });
    res.status(500).json({ error: "Unable to create order" });
  }
});

router.post("/api/orders/checkout", requireCheckoutIdentity, async (req, res) => {
  return res.status(410).json({ error: "Legacy checkout is disabled. Use the secure /checkout/payment flow." });
});

router.post("/api/dashboard/checkouts/:checkoutId/refund-inventory", requireRefundsManage, async (req, res) => {
  const checkoutId = String(req.params.checkoutId || "").toLowerCase();
  const decision = req.body?.decision === "restock" ? "Restocked" : req.body?.decision === "no_restock" ? "NoRestock" : null;
  const reason = String(req.body?.reason || "").trim().slice(0, 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(checkoutId)) return res.status(400).json({ error: "Invalid checkout id" });
  if (!decision || reason.length < 5) return res.status(400).json({ error: "A refund inventory decision and reason are required" });

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const checkoutResult = await new sql.Request(transaction)
      .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
      .query(`SELECT TOP 1 [id], [order_id], [payment_status], [refund_inventory_status]
        FROM [Commerce].[SecureCheckoutSessions] WITH (UPDLOCK, HOLDLOCK) WHERE [id] = @CheckoutId`);
    const checkout = normalizeResult(checkoutResult)[0];
    if (!checkout) { await transaction.rollback(); return res.status(404).json({ error: "Checkout not found" }); }
    if (String(checkout.payment_status) !== "Refunded") { await transaction.rollback(); return res.status(409).json({ error: "Inventory decisions are only allowed for refunded checkouts" }); }

    const finalResult = await new sql.Request(transaction).input("CheckoutId", sql.UniqueIdentifier, checkoutId)
      .query("SELECT TOP 1 [decision], [reason] FROM [Commerce].[InventoryAdjustments] WITH (UPDLOCK, HOLDLOCK) WHERE [checkout_id] = @CheckoutId AND [is_final] = 1");
    const existing = normalizeResult(finalResult)[0];
    if (existing) {
      await transaction.commit();
      if (existing.decision !== decision) return res.status(409).json({ error: "A different final inventory decision already exists" });
      return res.json({ ok: true, decision, idempotent: true });
    }

    if (decision === "Restocked") {
      const fulfillmentResult = await new sql.Request(transaction)
        .input("OrderId", sql.NVarChar(64), checkout.order_id || null)
        .query("SELECT TOP 1 [FulfillmentStatus] FROM [Commerce].[Orders] WITH (UPDLOCK, HOLDLOCK) WHERE [LegacyOrderId] = @OrderId");
      const fulfillment = String(normalizeResult(fulfillmentResult)[0]?.FulfillmentStatus || "Unknown");
      if (!["Unfulfilled", "Cancelled", "Returned"].includes(fulfillment)) {
        await transaction.rollback();
        return res.status(409).json({ error: "Shipped or unknown-fulfillment inventory requires a no-restock decision or completed return workflow" });
      }
      await new sql.Request(transaction).input("CheckoutId", sql.UniqueIdentifier, checkoutId).query(`
        ;WITH quantities AS (
          SELECT [variant_id], SUM([quantity]) AS [quantity]
          FROM [Commerce].[InventoryReservations] WITH (UPDLOCK, HOLDLOCK)
          WHERE [checkout_id] = @CheckoutId AND [reservation_status] = N'Consumed'
          GROUP BY [variant_id]
        )
        UPDATE variants WITH (UPDLOCK, ROWLOCK)
        SET [AvailableQuantity] = variants.[AvailableQuantity] + quantities.[quantity], [UpdatedAt] = SYSUTCDATETIME()
        FROM [Commerce].[ProductVariants] variants
        INNER JOIN quantities ON quantities.[variant_id] = variants.[Id];
        UPDATE [Commerce].[InventoryReservations]
        SET [reservation_status] = N'Restocked', [updated_at] = SYSUTCDATETIME()
        WHERE [checkout_id] = @CheckoutId AND [reservation_status] = N'Consumed';
      `);
    }

    await new sql.Request(transaction)
      .input("CheckoutId", sql.UniqueIdentifier, checkoutId)
      .input("Decision", sql.NVarChar(30), decision)
      .input("Reason", sql.NVarChar(400), reason)
      .input("ActorUserId", sql.Int, Number(req.user.id))
      .query(`
        INSERT INTO [Commerce].[InventoryAdjustments] ([checkout_id], [decision], [is_final], [reason], [actor_user_id])
        VALUES (@CheckoutId, @Decision, 1, @Reason, @ActorUserId);
        UPDATE [Commerce].[SecureCheckoutSessions]
        SET [refund_inventory_status] = @Decision, [updated_at] = SYSUTCDATETIME()
        WHERE [id] = @CheckoutId;
      `);
    await transaction.commit();
    await recordSecurityEvent({ pool, eventType: "admin.refund_inventory_decision", severity: "high", actor: req.user.id, resourceType: "checkout", resourceId: checkoutId, metadata: { decision } });
    return res.json({ ok: true, decision, idempotent: false });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error("refund inventory decision failed", error);
    return res.status(500).json({ error: "Unable to record refund inventory decision" });
  }
});

router.get("/api/saved-products", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    if (!Number.isInteger(userId)) {
      return res.status(401).json({ error: "Invalid customer identity" });
    }

    const pool = await getPool();
    const items = await loadSavedProductsForUser(pool, userId);
    res.json({ items });
  } catch (err) {
    console.error("/api/saved-products GET error", err);
    res.status(500).json({ error: "Unable to load saved products" });
  }
});

router.post("/api/saved-products", requireAuth, async (req, res) => {
  const productId = Number(req.body?.productId ?? req.body?.id);
  const userId = Number(req.user.id);
  if (!Number.isInteger(userId) || !Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: "A valid product is required" });
  }

  try {
    const pool = await getPool();
    const product = await loadProductById(pool, productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await upsertSavedProduct(pool, userId, productId);
    const items = await loadSavedProductsForUser(pool, userId);
    res.status(201).json({ ok: true, item: { ...product, savedAt: new Date().toISOString() }, items });
  } catch (err) {
    console.error("/api/saved-products POST error", err);
    res.status(500).json({ error: "Unable to save product" });
  }
});

router.delete("/api/saved-products/:productId", requireAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  const userId = Number(req.user.id);
  if (!Number.isInteger(userId) || !Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: "A valid product is required" });
  }

  try {
    const pool = await getPool();
    const ensured = await ensureSavedProductsTable(pool);
    if (!ensured) throw new Error("Saved products storage is unavailable");
    await pool
      .request()
      .input("UserId", sql.Int, userId)
      .input("ProductId", sql.Int, productId)
      .query("DELETE FROM [dbo].[SavedProducts_tbl] WHERE UserId = @UserId AND ProductId = @ProductId");
    const items = await loadSavedProductsForUser(pool, userId);
    res.json({ ok: true, items });
  } catch (err) {
    console.error("/api/saved-products DELETE error", err);
    res.status(500).json({ error: "Unable to remove saved product" });
  }
});

async function hydrateCart(pool, cart) {
  const products = await loadProductsByIds(pool, cart.map((item) => item.productId));
  return cart.map((item) => {
    const product = products.get(Number(item.productId));
    const price = Number(product?.salePrice ?? product?.price ?? item.price) || 0;
    return {
      ...item,
      title: product?.name ?? item.title ?? "Item",
      category: product?.category ?? item.category ?? "Collection",
      brand: product?.brand ?? item.brand ?? configuredStoreName(),
      sku: product?.sku ?? item.sku ?? product?.id ?? item.productId,
      price,
      salePrice: Number(product?.salePrice ?? price) || price,
      buyPrice: product?.buyPrice ?? item.buyPrice ?? null,
      unitProfit: product?.unitProfit ?? null,
      originalPrice: product?.originalPrice ?? item.originalPrice ?? null,
      image: product?.img ?? item.image ?? "",
      stock: product?.stock ?? null,
    };
  });
}

function activeCartCoupon(state) {
  const coupon = state?.coupon;
  return coupon?.expiresAt && new Date(coupon.expiresAt).getTime() > Date.now() ? coupon : null;
}

function summarizeCart(items, coupon = null) {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0));
  const discount = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
  return { items, subtotal, coupon, discount, total: Math.max(0, subtotal - discount) };
}

router.get("/api/cart", requireCheckoutIdentity, async (req, res) => {
  try {
    const pool = await getPool();
    let state = await loadCartState(pool, req.checkoutUserId);
    const coupon = activeCartCoupon(state);
    if (state.coupon && !coupon) state = await mutateCartState(pool, req.checkoutUserId, (current) => ({ ...current, coupon: null }));
    const items = await hydrateCart(pool, state.cart);
    res.json(summarizeCart(items, coupon));
  } catch (err) {
    console.error("/api/cart GET error", err);
    res.status(500).json({ error: "Unable to load cart" });
  }
});

router.post(["/api/cart", "/api/cart/items"], requireCheckoutIdentity, async (req, res) => {
  const productId = Number(req.body?.productId);
  const qty = parseBoundedInteger(req.body?.quantity ?? 1, { min: 1, max: MAX_CART_QUANTITY });

  if (!Number.isInteger(productId) || productId < 1) {
    return res.status(400).json({ error: "Invalid product id" });
  }
  if (qty == null) return res.status(400).json({ error: `Quantity must be a whole number between 1 and ${MAX_CART_QUANTITY}` });

  try {
    const pool = await getPool();
    const product = await loadProductById(pool, productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const state = await mutateCartState(pool, req.checkoutUserId, (current) => {
      const cart = [...current.cart];
      const id = productId.toString();
      const existing = cart.find((item) => String(item.productId) === id);
      if (existing && existing.quantity + qty > MAX_CART_QUANTITY) {
        const error = new Error(`Quantity cannot exceed ${MAX_CART_QUANTITY}`);
        error.code = "CART_QUANTITY_LIMIT";
        throw error;
      }
      if (existing) Object.assign(existing, {
        quantity: existing.quantity + qty,
        price: product.price,
        title: product.name,
        category: product.category,
        brand: product.brand,
        sku: product.sku,
        salePrice: product.salePrice,
        buyPrice: product.buyPrice,
        originalPrice: product.originalPrice,
        image: product.img || existing.image,
      });
      else cart.push({
        productId: id,
        title: product.name,
        category: product.category,
        brand: product.brand,
        sku: product.sku,
        price: product.price,
        salePrice: product.salePrice,
        buyPrice: product.buyPrice,
        originalPrice: product.originalPrice,
        quantity: qty,
        image: product.img || "",
      });
      return { ...current, cart };
    });
    await queueCartInactivity({ pool, userId: req.user?.id, email: req.user?.email, name: req.user?.fullName, state })
      .catch((error) => console.warn("Unable to schedule cart reminder:", error?.message || error));
    const items = await hydrateCart(pool, state.cart);
    res.json({ ok: true, ...summarizeCart(items, activeCartCoupon(state)) });
  } catch (err) {
    if (err?.code === "CART_QUANTITY_LIMIT") return res.status(400).json({ error: err.message });
    console.error("/api/cart POST error", err);
    res.status(500).json({ error: "Unable to add to cart" });
  }
});

router.put(["/api/cart/:productId", "/api/cart/items/:productId"], requireCheckoutIdentity, async (req, res) => {
  const id = req.params.productId;
  const qty = parseBoundedInteger(req.body?.quantity, { min: 0, max: MAX_CART_QUANTITY });
  if (qty == null) return res.status(400).json({ error: `Quantity must be a whole number between 0 and ${MAX_CART_QUANTITY}` });
  try {
    const pool = await getPool();
    const state = await mutateCartState(pool, req.checkoutUserId, (current) => {
      const cart = [...current.cart];
      const existing = cart.find((item) => String(item.productId) === String(id));
      if (!existing) {
        const error = new Error("Item not found");
        error.code = "CART_ITEM_NOT_FOUND";
        throw error;
      }
      if (qty === 0) return { ...current, cart: cart.filter((item) => String(item.productId) !== String(id)) };
      existing.quantity = qty;
      return { ...current, cart };
    });
    await queueCartInactivity({ pool, userId: req.user?.id, email: req.user?.email, name: req.user?.fullName, state })
      .catch((error) => console.warn("Unable to schedule cart reminder:", error?.message || error));
    const items = await hydrateCart(pool, state.cart);
    res.json({ ok: true, ...summarizeCart(items, activeCartCoupon(state)) });
  } catch (err) {
    if (err?.code === "CART_ITEM_NOT_FOUND") return res.status(404).json({ error: err.message });
    console.error("/api/cart PUT error", err);
    res.status(500).json({ error: "Unable to update cart" });
  }
});

router.delete(["/api/cart/:productId", "/api/cart/items/:productId"], requireCheckoutIdentity, async (req, res) => {
  const id = req.params.productId;
  try {
    const pool = await getPool();
    const state = await mutateCartState(pool, req.checkoutUserId, (current) => ({ ...current, cart: current.cart.filter((item) => String(item.productId) !== String(id)) }));
    await queueCartInactivity({ pool, userId: req.user?.id, email: req.user?.email, name: req.user?.fullName, state })
      .catch((error) => console.warn("Unable to schedule cart reminder:", error?.message || error));
    const items = await hydrateCart(pool, state.cart);
    res.json({ ok: true, ...summarizeCart(items, activeCartCoupon(state)) });
  } catch (err) {
    console.error("/api/cart DELETE error", err);
    res.status(500).json({ error: "Unable to remove item" });
  }
});

router.post("/api/cart/clear", requireCheckoutIdentity, async (req, res) => {
  try {
    const pool = await getPool();
    const state = await mutateCartState(pool, req.checkoutUserId, (current) => ({ ...current, cart: [], coupon: null }));
    await cancelQueuedJourneySteps(pool, { userId: req.user?.id, stepKeys: ["cart-reminder"], reason: "cart_cleared" })
      .catch((error) => console.warn("Unable to cancel cart reminder:", error?.message || error));
    res.json({ ok: true, ...summarizeCart(state.cart, null) });
  } catch (error) {
    console.error("/api/cart/clear error", error);
    res.status(500).json({ error: "Unable to clear cart" });
  }
});

router.patch(["/api/cart/:productId", "/api/cart/items/:productId"], requireCheckoutIdentity, async (req, res) => {
  const id = req.params.productId;
  const quantity = parseBoundedInteger(req.body?.quantity, { min: 0, max: MAX_CART_QUANTITY });
  if (quantity == null) return res.status(400).json({ error: `Quantity must be a whole number between 0 and ${MAX_CART_QUANTITY}` });
  try {
    const pool = await getPool();
    const state = await mutateCartState(pool, req.checkoutUserId, (current) => {
      const cart = [...current.cart];
      const existing = cart.find((item) => String(item.productId) === String(id));
      if (!existing) {
        const error = new Error("Item not found");
        error.code = "CART_ITEM_NOT_FOUND";
        throw error;
      }
      return { ...current, cart: quantity === 0 ? cart.filter((item) => String(item.productId) !== String(id)) : cart.map((item) => String(item.productId) === String(id) ? { ...item, quantity } : item) };
    });
    await queueCartInactivity({ pool, userId: req.user?.id, email: req.user?.email, name: req.user?.fullName, state })
      .catch((error) => console.warn("Unable to schedule cart reminder:", error?.message || error));
    const items = await hydrateCart(pool, state.cart);
    res.json({ ok: true, ...summarizeCart(items, activeCartCoupon(state)) });
  } catch (error) {
    if (error?.code === "CART_ITEM_NOT_FOUND") return res.status(404).json({ error: error.message });
    console.error("/api/cart PATCH error", error);
    res.status(500).json({ error: "Unable to update cart" });
  }
});

function roundCurrency(value) {
  return Number((Math.max(0, Number(value) || 0)).toFixed(2));
}

router.post(["/api/cart/apply-coupon", "/api/cart/coupon"], requireCheckoutIdentity, async (req, res) => {
  const code = normalizeCouponCode(req.body?.code);
  if (!code) return res.status(400).json({ error: "Enter a promo code" });
  try {
    const pool = await getPool();
    const current = await loadCartState(pool, req.checkoutUserId);
    const items = await hydrateCart(pool, current.cart);
    const subtotal = summarizeCart(items).subtotal;
    const coupon = await findCouponByCode(pool, code);
    if (!coupon) return res.status(400).json({ error: "That promo code is not valid" });
    if (!couponIsUsable(coupon)) {
      await mutateCartState(pool, req.checkoutUserId, (state) => ({ ...state, coupon: null }));
      return res.status(400).json({ error: coupon.status === "Expired" ? "That promo code has expired" : "That promo code is inactive" });
    }
    if (await hasCouponBeenRedeemed(pool, coupon, { userId: req.checkoutUserId, customerEmail: req.user?.email })) {
      await mutateCartState(pool, req.checkoutUserId, (state) => ({ ...state, coupon: null }));
      return res.status(400).json({ error: "That promo code has already been used by this customer" });
    }
    const persistedCoupon = {
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      expiresAt: coupon.expiresAt,
    };
    await mutateCartState(pool, req.checkoutUserId, (state) => ({ ...state, coupon: persistedCoupon }));
    const discount = calculateCouponDiscount(subtotal, persistedCoupon);
    res.json({
      ok: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      expiresAt: coupon.expiresAt,
      discount,
      subtotal,
      total: Math.max(0, subtotal - discount),
      coupon: { code: coupon.code, discountPercent: coupon.discountPercent, expiresAt: coupon.expiresAt },
    });
  } catch (error) {
    console.error("/api/cart/apply-coupon error", error);
    res.status(500).json({ error: "Unable to validate promo code" });
  }
});

router.post("/api/cart/shipping-estimate", requireCheckoutIdentity, async (req, res) => {
  const country = String(req.body?.country || "").trim().toUpperCase();
  const postalCode = String(req.body?.postalCode || "").trim();
  if (!country) return res.status(400).json({ error: "Choose a delivery country" });

  try {
    const pool = await getPool();
    const requestedProductId = req.body?.productId == null
      ? null
      : parseBoundedInteger(req.body.productId, { min: 1, max: 2_147_483_647 });
    if (req.body?.productId != null && requestedProductId == null) return res.status(400).json({ error: "Choose a valid product" });
    let quoteItems;
    if (requestedProductId != null) {
      const product = await loadProductById(pool, requestedProductId);
      if (!product) return res.status(404).json({ error: "Product not found" });
      quoteItems = [{
        productId: requestedProductId,
        sku: product.sku,
        title: product.name,
        quantity: parseBoundedInteger(req.body?.quantity, { min: 1, max: MAX_CART_QUANTITY }) || 1,
      }];
    } else {
      const cartState = await loadCartState(pool, req.checkoutUserId);
      if (!cartState.cart.length) return res.status(400).json({ error: "Cart is empty" });
      quoteItems = cartState.cart;
    }
    const estimates = await quoteCjShippingForCart(pool, quoteItems, { country, postalCode });
    const requested = normalizeShippingServiceName(req.body?.method || req.body?.logisticName);
    const selected = selectCjShippingOption(estimates, requested) || estimates[0];
    res.json({ ok: true, scope: requestedProductId == null ? "cart" : "product", country, postalCode, estimates, selected });
  } catch (error) {
    console.error("/api/cart/shipping-estimate error", {
      message: error?.message || String(error),
      statusCode: error?.statusCode || null,
      code: error?.code || null,
      providerMessage: error?.providerMessage || null,
      path: error?.path || null,
    });
    res.status(422).json({ error: "Unable to calculate shipping for this cart and destination" });
  }
});

router.post("/api/cart/save-item", requireCheckoutIdentity, async (req, res) => {
  const productId = String(req.body?.productId || "");
  try {
    const pool = await getPool();
    const current = await loadCartState(pool, req.checkoutUserId);
    const item = current.cart.find((entry) => String(entry.productId) === productId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    let savedItems;
    if (req.user && Number.isInteger(Number(req.user.id))) {
      await upsertSavedProduct(pool, Number(req.user.id), Number(productId));
      savedItems = await loadSavedProductsForUser(pool, Number(req.user.id));
    } else {
      savedItems = [...current.savedGuest.filter((entry) => String(entry.productId) !== productId), { ...item, savedAt: new Date().toISOString() }];
    }
    const state = await mutateCartState(pool, req.checkoutUserId, (value) => ({
      ...value,
      cart: value.cart.filter((entry) => String(entry.productId) !== productId),
      savedGuest: req.user ? value.savedGuest : savedItems,
    }));
    const items = await hydrateCart(pool, state.cart);
    res.json({ ok: true, ...summarizeCart(items, activeCartCoupon(state)), savedItems });
  } catch (err) {
    console.error("/api/cart/save-item error", err);
    res.status(500).json({ error: "Unable to save item" });
  }
});



// Header route
router.get("/api/header", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[header_tbl]");
    const rows = normalizeResult(result);
    
    res.json(rows);
  } catch (err) {
    console.error("/api/header error:", err);
    res.status(500).json([]);
  }
});

router.get("/api/head", async (req, res) => {
  try{
    const pool  = await getPool();
    
    const result = await pool.request().query('SELECT * FROM [dbo].[head_tbl]');
    const rows  = normalizeResult(result);
    res.json(rows);
    
  }catch (err) {
    console.error("api/head error: ", err)
    res.status(500).json([])
  }
  
});


// Most Chosen Products route for carousel
router.get("/api/most-chosen", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        PID, 
        Name, 
        Description, 
        imageUrl, 
        Price, 
        ChosenCount
      FROM MostChosenProducts
    `);

    const rows = normalizeResult(result);

    // Normalize field names for frontend compatibility
    const mapped = rows.map(r => ({
      id: r.PID ?? r.pid ?? r.id,
      title: r.Name ?? r.name ?? '',
      description: r.Description ?? r.description ?? '',
      // MostChosenProducts view aliases Img AS imageUrl, prefer that
      imageUrl: r.imageUrl ?? r.Img ?? r.img ?? '',
      price: r.Price ?? r.price ?? 0,
      chosenCount: r.ChosenCount ?? r.chosenCount ?? 0,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("/api/most-chosen error:", err);
    res.status(500).json([]);
  }
});


// Health endpoint for quick availability checks
router.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const dbOk = !!(pool && pool.connected !== false);
    res.json({ ok: true, env: process.env.NODE_ENV || 'development', jwt: !!process.env.JWT_SECRET, db: dbOk });
  } catch (err) {
    console.error('/api/health error', err && err.stack ? err.stack : err);
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});



// Get all visible comments
router.get("/api/comment", async (req, res) => {
  try {
    const pool = await getPool();
    let result = await pool.request().query(`
      SELECT CommentId, Name, Text, CreatedAt 
      FROM Comments
      WHERE ShowComment = 1
      ORDER BY CreatedAt DESC
    `);
    const rows = normalizeResult(result);

    // Normalize field names for frontend compatibility: id, name, text, createdAt
    const mapped = rows.map(r => ({
      id: r.CommentId ?? r.commentId ?? r.id,
      name: r.Name ?? r.name ?? '',
      text: r.Text ?? r.text ?? '',
      createdAt: r.CreatedAt ?? r.createdAt ?? null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("/api/comment GET error:", err);
    res.status(500).json({ error: "Unable to load comments" });
  }
});


router.post("/api/comment", upload.single('image'), async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const text = String(req.body?.text || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const file = req.file;

    if (file && !(await validateUploadedFiles(file, "image"))) {
      return res.status(400).json({ error: "Uploaded image content does not match its declared type" });
    }

    if (!name || !text || !email || name.length > 100 || text.length > 5000 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (file) await fs.promises.unlink(file.path).catch(() => {});
      return res.status(400).json({ error: "Name, email and text are required" });
    }

    const imgPath = file ? `/uploads/${file.filename}` : null;

    const pool = await getPool();
    const [hasEmailColumn, hasImgColumn] = await Promise.all([
      hasTableColumn(pool, "dbo.Comments", "Email"),
      hasTableColumn(pool, "dbo.Comments", "Img"),
    ]);
    const storedImgPath = imgPath && hasImgColumn ? imgPath : null;
    const outputColumns = ["CommentId", "Name", "Text", "CreatedAt", ...(hasEmailColumn ? ["Email"] : []), ...(storedImgPath ? ["Img"] : [])]
      .map((column) => `INSERTED.${column}`)
      .join(", ");
    const insertColumns = ["Name", "Text", "ShowComment", ...(hasEmailColumn ? ["Email"] : []), ...(storedImgPath ? ["Img"] : [])];
    const insertValues = ["@Name", "@Text", "1", ...(hasEmailColumn ? ["@Email"] : []), ...(storedImgPath ? ["@Img"] : [])];
    const request = pool
      .request()
      .input("Name", sql.NVarChar(100), name)
      .input("Text", sql.NVarChar(sql.MAX), text)
      .input("Email", sql.NVarChar(255), email);
    if (storedImgPath) request.input("Img", sql.NVarChar(sql.MAX), storedImgPath);
    const result = await request.query(`
      INSERT INTO [dbo].[Comments] (${insertColumns.map((column) => `[${column}]`).join(", ")})
      OUTPUT ${outputColumns}
      VALUES (${insertValues.join(", ")})
    `);

    const rows = normalizeResult(result);
    const inserted = rows[0];

    const mapped = {
      id: inserted.CommentId ?? inserted.commentId ?? inserted.id,
      name: inserted.Name ?? inserted.name ?? '',
      text: inserted.Text ?? inserted.text ?? '',
      createdAt: inserted.CreatedAt ?? inserted.createdAt ?? null,
      img: inserted.Img ?? inserted.img ?? storedImgPath,
      email: inserted.Email ?? inserted.email ?? email,
    };

    res.json(mapped);
  } catch (err) {
    await cleanupRequestUploads(req);
    console.error("/api/comment POST error:", err);
    res.status(500).json({ error: "Unable to submit comment" });
  }
});

// Footer route
router.get("/api/footer", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[footer_tbl]");
    const rows = normalizeResult(result);
    res.json(rows);
  } catch (err) {
    console.error("/api/footer error:", err);
    res.status(500).json([]);
  }
});

// Customer reviews. Reviews are stored in CRM.Reviews and only published
// records are returned to the public storefront.
router.get("/api/reviews", async (req, res) => {
  try {
    const pool = await getPool();
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(24, Math.max(1, Math.floor(requestedLimit))) : 6;
    const [reviewResult, summaryResult] = await Promise.all([
      pool.request().query(`
        SELECT TOP (${limit}) [Id], [CustomerName], [Rating], [Title], [ReviewText], [IsFeatured], [CreatedAt]
        FROM [CRM].[Reviews]
        WHERE [Status] = N'Approved'
        ORDER BY [IsFeatured] DESC, [PublishedAt] DESC, [CreatedAt] DESC;
      `),
      pool.request().query(`
        SELECT COUNT_BIG(*) AS [ReviewCount], COALESCE(AVG(CONVERT(DECIMAL(4,2), [Rating])), 0) AS [AverageRating]
        FROM [CRM].[Reviews]
        WHERE [Status] = N'Approved';
      `),
    ]);
    const summary = normalizeResult(summaryResult)[0] || {};
    res.json({
      reviews: normalizeResult(reviewResult).map(normalizeReviewRow),
      summary: {
        count: numericValue(summary.ReviewCount),
        averageRating: numericValue(summary.AverageRating),
      },
    });
  } catch (err) {
    console.error("/api/reviews GET error:", err);
    res.status(500).json({ error: "Unable to load customer reviews" });
  }
});

router.post("/api/reviews", maybeAttachUser, async (req, res) => {
  const input = validateReviewInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });

  try {
    const pool = await getPool();
    let customerId = null;
    if (req.user?.id) {
      try {
        const customerResult = await pool.request()
          .input("UserId", sql.NVarChar(80), String(req.user.id))
          .input("Email", sql.NVarChar(255), input.email || req.user.email || null)
          .query(`
            SELECT TOP 1 [Id]
            FROM [CRM].[Customers]
            WHERE [LegacyUserId] = TRY_CONVERT(INT, @UserId)
               OR ([Email] IS NOT NULL AND [Email] = @Email);
          `);
        customerId = normalizeResult(customerResult)[0]?.Id || null;
      } catch (lookupError) {
        console.warn("Review customer lookup skipped:", lookupError && lookupError.message ? lookupError.message : lookupError);
      }
    }

    const result = await pool.request()
      .input("CustomerId", sql.UniqueIdentifier, customerId)
      .input("CustomerName", sql.NVarChar(100), input.name)
      .input("CustomerEmail", sql.NVarChar(255), input.email || req.user?.email || null)
      .input("Rating", sql.TinyInt, input.rating)
      .input("Title", sql.NVarChar(160), input.title)
      .input("ReviewText", sql.NVarChar(2000), input.text)
      .query(`
        INSERT INTO [CRM].[Reviews]
          ([CustomerId], [CustomerName], [CustomerEmail], [Rating], [Title], [ReviewText], [Status], [IsFeatured], [PublishedAt])
        OUTPUT INSERTED.[Id], INSERTED.[CustomerName], INSERTED.[Rating], INSERTED.[Title], INSERTED.[ReviewText], INSERTED.[Status], INSERTED.[IsFeatured], INSERTED.[CreatedAt]
        VALUES (@CustomerId, @CustomerName, @CustomerEmail, @Rating, @Title, @ReviewText, N'Pending', 0, NULL);
      `);
    const review = normalizeReviewRow(normalizeResult(result)[0] || {});
    res.status(201).json({ ok: true, review, status: "Pending", message: "Thank you. Your review is waiting for approval." });
  } catch (err) {
    console.error("/api/reviews POST error:", err);
    res.status(500).json({ error: "Unable to save your review. Apply the review database migration and try again." });
  }
});

// Supplier product import helpers
router.get("/api/cj/products", requireIntegrationsManage, async (_req, res) => {
  try {
    const pool = await getPool();
    const mapped = await loadCjImports(pool);
    res.json(mapped);
  } catch (err) {
    console.error("/api/cj/products GET error:", err);
    res.status(500).json({ error: "Unable to load CJ imports" });
  }

});

router.get("/api/cj/shops", requireIntegrationsManage, async (_req, res) => {
  try {
    const shops = await listCjShops();
    res.json({
      shops: shops.map((shop) => ({
        id: String(shop?.id || "").slice(0, 50),
        name: String(shop?.name || shop?.aliasName || "CJ API shop").slice(0, 200),
        type: String(shop?.type || "").slice(0, 50),
        status: Number(shop?.status),
        authorized: Number(shop?.status) === 1,
      })),
      configuredShopId: cjStoreConnectionConfig().shopId,
    });
  } catch (err) {
    const provider = cjStoreSyncPublicError(err);
    console.error("/api/cj/shops GET error:", provider.error);
    res.status(502).json({ error: "Unable to load CJ shops", detail: provider.error, code: provider.code });
  }
});

// Retry a live CJ submission (for example after a temporary balance or
// provider failure) without ever creating a second CJ order for the same
// storefront order. This endpoint is admin-only and disabled in sandbox mode.
router.post("/api/cj/orders/:orderId/submit", requireIntegrationsManage, async (req, res) => {
  if (!cjFulfillmentEnabled() || cjSandboxModeConfigured() || !cjAutoPayEnabled()) {
    return res.status(409).json({ error: "Live CJ auto-payment is not enabled" });
  }
  let pool;
  let target;
  try {
    pool = await getPool();
    target = await loadPaidStorefrontOrderForAdmin(pool, req.params.orderId);
    const result = await submitCjOrderForFulfillment(pool, target.userId, target.order);
    const fulfillment = await loadCjFulfillment(pool, target.userId, target.order.id);
    await recordSecurityEvent({
      pool,
      eventType: "admin.cj_live_action",
      severity: "high",
      actor: req.user?.id,
      resourceType: "storefront_order",
      resourceId: target.order.id,
      metadata: { action: "submit_live_order", paid: Boolean(result.fulfillment?.paid) },
    });
    return res.json({
      ok: true,
      order: {
        orderId: target.order.id,
        cjOrderId: String(fulfillment?.CjOrderId || "") || null,
        cjStatus: String(fulfillment?.CjStatus || "") || null,
        storefrontStatus: String(result.order?.status || target.order.status),
        submissionStatus: String(fulfillment?.SubmissionStatus || "Submitted"),
        trackingNumber: String(fulfillment?.CjTrackingNumber || result.order?.trackingNumber || "") || null,
      },
    });
  } catch (error) {
    if (pool && target) await markCjFulfillmentFailed(pool, target.userId, target.order.id, error).catch(() => {});
    if (target?.order) await notifyOwnerCjFailure(target.order, error, "Admin-triggered CJ fulfillment retry");
    console.error("CJ live admin submission failed", cjSubmissionFailureMessage(error));
    const statusCode = [400, 404, 409, 502, 503].includes(Number(error?.statusCode)) ? Number(error.statusCode) : 502;
    return res.status(statusCode).json({ error: cjSubmissionFailureMessage(error) });
  }
});

router.get("/api/cj/sandbox/orders", requireIntegrationsManage, async (_req, res) => {
  const configuration = cjSandboxConfigurationStatus();
  try {
    const pool = await getPool();
    if (!(await ensureCjFulfillmentTable(pool))) {
      return res.status(503).json({ ...configuration, error: "CJ fulfillment migration is required" });
    }
    const result = await pool.request().query(`
      SELECT TOP (30)
        storefront.OrderId, fulfillment.CjOrderId, fulfillment.CjStatus, fulfillment.CjTrackingNumber,
        fulfillment.SubmissionStatus, fulfillment.SubmittedAt, fulfillment.LastSyncedAt,
        fulfillment.LastError, storefront.Status AS StorefrontStatus,
        storefront.PaymentStatus, storefront.PlacedAt
      FROM [Commerce].[StorefrontOrders] storefront
      LEFT JOIN [Commerce].[CjFulfillmentOrders] fulfillment
        ON fulfillment.OrderId = storefront.OrderId AND fulfillment.UserId = storefront.UserId
      WHERE LOWER(LTRIM(RTRIM(COALESCE(storefront.PaymentStatus, N'')))) = N'paid'
      ORDER BY storefront.PlacedAt DESC;
    `);
    const orders = normalizeResult(result).map((row) => ({
      orderId: String(row.OrderId || ""),
      cjOrderId: String(row.CjOrderId || "").trim() || null,
      cjStatus: String(row.CjStatus || "").trim() || null,
      storefrontStatus: String(row.StorefrontStatus || "Processing"),
      paymentStatus: String(row.PaymentStatus || "paid"),
      submissionStatus: String(row.SubmissionStatus || "Not submitted"),
      trackingNumber: String(row.CjTrackingNumber || "").trim() || null,
      lastError: String(row.LastError || "").trim() || null,
      placedAt: row.PlacedAt || null,
      lastSyncedAt: row.LastSyncedAt || null,
    }));
    return res.json({ ...configuration, orders });
  } catch (error) {
    console.error("CJ sandbox order list failed", error?.name || "unknown_error");
    return res.status(503).json({ ...configuration, error: "Unable to load CJ sandbox orders" });
  }
});

router.post("/api/cj/sandbox/orders/:orderId/submit", requireIntegrationsManage, async (req, res) => {
  const configuration = cjSandboxConfigurationStatus();
  if (!configuration.autoSubmitReady) {
    return res.status(409).json({ error: configuration.issues.join(" ") || "CJ sandbox fulfillment is not configured" });
  }

  let pool;
  let target;
  try {
    pool = await getPool();
    target = await loadPaidStorefrontOrderForAdmin(pool, req.params.orderId);
    const result = await submitCjOrderForFulfillment(pool, target.userId, target.order);
    const fulfillment = await loadCjFulfillment(pool, target.userId, target.order.id);
    if (!fulfillment?.CjOrderId) throw cjSandboxHttpError("CJ did not return a sandbox order id", 502);

    await recordSecurityEvent({
      pool,
      eventType: "admin.cj_sandbox_action",
      severity: "high",
      actor: req.user?.id,
      resourceType: "storefront_order",
      resourceId: target.order.id,
      metadata: { action: "submit_paid_order", submitted: Boolean(result.fulfillment?.submitted) },
    });
    return res.json({ ok: true, action: "submit_paid_order", order: cjSandboxOrderSummary(fulfillment, result.order) });
  } catch (error) {
    if (pool && target) await markCjFulfillmentFailed(pool, target.userId, target.order.id, error).catch(() => {});
    const statusCode = [400, 404, 409, 502, 503].includes(Number(error?.statusCode)) ? Number(error.statusCode) : 502;
    if (statusCode >= 500) console.error("CJ sandbox order submission failed", cjSubmissionFailureMessage(error));
    return res.status(statusCode).json({ error: statusCode === 502 ? cjSubmissionFailureMessage(error) : error.message });
  }
});

router.post("/api/cj/sandbox/orders/:orderId/simulate-payment", requireIntegrationsManage, async (req, res) => {
  return runCjSandboxAdminAction(req, res, "simulate_payment", async (pool, target) => {
    const orderStatus = String(target.detail?.orderStatus || "").trim().toUpperCase();
    if (["CREATED", "IN_CART"].includes(orderStatus)) {
      const orderId = target.detail?.orderId || target.fulfillment.CjOrderId;
      try {
        await confirmCjOrder(orderId);
      } catch (error) {
        if (Number(error?.code) !== 1605000) throw error;
        // CJ can invalidate a logistics service between quote and confirmation.
        // In sandbox mode, replace it with the first available in-stock option
        // so the administrator can continue the supplier-flow test safely.
        const orderCode = target.detail?.cjOrderCode || target.fulfillment.CjOrderCode;
        const options = await getCjOrderOptionalLogistics(orderCode);
        const replacement = chooseInStockCjLogistics(options);
        await updateCjOrderLogistics(replacement);
        await confirmCjOrder(orderId);
      }
    }
    await runCjSandboxOrderAction(target, simulateCjSandboxPayment);
    return refreshCjSandboxOrder(pool, target);
  });
});

router.post("/api/cj/sandbox/orders/:orderId/status", requireIntegrationsManage, async (req, res) => {
  const targetStatus = Number(req.body?.targetStatus);
  if (![400, 500, 600, 700].includes(targetStatus)) {
    return res.status(400).json({ error: "targetStatus must be 400, 500, 600, or 700" });
  }
  return runCjSandboxAdminAction(req, res, `advance_${targetStatus}`, async (pool, target) => {
    await runCjSandboxOrderAction(target, (cjOrderReference) => updateCjSandboxStatus(cjOrderReference, targetStatus));
    return refreshCjSandboxOrder(pool, target);
  });
});

router.post("/api/cj/sandbox/orders/:orderId/tracking-number", requireIntegrationsManage, async (req, res) => {
  const trackingNumber = String(req.body?.trackingNumber || "").trim();
  if (!trackingNumber || trackingNumber.length > 64 || /[\u0000-\u001f\u007f]/.test(trackingNumber)) {
    return res.status(400).json({ error: "trackingNumber must be 1 to 64 printable characters" });
  }
  return runCjSandboxAdminAction(req, res, "set_tracking_number", async (pool, target) => {
    await runCjSandboxOrderAction(target, (cjOrderReference) => updateCjSandboxTrackingNumber(cjOrderReference, trackingNumber));
    return refreshCjSandboxOrder(pool, target);
  });
});

router.post("/api/cj/sandbox/orders/:orderId/stage-preview", requireIntegrationsManage, async (req, res) => {
  const stage = String(req.body?.stage || "").trim();
  return runCjSandboxAdminAction(req, res, "storefront_stage_preview", async (pool, target) => {
    return previewCjSandboxStorefrontStage(pool, target, stage);
  });
});

router.get("/api/cj/ping", requireIntegrationsManage, async (_req, res) => {
  const basePresent = !!(process.env.CJ_API_BASE_URL || process.env.CJ_API_BASE || CJ_API_BASE_URL);
  const tokenPresent = !!(process.env.CJ_API_TOKEN || process.env.CJ_API_KEY || process.env.CJ_TOKEN);
  const tokenCached = !!(cachedCjToken && cachedCjToken.token && Date.now() < cachedCjToken.expiresAt);
  const tokenExpiresInSeconds = tokenCached
    ? Math.max(0, Math.floor((cachedCjToken.expiresAt - Date.now()) / 1000))
    : 0;
  const tokenCooldownSeconds = Math.max(0, Math.ceil((cjTokenCooldownUntil - Date.now()) / 1000));
  const storeConfig = cjStoreConnectionConfig();

  res.json({
    ok: basePresent && tokenPresent,
    basePresent,
    tokenPresent,
    fulfillmentEnabled: String(process.env.CJ_FULFILLMENT_ENABLED || "").toLowerCase() === "true",
    sandboxMode: cjSandboxModeConfigured(),
    autoPayEnabled: cjAutoPayEnabled(),
    liveAutoPayReady: cjFulfillmentEnabled() && cjAutoPayEnabled(),
    tokenCached,
    tokenExpiresInSeconds,
    tokenCooldownSeconds,
    storeSyncEnabled: storeSyncEnabled(),
    shopIdConfigured: Boolean(storeConfig.shopId),
    connectionLogistics: storeConfig.logistics,
  });
});

router.post("/api/cj/lookup", requireIntegrationsManage, async (req, res) => {
  try {
    const pid = (req.body?.pid ?? req.body?.Pid ?? req.body?.PID ?? "").toString().trim();
    if (!pid) {
      return res.status(400).json({ error: "pid is required" });

    }

    const cjData = await fetchCjProduct(pid);
    const normalized = normalizeCjProductData(cjData, pid);
    if (!normalized) {
      return res.status(404).json({ error: "Unable to find CJ product" });
    }
    res.json({ product: normalized, fetched: true });
  } catch (err) {
    if (err && err.name === "CjRateLimitError") {
      return res.status(429).json({
        error: err.message || "CJ rate limited",
        retryAfterSeconds: err.retryAfterSeconds ?? null,
      });
    }
    console.error("/api/cj/lookup error:", err);
    res.status(500).json({ error: "Unable to lookup CJ product" });
  }
});

function cjSandboxModeEnabled() {
  return cjSandboxConfigurationStatus().enabled;
}

function cjSandboxConfigurationStatus() {
  const credentialsReady = cjTrackingConfigured();
  const sandboxMode = String(process.env.CJ_SANDBOX_MODE || "").toLowerCase() === "true";
  const fulfillmentEnabled = String(process.env.CJ_FULFILLMENT_ENABLED || "").toLowerCase() === "true";
  const fromCountryCode = String(process.env.CJ_FROM_COUNTRY_CODE || "").trim().toUpperCase();
  const shopLogisticsType = Number(process.env.CJ_SHOP_LOGISTICS_TYPE || 2);
  const issues = [];

  if (!credentialsReady) issues.push("Configure a CJ API credential.");
  if (!sandboxMode) issues.push("Set CJ_SANDBOX_MODE=true and restart the backend.");
  if (!fulfillmentEnabled) issues.push("Set CJ_FULFILLMENT_ENABLED=true and restart the backend.");
  if (!/^[A-Z]{2}$/.test(fromCountryCode)) issues.push("Set CJ_FROM_COUNTRY_CODE to a two-letter country code.");
  if (![1, 2, 3].includes(shopLogisticsType)) issues.push("Set CJ_SHOP_LOGISTICS_TYPE to 1, 2, or 3.");

  const enabled = credentialsReady && sandboxMode;
  const autoSubmitReady = enabled && fulfillmentEnabled && /^[A-Z]{2}$/.test(fromCountryCode) && [1, 2, 3].includes(shopLogisticsType);
  return { enabled, autoSubmitReady, issues };
}

function cjSandboxHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isCjSandboxOrder(detail) {
  return detail?.isSandbox === true || Number(detail?.isSandbox) === 1;
}

function cjSandboxOrderSummary(fulfillment, order, detail = null) {
  const shippingService = normalizeShippingServiceName(order?.shippingAddress?.logisticName || order?.shippingAddress?.shippingMethod);
  return {
    orderId: String(order?.id || fulfillment?.OrderId || ""),
    cjOrderId: String(fulfillment?.CjOrderId || detail?.orderId || ""),
    cjStatus: String(detail?.subStatus || detail?.orderStatus || fulfillment?.CjStatus || "").trim() || null,
    storefrontStatus: String(order?.status || "Processing"),
    submissionStatus: String(fulfillment?.SubmissionStatus || "Submitted"),
    trackingNumber: String(detail?.trackNumber || fulfillment?.CjTrackingNumber || order?.trackingNumber || "").trim() || null,
    shippingService: shippingService || null,
    requiresShippingSelection: !shippingService,
    placedAt: order?.placedAt || null,
  };
}

async function loadCjSandboxOrderForAdmin(pool, orderId) {
  if (!cjSandboxModeEnabled()) throw cjSandboxHttpError("CJ sandbox mode is disabled", 409);
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId || normalizedOrderId.length > 64) throw cjSandboxHttpError("A valid storefront order id is required", 400);
  if (!(await ensureCjFulfillmentTable(pool))) throw cjSandboxHttpError("CJ fulfillment migration is required", 503);
  const result = await pool.request()
    .input("OrderId", sql.NVarChar(64), normalizedOrderId)
    .query("SELECT TOP 1 * FROM [Commerce].[CjFulfillmentOrders] WHERE OrderId = @OrderId AND CjOrderId IS NOT NULL");
  const fulfillment = normalizeResult(result)[0] || null;
  if (!fulfillment?.CjOrderId) throw cjSandboxHttpError("No CJ fulfillment order was found", 404);
  const order = await loadOrderById(pool, fulfillment.UserId, fulfillment.OrderId);
  if (!order) throw cjSandboxHttpError("The storefront order was not found", 404);
  const detail = await fetchCjOrderDetail(fulfillment.CjOrderId);
  if (!isCjSandboxOrder(detail)) throw cjSandboxHttpError("CJ refused this action because the selected order is not a sandbox order", 409);
  return { fulfillment, order, detail };
}

async function loadPaidStorefrontOrderForAdmin(pool, orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId || normalizedOrderId.length > 64) throw cjSandboxHttpError("A valid storefront order id is required", 400);
  const result = await pool.request()
    .input("OrderId", sql.NVarChar(64), normalizedOrderId)
    .query(`
      SELECT TOP 1 OrderId, UserId
      FROM [Commerce].[StorefrontOrders]
      WHERE OrderId = @OrderId
        AND LOWER(LTRIM(RTRIM(COALESCE(PaymentStatus, N'')))) = N'paid'
      ORDER BY PlacedAt DESC;
    `);
  const row = normalizeResult(result)[0] || null;
  if (!row) throw cjSandboxHttpError("The paid storefront order was not found", 404);
  const order = await loadOrderById(pool, row.UserId, row.OrderId);
  if (!order) throw cjSandboxHttpError("The storefront order could not be loaded", 404);
  return { userId: String(row.UserId), order };
}

async function refreshCjSandboxOrder(pool, target) {
  const cacheKey = String(target.fulfillment.CjOrderId || "").trim().toUpperCase();
  if (cacheKey) cjOrderStatusLookupCache.delete(cacheKey);
  const detail = await fetchCjOrderDetail(target.fulfillment.CjOrderId);
  if (!isCjSandboxOrder(detail)) throw cjSandboxHttpError("CJ did not confirm the order as a sandbox order", 409);
  const applied = await applyCjOrderDetail(pool, target.fulfillment.UserId, target.order, target.fulfillment, detail);
  return { ...target, ...applied, detail };
}

function cjSandboxActionOrderReferences(target) {
  return [...new Set([
    target?.detail?.orderId,
    target?.fulfillment?.CjOrderId,
    target?.detail?.cjOrderCode,
    target?.fulfillment?.CjOrderCode,
  ].map((value) => String(value || "").trim()).filter(Boolean))];
}

async function runCjSandboxOrderAction(target, action) {
  const orderReferences = cjSandboxActionOrderReferences(target);
  let notFoundError = null;
  for (const orderReference of orderReferences) {
    try {
      return await action(orderReference);
    } catch (error) {
      if (Number(error?.code) !== 803) throw error;
      notFoundError = error;
    }
  }
  throw notFoundError || cjSandboxHttpError("No CJ sandbox order reference is available", 404);
}

async function previewCjSandboxStorefrontStage(pool, target, stage) {
  const allowedStages = new Set(["Packed", "Shipped", "In Transit", "Out for Delivery", "Delivered"]);
  if (!allowedStages.has(stage)) throw cjSandboxHttpError("Choose a valid storefront test stage", 400);
  const currentProgress = getTrackingProgress(target.order.status);
  const nextProgress = getTrackingProgress(stage);
  if (nextProgress < currentProgress) throw cjSandboxHttpError("Sandbox storefront stages cannot move backward", 409);
  const eventAt = new Date().toISOString();
  const updatedOrder = {
    ...target.order,
    status: stage,
    currentLocation: "CJ sandbox simulation",
    shippedAt: nextProgress >= 2 ? (target.order.shippedAt || eventAt) : target.order.shippedAt,
    deliveredAt: nextProgress === 5 ? (target.order.deliveredAt || eventAt) : target.order.deliveredAt,
  };
  await saveOrder(pool, target.fulfillment.UserId, updatedOrder);
  await insertTrackingEvent(pool, target.fulfillment.UserId, updatedOrder.id, {
    status: stage,
    title: stage,
    description: "Sandbox storefront preview set by an administrator. No real shipment was created.",
    location: "CJ sandbox simulation",
    eventAt,
  });
  return { ...target, order: updatedOrder };
}

async function runCjSandboxAdminAction(req, res, action, runner) {
  try {
    const pool = await getPool();
    const target = await loadCjSandboxOrderForAdmin(pool, req.params.orderId);
    const result = await runner(pool, target);
    await recordSecurityEvent({
      pool,
      eventType: "admin.cj_sandbox_action",
      severity: "high",
      actor: req.user?.id,
      resourceType: "storefront_order",
      resourceId: result.order.id,
      metadata: { action, cjStatus: String(result.detail?.subStatus || result.detail?.orderStatus || result.fulfillment?.CjStatus || "").slice(0, 50) },
    });
    return res.json({ ok: true, action, order: cjSandboxOrderSummary(result.fulfillment, result.order, result.detail) });
  } catch (error) {
    const statusCode = [400, 404, 409, 503].includes(Number(error?.statusCode)) ? Number(error.statusCode) : 502;
    const providerError = error?.name === "CjTrackingError";
    if (statusCode >= 500) console.error("CJ sandbox admin action failed", cjSubmissionFailureMessage(error));
    return res.status(statusCode).json({ error: providerError ? cjSubmissionFailureMessage(error) : (statusCode === 502 ? cjSubmissionFailureMessage(error) : error.message) });
  }
}
router.post("/api/cj/import", requireIntegrationsManage, async (req, res) => {
  try {
    const pid = (req.body?.pid ?? req.body?.Pid ?? req.body?.PID ?? "").toString().trim();
    const salePriceInput = req.body?.salePrice ?? req.body?.salesPrice ?? req.body?.price ?? req.body?.Price;
    const buyPriceInput = req.body?.buyPrice ?? req.body?.costPrice ?? req.body?.CostPrice;

    if (!pid) {
      return res.status(400).json({ error: "pid is required" });
    }

    if (salePriceInput === undefined || salePriceInput === null || String(salePriceInput).trim() === "") {
      return res.status(400).json({ error: "salePrice is required" });
    }

    const salePrice = Number(salePriceInput);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      return res.status(400).json({ error: "salePrice must be a non-negative number" });
    }

    const buyPrice = buyPriceInput === undefined || buyPriceInput === null || String(buyPriceInput).trim() === ""
      ? null
      : Number(buyPriceInput);
    if (buyPrice !== null && (!Number.isFinite(buyPrice) || buyPrice < 0)) {
      return res.status(400).json({ error: "buyPrice must be a non-negative number" });
    }

    const pool = await getPool();
    if (!(await ensureCjImportsTable(pool))) {
      const error = new Error("Required database schema is missing (Integration.CjImportMappings); apply database migration 011");
      error.code = "CJ_IMPORT_SCHEMA_MISSING";
      throw error;
    }
    const cjData = await fetchCjProduct(pid);
    if (!cjData || !normalizeCjProductData(cjData, pid)) {
      return res.status(404).json({ error: "Unable to find CJ product" });
    }
    const product = await insertOrUpdateCjProduct(pool, pid, salePrice, cjData, buyPrice);

    if (!product) {
      return res.status(500).json({ error: "Unable to import CJ product" });
    }

    // The local import is intentionally completed before the CJ store sync.
    // A temporary CJ store/API error must not lose the product from the site.
    const cjSync = await syncImportedCjProduct(pool, {
      pid,
      productId: product.id,
      product,
      raw: cjData,
    });

    res.status(201).json({
      ok: true,
      product,
      fetched: !!cjData,
      pid,
      cjSync,
    });
  } catch (err) {
    if (err && err.name === "CjRateLimitError") {
      return res.status(429).json({
        error: err.message || "CJ rate limited",
        retryAfterSeconds: err.retryAfterSeconds ?? null,
      });
    }
    console.error("/api/cj/import POST error:", err);
    const response = getCjImportPublicError(err);
    res.status(response.status).json({ error: response.error });
  }
});

router.post("/api/cj/import/:pid/connect", requireIntegrationsManage, async (req, res) => {
  const pid = String(req.params?.pid || "").trim();
  if (!pid) return res.status(400).json({ error: "pid is required" });

  try {
    const pool = await getPool();
    if (!(await ensureCjImportsTable(pool))) {
      return res.status(503).json({ error: "CJ imports are not configured yet. Apply database migration 011 and try again." });
    }
    const result = await pool.request()
      .input("Pid", sql.NVarChar(120), pid)
      .query(`
        SELECT TOP 1 map.Pid, map.ProductId, map.RawJson, p.*
        FROM [Integration].[CjImportMappings] map
        LEFT JOIN [dbo].[Products_tbl] p ON p.PID = map.ProductId
        WHERE map.Pid = @Pid;
      `);
    const row = normalizeResult(result)[0];
    if (!row) return res.status(404).json({ error: "Imported product not found" });

    let raw = null;
    try { raw = row.RawJson ? JSON.parse(row.RawJson) : null; } catch (_error) { raw = null; }
    const product = mapProductRow(row);
    const cjSync = await syncImportedCjProduct(pool, {
      pid,
      productId: row.ProductId,
      product,
      raw,
    });
    res.json({ ok: cjSync.status === "connected" || cjSync.status === "saved", pid, cjSync });
  } catch (err) {
    const provider = cjStoreSyncPublicError(err);
    console.error("/api/cj/import/:pid/connect POST error:", provider.error);
    res.status(502).json({ error: provider.error, code: provider.code });
  }
});

router.delete("/api/cj/import/:pid", requireIntegrationsManage, async (req, res) => {
  try {
    const pid = (req.params?.pid ?? "").toString().trim();
    if (!pid) {
      return res.status(400).json({ error: "pid is required" });
    }

    const pool = await getPool();
    await ensureCjImportsTable(pool);

    const lookup = await pool
      .request()
      .input("Pid", sql.NVarChar, pid)
      .query("SELECT TOP 1 ProductId FROM [Integration].[CjImportMappings] WHERE Pid = @Pid");

    const lookupRows = normalizeResult(lookup);
    if (!lookupRows.length) {
      return res.status(404).json({ error: "Imported product not found" });
    }

    const productId = Number(lookupRows[0].ProductId);

    if (storeSyncEnabled() && Number.isFinite(productId)) {
      try {
        await disconnectCjProductConnection({
          shopId: cjStoreConnectionConfig().shopId,
          platformProductId: productId,
        });
      } catch (err) {
        // Removing a local product should remain possible if CJ is offline;
        // an orphaned CJ connection can be removed from My CJ later.
        console.warn("Unable to disconnect CJ product before local deletion:", cjStoreSyncPublicError(err).error);
      }
    }

    await pool
      .request()
      .input("Pid", sql.NVarChar, pid)
      .query("DELETE FROM [Integration].[CjImportMappings] WHERE Pid = @Pid");

    let deletedProduct = null;
    if (Number.isFinite(productId)) {
      const deleteRequest = pool.request();
      await deleteProductChildren(deleteRequest, productId);
      const deleted = await pool
        .request()
        .input("ProductId", sql.Int, productId)
        .query(`
          DELETE FROM [dbo].[Products_tbl]
          OUTPUT DELETED.*
          WHERE PID = @ProductId
        `);
      const deletedRows = normalizeResult(deleted);
      if (deletedRows.length) {
        deletedProduct = mapProductRow(deletedRows[0]);
      }

    }

    res.json({ success: true, pid, productId: Number.isFinite(productId) ? productId : null, product: deletedProduct });
  } catch (err) {
    console.error("/api/cj/import DELETE error:", err);
    res.status(500).json({ error: "Unable to delete CJ import" });
  }
});

// Products route
router.get("/api/products", requireProductsRead, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[Products_tbl]");
    const rows = normalizeResult(result);

    const [imagesMap, addressMap, pricingMap] = await Promise.all([
      loadProductImages(pool),
      loadProductAddresses(pool),
      loadCanonicalProductPricing(pool, rows.map((row) => row.PID ?? row.id)),
    ]);

    const products = rows.map((row) => {
      const numericId = Number(row.PID ?? row.id);
      const product = mapProductRow(row, pricingMap.get(numericId));
      const numericProductId = Number(row.PID ?? row.id ?? product.id);
      if (Number.isFinite(numericProductId)) {
        product.images = imagesMap.get(numericProductId) || [];
        product.address = addressMap.get(numericProductId) || "";
      } else {
        product.images = [];
        product.address = "";
      }
      return product;
    });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Unable to load products" });
  }
});

router.post("/api/products", requireProductsManage, productUpload, verifyProductImages, async (req, res) => {
  try {
    const payload = normalizeProductInput(req.body);

    if (!payload.name) {
      await cleanupRequestUploads(req);
      return res.status(400).json({ error: "Product name is required" });
    }
    if (payload.salePrice < 0 || payload.buyPrice < 0 || payload.stock < 0) {
      await cleanupRequestUploads(req);
      return res.status(400).json({ error: "Sales price, buy price, and stock cannot be negative" });
    }

    const primaryImagePath = extractPrimaryImagePath(req);
    if (primaryImagePath) {
      payload.image = primaryImagePath;
    }

    const address = extractAddress(req.body);

    const pool = await getPool();
    const stockColumn = await getProductStockColumn(pool);
    const insertColumns = ["Category", "Brand", "Name", "Description", "Price", "Alt", "Img"];
    const insertValues = ["@Category", "@Brand", "@Name", "@Description", "@Price", "@Alt", "@Img"];

    let request = pool
      .request()
      .input("Category", sql.NVarChar, payload.category)
      .input("Brand", sql.NVarChar, payload.brand)
      .input("Name", sql.NVarChar, payload.name)
      .input("Description", sql.NVarChar, payload.description)
      .input("Price", sql.Decimal(18, 2), payload.price)
      .input("Alt", sql.NVarChar, payload.alt)
      .input("Img", sql.NVarChar, payload.image);

    if (stockColumn) {
      insertColumns.push(`[${stockColumn}]`);
      insertValues.push("@Stock");
      request = request.input("Stock", sql.Int, payload.stock);
    }

    const result = await request.query(`
      INSERT INTO [dbo].[Products_tbl] (${insertColumns.join(", ")})
      OUTPUT INSERTED.*
      VALUES (${insertValues.join(", ")})
    `);

    const rows = normalizeResult(result);
    if (!rows.length) {
      await cleanupRequestUploads(req);
      return res.status(500).json({ error: "Unable to insert product" });
    }

    const inserted = rows[0];
    const insertedId = inserted.PID ?? inserted.id ?? inserted.ProductId;
    const additionalImages = await collectAdditionalImages(req, pool, insertedId);
    const imageUrls = [...new Set([payload.image, ...additionalImages].filter(Boolean))];

    await Promise.all([
      saveProductImages(pool, insertedId, additionalImages),
      saveProductAddress(pool, insertedId, address),
      persistLegacyPricing(pool, insertedId, payload),
      persistLegacyTrending(pool, insertedId, payload.isTrending),
      ensureCanonicalProductForLegacy(pool, insertedId, payload, imageUrls),
    ]);

    const decorated = mapProductRow(inserted, {
      buyPrice: payload.buyPrice,
      salePrice: payload.salePrice,
      currency: payload.currency,
      stock: payload.stock,
    });
    decorated.images = await getProductImagesById(pool, insertedId);
    decorated.address = await getProductAddressById(pool, insertedId);

    res.status(201).json(decorated);
  } catch (err) {
    await cleanupRequestUploads(req);
    console.error("/api/products POST error:", err);
    res.status(500).json({ error: "Unable to create product" });
  }
});

router.put("/api/products/:productId", requireProductsManage, productUpload, verifyProductImages, async (req, res) => {
  const productId = Number(req.params.productId);

  if (!Number.isFinite(productId)) {
    await cleanupRequestUploads(req);
    return res.status(400).json({ error: "Invalid product id" });
  }

  try {
    const payload = normalizeProductInput(req.body);
    if (!payload.name) {
      await cleanupRequestUploads(req);
      return res.status(400).json({ error: "Product name is required" });
    }
    if (payload.salePrice < 0 || payload.buyPrice < 0 || payload.stock < 0) {
      await cleanupRequestUploads(req);
      return res.status(400).json({ error: "Sales price, buy price, and stock cannot be negative" });
    }

    const primaryImagePath = extractPrimaryImagePath(req);
    if (primaryImagePath) {
      payload.image = primaryImagePath;
    }

    const address = extractAddress(req.body);

    const pool = await getPool();
    const stockColumn = await getProductStockColumn(pool);

    const setClauses = [
      "Category = @Category",
      "Brand = @Brand",
      "Name = @Name",
      "Description = @Description",
      "Price = @Price",
      "Alt = @Alt",
      "Img = @Img",
    ];

    let request = pool
      .request()
      .input("ProductId", sql.Int, productId)
      .input("Category", sql.NVarChar, payload.category)
      .input("Brand", sql.NVarChar, payload.brand)
      .input("Name", sql.NVarChar, payload.name)
      .input("Description", sql.NVarChar, payload.description)
      .input("Price", sql.Decimal(18, 2), payload.price)
      .input("Alt", sql.NVarChar, payload.alt)
      .input("Img", sql.NVarChar, payload.image);

    if (stockColumn) {
      setClauses.push(`[${stockColumn}] = @Stock`);
      request = request.input("Stock", sql.Int, payload.stock);
    }

    const result = await request.query(`
      UPDATE [dbo].[Products_tbl]
      SET ${setClauses.join(", ")}
      OUTPUT INSERTED.*
      WHERE PID = @ProductId
    `);

    const rows = normalizeResult(result);
    if (!rows.length) {
      await cleanupRequestUploads(req);
      return res.status(404).json({ error: "Product not found" });
    }

    const updated = rows[0];
    const additionalImages = await collectAdditionalImages(req, pool, productId);
    const imageUrls = [...new Set([payload.image, ...additionalImages].filter(Boolean))];
    await Promise.all([
      saveProductImages(pool, productId, additionalImages),
      saveProductAddress(pool, productId, address),
      persistLegacyPricing(pool, productId, payload),
      persistLegacyTrending(pool, productId, payload.isTrending),
      ensureCanonicalProductForLegacy(pool, productId, payload, imageUrls),
    ]);

    const decorated = mapProductRow(updated, {
      buyPrice: payload.buyPrice,
      salePrice: payload.salePrice,
      currency: payload.currency,
      stock: payload.stock,
    });
    decorated.images = await getProductImagesById(pool, productId);
    decorated.address = await getProductAddressById(pool, productId);

    res.json(decorated);
  } catch (err) {
    await cleanupRequestUploads(req);
    console.error("/api/products PUT error:", err);
    res.status(500).json({ error: "Unable to update product" });
  }
});

router.delete("/api/products/:productId", requireProductsManage, async (req, res) => {
  const productId = Number(req.params.productId);

  if (!Number.isFinite(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  try {
    const pool = await getPool();
    await deleteProductChildren(pool.request(), productId);
    const result = await pool
      .request()
      .input("ProductId", sql.Int, productId)
      .query(`
        DELETE FROM [dbo].[Products_tbl]
        OUTPUT DELETED.*
        WHERE PID = @ProductId
      `);

    const rows = normalizeResult(result);
    if (!rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true, product: mapProductRow(rows[0]) });
  } catch (err) {
    console.error("/api/products DELETE error:", err);
    res.status(500).json({ error: "Unable to delete product" });
  }
});

// Home route
router.get("/api/home", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.HomeContent_tbl");
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/home error:", err);
    res.status(500).json({ error: "Unable to load home content" });
  }
});

// Shop route
router.get("/api/shop", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[Products_tbl]");
    const rows = normalizeResult(result);

    const [imagesMap, addressMap, pricingMap, cjContentMap] = await Promise.all([
      loadProductImages(pool),
      loadProductAddresses(pool),
      loadCanonicalProductPricing(pool, rows.map((row) => row.PID ?? row.id)),
      loadCjStorefrontContent(pool),
    ]);

    const products = rows.map((row) => {
      const numericRowId = Number(row.PID ?? row.id);
      const product = mapProductRow(row, pricingMap.get(numericRowId));
      const numericId = Number(row.PID ?? row.id ?? product.id);
      if (Number.isFinite(numericId)) {
        const cjContent = cjContentMap.get(numericId);
        product.images = [...new Set([...(imagesMap.get(numericId) || []), ...(cjContent?.images || [])])];
        product.address = addressMap.get(numericId) || "";
        if (cjContent) {
          product.isCjProduct = true;
          product.cjPid = cjContent.cjPid;
          product.buyerReviews = cjContent.buyerReviews;
          product.buyerReviewTotal = cjContent.buyerReviewTotal;
          if (cjContent.description) {
            product.description = cjContent.description;
          }
        }
      } else {
        product.images = [];
        product.address = "";
      }
      return product;
    });

    res.json(products);
  } catch (err) {
    console.error("/api/shop error:", err);
    res.status(500).json({ error: "Unable to load products" });
  }
});

// Category route
router.get("/api/category/:categoryId", async (req, res) => {
  try {
    const categoryId = String(req.params.categoryId || "").trim();
    if (!categoryId || categoryId.length > 100) {
      return res.status(400).json({ error: "Invalid category" });
    }
    const pool = await getPool();
    const result = await pool.request()
      .input("Category", sql.NVarChar(100), categoryId)
      .query("SELECT * FROM [dbo].[Products_tbl] WHERE [Category] = @Category");
    const rows = normalizeResult(result);

    if (rows.length > 0) {
      res.json({ category: rows[0] });
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  } catch (err) {
    console.error("/api/category error:", err);
    res.status(500).json({ error: "Unable to load category" });
  }
});

// Product page route
router.get("/api/product/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId < 1) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const pool = await getPool();
    const result = await pool.request()
      .input("ProductId", sql.Int, productId)
      .query("SELECT TOP 1 * FROM [dbo].[Products_tbl] WHERE [PID] = @ProductId");
    const rows = normalizeResult(result);

    if (rows.length > 0) {
      res.json({ product: rows[0] });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (err) {
    console.error("/api/product error:", err);
    res.status(500).json({ error: "Unable to load product" });
  }
});

module.exports = router;
