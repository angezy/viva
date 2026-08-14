const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require("fs");
const crypto = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET;
const sql = require('mssql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const {
  AUTH_COOKIE_NAME,
  GUEST_COOKIE_NAME,
  authCookieOptions,
  guestCookieOptions,
  clearCookieOptions,
} = require("../utils/cookieOptions");
const {
  isSendPulseMailerConfigured,
  sendPasswordResetCodeEmail,
} = require("../utils/sendpulse");

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
const upload = multer({ storage });
const productUpload = upload.fields([
  { name: "primaryImage", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "gallery", maxCount: 10 },
]);
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

// In-memory session stores (lightweight demo purposes)
const sessionCarts = new Map(); // userId -> [{ productId, title, price, quantity, image }]
const sessionOrders = new Map(); // userId -> [{ id, status, total, items, placedAt }]
const sessionPayments = new Map(); // userId -> Map(paymentId, payment)
const sessionCartCoupons = new Map(); // userId -> { code, discount }
const sessionSavedCartItems = new Map(); // userId -> saved cart items
let checkoutAttemptsTableEnsured = false;
let passwordResetTableEnsured = false;

const passwordResetCodeTtlMinutes = Math.min(60, Math.max(5, Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES) || 10));
const passwordResetMaxAttempts = Math.min(10, Math.max(3, Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS) || 5));
const passwordResetResendDelaySeconds = Math.min(300, Math.max(30, Number(process.env.PASSWORD_RESET_RESEND_DELAY_SECONDS) || 60));

function getTokenFromRequest(req) {
  const header = req.headers?.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  if (req.cookies && req.cookies.viva_token) {
    return req.cookies.viva_token;
  }
  return null;
}

function decodeToken(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const decoded = decodeToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role || "user",
  };
  next();
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (String(req.user?.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

function requireCheckoutIdentity(req, res, next) {
  const token = getTokenFromRequest(req);
  const decoded = decodeToken(token);
  if (decoded) {
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || "user",
    };
    req.checkoutUserId = String(decoded.sub);
    return next();
  }

  let guestId = req.cookies?.[GUEST_COOKIE_NAME];
  if (!guestId) {
    guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    res.cookie(GUEST_COOKIE_NAME, guestId, guestCookieOptions());
  }
  req.checkoutUserId = guestId;
  next();
}

function maybeAttachUser(req, _res, next) {
  const token = getTokenFromRequest(req);
  const decoded = decodeToken(token);
  if (decoded) {
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || "user",
    };
  }
  next();
}

function getCartForUser(userId) {
  if (!sessionCarts.has(userId)) sessionCarts.set(userId, []);
  return sessionCarts.get(userId);
}

function getOrdersForUser(userId) {
  if (!sessionOrders.has(userId)) {
    sessionOrders.set(userId, [
      {
        id: "ord-demo-1",
        status: "Delivered",
        total: 129.99,
        placedAt: new Date().toISOString(),
        items: [{ title: "Sample Trainer", quantity: 1, price: 129.99 }],
      },
    ]);
  }
  return sessionOrders.get(userId);
}

function findOrderForUser(userId, orderId) {
  const list = getOrdersForUser(userId);
  return list.find((ord) => String(ord.id) === String(orderId)) || null;
}

async function loadUserProfile(pool, userId, email) {
  if (!Number.isFinite(Number(userId))) return null;
  try {
    const result = await pool
      .request()
      .input("UserId", sql.Int, Number(userId))
      .query(`SELECT TOP 1 UserID, Username, Email, Role, CreatedAt, LastLogin FROM User_tbl WHERE UserID = @UserId`);
    const rows = normalizeResult(result);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      id: row.UserID,
      email: row.Email || email,
      username: row.Username || (email ? email.split("@")[0] : ""),
      role: row.Role || "user",
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

function getRequestIp(req) {
  const forwarded = req.headers && req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[0];
  }
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

async function ensurePasswordResetTable(pool) {
  if (passwordResetTableEnsured) return;

  await pool.request().query(`
    IF OBJECT_ID(N'dbo.password_reset_codes', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.password_reset_codes (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserID INT NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        CodeHash NVARCHAR(64) NOT NULL,
        ResetTokenHash NVARCHAR(64) NULL,
        ExpiresAt DATETIME2(3) NOT NULL,
        Attempts INT NOT NULL CONSTRAINT DF_password_reset_codes_Attempts DEFAULT 0,
        VerifiedAt DATETIME2(3) NULL,
        UsedAt DATETIME2(3) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_password_reset_codes_CreatedAt DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_password_reset_codes_Email_CreatedAt
        ON dbo.password_reset_codes (Email, CreatedAt DESC);
    END
  `);
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
    name: row.CustomerName ?? row.customerName ?? "Weluxo customer",
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

async function upsertCanonicalProductPricing(pool, productId, payload) {
  if (!(await getCanonicalCatalogState(pool))) return false;
  const productResult = await pool.request()
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
      SELECT p.[LegacyProductId], p.[Id] AS [CanonicalProductId], p.[SKU],
             v.[Id] AS [VariantId], v.[CostPrice], v.[SellingPrice], v.[CompareAtPrice],
             v.[Currency], v.[AvailableQuantity], p.[IsTrending]
      FROM [Commerce].[Products] p
      LEFT JOIN [Commerce].[ProductVariants] v ON v.[Id] = p.[DefaultVariantId]
      WHERE p.[LegacyProductId] IN (${parameters.join(", ")});
    `);
    const mapped = new Map();
    normalizeResult(result).forEach((row) => mapped.set(Number(row.LegacyProductId), {
      canonicalProductId: row.CanonicalProductId,
      sku: row.SKU,
      variantId: row.VariantId,
      buyPrice: numericValue(row.CostPrice),
      salePrice: numericValue(row.SellingPrice),
      compareAtPrice: row.CompareAtPrice == null ? null : numericValue(row.CompareAtPrice),
      currency: row.Currency || "USD",
      stock: numericValue(row.AvailableQuantity),
      isTrending: booleanValue(row.IsTrending),
    }));
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

    const desired = {
      Name: { type: "nvarchar", length: 255 },
      Brand: { type: "nvarchar", length: 100 },
      Category: { type: "nvarchar", length: 100 },
      Description: { type: "nvarchar", length: "max" },
      IMG: { type: "nvarchar", length: 500 },
      Img: { type: "nvarchar", length: 500 },
    };

    for (const row of rows) {
      const columnName = row.COLUMN_NAME;
      const spec = desired[columnName];
      if (!spec) continue;

      const currentType = String(row.DATA_TYPE || "").toLowerCase();
      const currentLen = row.CHARACTER_MAXIMUM_LENGTH;
      const nullable = String(row.IS_NULLABLE || "").toUpperCase() === "YES" ? "NULL" : "NOT NULL";

      const wantsMax = spec.length === "max";
      const currentIsMax = currentLen === -1;
      const needsTypeChange = currentType !== spec.type;
      const needsLenChange =
        wantsMax ? !currentIsMax : typeof currentLen === "number" && currentLen > 0 ? currentLen < spec.length : true;

      if (!(needsTypeChange || needsLenChange)) continue;

      const lengthSql = wantsMax ? "MAX" : String(spec.length);
      await pool.request().query(
        `ALTER TABLE [dbo].[Products_tbl] ALTER COLUMN [${columnName}] ${spec.type.toUpperCase()}(${lengthSql}) ${nullable};`
      );
    }

    productsSchemaEnsuredForCj = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure Products_tbl column sizes:", err);
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
let ordersTableEnsured = false;
let orderTrackingTableEnsured = false;

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
    await pool
      .request()
      .query(`
        IF OBJECT_ID('[dbo].[ProductImages_tbl]', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[ProductImages_tbl] (
            ImageId INT IDENTITY(1,1) PRIMARY KEY,
            ProductId INT NOT NULL,
            ImagePath NVARCHAR(255) NOT NULL,
            CreatedAt DATETIME DEFAULT GETDATE()
          );
          CREATE INDEX IX_ProductImages_ProductId ON [dbo].[ProductImages_tbl](ProductId);
        END
      `);
    productImagesTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure ProductImages_tbl:", err);
    return false;
  }
}

async function ensureProductAddressesTable(pool) {
  if (productAddressesTableEnsured) return true;
  try {
    await pool
      .request()
      .query(`
        IF OBJECT_ID('[dbo].[ProductAddress_tbl]', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[ProductAddress_tbl] (
            AddressId INT IDENTITY(1,1) PRIMARY KEY,
            ProductId INT NOT NULL UNIQUE,
            AddressLine NVARCHAR(255) NOT NULL,
            CreatedAt DATETIME DEFAULT GETDATE()
          );
        END
      `);
    productAddressesTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure ProductAddress_tbl:", err);
    return false;
  }
}

async function ensureOrdersTable(pool) {
  if (ordersTableEnsured) return true;
  try {
    await pool.request().query(`
      IF OBJECT_ID('[dbo].[Orders_tbl]', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[Orders_tbl] (
          OrderId NVARCHAR(64) PRIMARY KEY,
          UserId NVARCHAR(64) NOT NULL,
          Status NVARCHAR(50) NOT NULL,
          Total DECIMAL(18,2) NOT NULL,
          Items NVARCHAR(MAX) NOT NULL,
          ShippingAddress NVARCHAR(MAX) NULL,
          PaymentMethod NVARCHAR(30) NULL,
          PaymentStatus NVARCHAR(30) NULL,
          Carrier NVARCHAR(80) NULL,
          TrackingNumber NVARCHAR(120) NULL,
          EstimatedDelivery DATE NULL,
          CurrentLocation NVARCHAR(160) NULL,
          ShippedAt DATETIME2 NULL,
          DeliveredAt DATETIME2 NULL,
          PlacedAt DATETIME NOT NULL DEFAULT GETDATE()
        );
        CREATE INDEX IX_Orders_UserId ON [dbo].[Orders_tbl](UserId);
      END
      IF COL_LENGTH('dbo.Orders_tbl', 'ShippingAddress') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD ShippingAddress NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'PaymentMethod') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD PaymentMethod NVARCHAR(30) NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'PaymentStatus') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD PaymentStatus NVARCHAR(30) NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'Carrier') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD Carrier NVARCHAR(80) NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'TrackingNumber') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD TrackingNumber NVARCHAR(120) NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'EstimatedDelivery') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD EstimatedDelivery DATE NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'CurrentLocation') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD CurrentLocation NVARCHAR(160) NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'ShippedAt') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD ShippedAt DATETIME2 NULL;
      IF COL_LENGTH('dbo.Orders_tbl', 'DeliveredAt') IS NULL
        ALTER TABLE [dbo].[Orders_tbl] ADD DeliveredAt DATETIME2 NULL;
    `);
    ordersTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure Orders_tbl:", err);
    return false;
  }
}

async function ensureCanonicalProductForLegacy(pool, productId, payload, imageUrls = []) {
  if (!(await getCanonicalCatalogState(pool))) return false;

  const numericProductId = Number(productId);
  if (!Number.isFinite(numericProductId)) return false;

  const existingResult = await pool.request()
    .input("LegacyProductId", sql.Int, numericProductId)
    .query(`
      SELECT TOP 1 [Id], [DefaultVariantId]
      FROM [Commerce].[Products]
      WHERE [LegacyProductId] = @LegacyProductId;
    `);
  let product = normalizeResult(existingResult)[0] || null;
  const sku = String(payload.sku || `LEGACY-${numericProductId}`).trim().slice(0, 100) || `LEGACY-${numericProductId}`;
  const slug = `legacy-${numericProductId}`;

  if (!product) {
    let request = pool.request()
      .input("LegacyProductId", sql.Int, numericProductId)
      .input("SKU", sql.NVarChar(100), sku)
      .input("Name", sql.NVarChar(255), payload.name || `Product ${numericProductId}`)
      .input("Slug", sql.NVarChar(255), slug)
      .input("ShortDescription", sql.NVarChar(500), String(payload.description || "").slice(0, 500))
      .input("Description", sql.NVarChar(sql.MAX), payload.description || "")
      .input("Brand", sql.NVarChar(100), payload.brand || "Generic");

    try {
      await request.query(`
        SET IDENTITY_INSERT [Commerce].[Products] ON;
        INSERT INTO [Commerce].[Products]
          ([Id], [LegacyProductId], [SKU], [Name], [Slug], [ShortDescription], [Description], [Brand], [Status], [ProductType], [PublishedAt])
        VALUES (NEWID(), @LegacyProductId, @SKU, @Name, @Slug, @ShortDescription, @Description, @Brand, N'Active', N'Physical', SYSUTCDATETIME());
        SET IDENTITY_INSERT [Commerce].[Products] OFF;
      `);
    } catch (err) {
      try {
        await pool.request().query("SET IDENTITY_INSERT [Commerce].[Products] OFF;");
      } catch (_cleanupError) {
        // Preserve the original error.
      }
      throw err;
    }

    const insertedResult = await pool.request()
      .input("LegacyProductId", sql.Int, numericProductId)
      .query(`SELECT TOP 1 [Id], [DefaultVariantId] FROM [Commerce].[Products] WHERE [LegacyProductId] = @LegacyProductId;`);
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
  });

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
    await pool.request().query(`
      IF OBJECT_ID('[dbo].[OrderTrackingEvents_tbl]', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[OrderTrackingEvents_tbl] (
          TrackingEventId BIGINT IDENTITY(1,1) PRIMARY KEY,
          OrderId NVARCHAR(64) NOT NULL,
          UserId NVARCHAR(64) NOT NULL,
          Status NVARCHAR(50) NOT NULL,
          Title NVARCHAR(160) NOT NULL,
          Description NVARCHAR(600) NULL,
          Location NVARCHAR(160) NULL,
          EventAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          IsPublic BIT NOT NULL DEFAULT 1
        );
        CREATE INDEX IX_OrderTrackingEvents_Order
          ON [dbo].[OrderTrackingEvents_tbl](OrderId, UserId, EventAt DESC);
      END
    `);
    orderTrackingTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure OrderTrackingEvents_tbl:", err);
    return false;
  }
}

async function ensureCheckoutAttemptsTable(pool) {
  if (checkoutAttemptsTableEnsured) return true;
  try {
    await pool.request().query(`
      IF OBJECT_ID('[dbo].[checkout_attempts]', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[checkout_attempts] (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          attempt_id NVARCHAR(120) NOT NULL UNIQUE,
          user_id NVARCHAR(128) NULL,
          cart_id NVARCHAR(128) NULL,
          customer_email NVARCHAR(255) NULL,
          status NVARCHAR(40) NOT NULL,
          payment_error NVARCHAR(1000) NULL,
          payment_id NVARCHAR(120) NULL,
          created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 NULL,
          completed_at DATETIME2 NULL
        );
        CREATE INDEX IX_checkout_attempts_user_id
          ON [dbo].[checkout_attempts](user_id, created_at DESC);
        CREATE INDEX IX_checkout_attempts_status
          ON [dbo].[checkout_attempts](status, created_at DESC);
      END
    `);
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
        MERGE [dbo].[checkout_attempts] AS target
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
  const shippingMethod = order.shippingAddress?.shippingMethod === "express" ? "express" : "standard";
  const estimatedDelivery = order.estimatedDelivery || addOrderDays(order.placedAt, shippingMethod === "express" ? 3 : 8);
  const eventCount = Math.max(1, progressIndex + 1);
  const events = orderTrackingSteps.slice(0, eventCount).map((step, index) => ({
    status: step.status,
    title: step.title,
    description: step.description,
    location: index >= 2 ? (order.currentLocation || "Delivery network") : "Weluxo fulfillment center",
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
        FROM [dbo].[OrderTrackingEvents_tbl]
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

function getPaymentsForUser(userId) {
  if (!sessionPayments.has(userId)) sessionPayments.set(userId, new Map());
  return sessionPayments.get(userId);
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

function buildStripeCheckoutBody({ userId, cart, amount, currency, customerEmail, shippingMethod }) {
  const config = getPaymentProviderConfig();
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${config.appBaseUrl}/checkout/return?status=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${config.appBaseUrl}/checkout/return?status=cancelled&session_id={CHECKOUT_SESSION_ID}`);
  body.set("metadata[user_id]", String(userId));
  body.set("metadata[shipping_method]", shippingMethod);
  body.set("metadata[currency]", currency);
  body.set("payment_intent_data[metadata][user_id]", String(userId));
  if (customerEmail) body.set("customer_email", customerEmail);

  cart.forEach((item, index) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitAmount = Math.max(0, Math.round((Number(item.price) || 0) * 100));
    body.set(`line_items[${index}][price_data][currency]`, currency.toLowerCase());
    body.set(`line_items[${index}][price_data][product_data][name]`, String(item.title || "Weluxo product").slice(0, 250));
    body.set(`line_items[${index}][price_data][unit_amount]`, String(unitAmount));
    body.set(`line_items[${index}][quantity]`, String(quantity));
  });

  if (shippingMethod === "express") {
    const index = cart.length;
    body.set(`line_items[${index}][price_data][currency]`, currency.toLowerCase());
    body.set(`line_items[${index}][price_data][product_data][name]`, "Express shipping");
    body.set(`line_items[${index}][price_data][unit_amount]`, "1999");
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
      .query("SELECT * FROM [dbo].[Orders_tbl] WHERE UserId = @UserId ORDER BY PlacedAt DESC");
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
      .query("SELECT TOP 1 * FROM [dbo].[Orders_tbl] WHERE UserId = @UserId AND OrderId = @OrderId");
    const rows = normalizeResult(result);
    return rows.length ? mapOrderRow(rows[0]) : null;
  } catch (err) {
    console.error("loadOrderById failed", err);
    return null;
  }
}

async function saveOrder(pool, userId, order) {
  const ensured = await ensureOrdersTable(pool);
  if (!ensured) return false;
  try {
    const itemsJson = JSON.stringify(order.items || []);
    await pool
      .request()
      .input("OrderId", sql.NVarChar, String(order.id))
      .input("UserId", sql.NVarChar, String(userId))
      .input("Status", sql.NVarChar, order.status || "Processing")
      .input("Total", sql.Decimal(18, 2), Number(order.total) || 0)
      .input("Items", sql.NVarChar, itemsJson)
      .input("ShippingAddress", sql.NVarChar, JSON.stringify(order.shippingAddress || {}))
      .input("PaymentMethod", sql.NVarChar, order.paymentMethod || null)
      .input("PaymentStatus", sql.NVarChar, order.paymentStatus || "pending")
      .input("Carrier", sql.NVarChar(80), order.carrier || null)
      .input("TrackingNumber", sql.NVarChar(120), order.trackingNumber || null)
      .input("EstimatedDelivery", sql.DateTime, order.estimatedDelivery ? new Date(order.estimatedDelivery) : null)
      .input("CurrentLocation", sql.NVarChar(160), order.currentLocation || null)
      .input("ShippedAt", sql.DateTime, order.shippedAt ? new Date(order.shippedAt) : null)
      .input("DeliveredAt", sql.DateTime, order.deliveredAt ? new Date(order.deliveredAt) : null)
      .input("PlacedAt", sql.DateTime, order.placedAt ? new Date(order.placedAt) : new Date())
      .query(`
        MERGE [dbo].[Orders_tbl] AS target
        USING (SELECT @OrderId AS OrderId, @UserId AS UserId) AS source
        ON target.OrderId = source.OrderId AND target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET Status = @Status, Total = @Total, Items = @Items, ShippingAddress = @ShippingAddress, PaymentMethod = @PaymentMethod, PaymentStatus = @PaymentStatus, Carrier = @Carrier, TrackingNumber = @TrackingNumber, EstimatedDelivery = @EstimatedDelivery, CurrentLocation = @CurrentLocation, ShippedAt = @ShippedAt, DeliveredAt = @DeliveredAt, PlacedAt = @PlacedAt
        WHEN NOT MATCHED THEN
          INSERT (OrderId, UserId, Status, Total, Items, ShippingAddress, PaymentMethod, PaymentStatus, Carrier, TrackingNumber, EstimatedDelivery, CurrentLocation, ShippedAt, DeliveredAt, PlacedAt)
          VALUES (@OrderId, @UserId, @Status, @Total, @Items, @ShippingAddress, @PaymentMethod, @PaymentStatus, @Carrier, @TrackingNumber, @EstimatedDelivery, @CurrentLocation, @ShippedAt, @DeliveredAt, @PlacedAt);
      `);
    return true;
  } catch (err) {
    console.error("saveOrder failed", err);
    return false;
  }
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
        FROM [dbo].[ProductImages_tbl]
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
      .query("SELECT ProductId, ImagePath FROM [dbo].[ProductImages_tbl] ORDER BY ImageId ASC");
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
    await pool.request().input("ProductId", sql.Int, productId).query("DELETE FROM [dbo].[ProductImages_tbl] WHERE ProductId = @ProductId");
    for (const imagePath of imagePaths) {
      if (typeof imagePath !== "string" || imagePath.length === 0) continue;
      await pool
        .request()
        .input("ProductId", sql.Int, productId)
        .input("ImagePath", sql.NVarChar, imagePath)
        .query("INSERT INTO [dbo].[ProductImages_tbl] (ProductId, ImagePath) VALUES (@ProductId, @ImagePath)");
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
    const customerEmail = String(shipping.email || `guest-${String(userId).replace(/[^a-z0-9]/gi, "") || "customer"}@weluxo.local`)
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
      const shippingAmount = Math.max(0, Number(order.shippingAmount) || 0);
      const total = Math.max(0, Number(order.total) || 0);
      const paymentStatus = String(order.paymentStatus || "pending").toLowerCase() === "paid" ? "Paid" : "Pending";
      const orderStatus = String(order.status || "Processing").slice(0, 40) || "Processing";

      const mergeResult = await new sql.Request(transaction)
        .input("LegacyOrderId", sql.NVarChar(64), String(order.id))
        .input("OrderNumber", sql.NVarChar(50), String(order.id).slice(0, 50))
        .input("CustomerId", sql.UniqueIdentifier, customerId)
        .input("Currency", sql.Char(3), String(order.currency || "USD").toUpperCase().slice(0, 3))
        .input("OrderStatus", sql.NVarChar(40), orderStatus)
        .input("PaymentStatus", sql.NVarChar(40), paymentStatus)
        .input("SubtotalAmount", sql.Decimal(19, 4), subtotal)
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
            [PaymentStatus] = @PaymentStatus, [SubtotalAmount] = @SubtotalAmount,
            [ShippingAmount] = @ShippingAmount, [TotalAmount] = @TotalAmount,
            [CustomerEmail] = @CustomerEmail, [CustomerPhone] = @CustomerPhone,
            [PlacedAt] = @PlacedAt, [PaidAt] = CASE WHEN @PaymentStatus = N'Paid' THEN COALESCE([PaidAt], SYSUTCDATETIME()) ELSE [PaidAt] END,
            [UpdatedAt] = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT
            ([LegacyOrderId], [OrderNumber], [CustomerId], [Currency], [OrderStatus], [PaymentStatus],
             [FulfillmentStatus], [SubtotalAmount], [ShippingAmount], [TotalAmount], [CustomerEmail],
             [CustomerPhone], [SalesChannel], [Source], [PlacedAt], [PaidAt])
          VALUES
            (@LegacyOrderId, @OrderNumber, @CustomerId, @Currency, @OrderStatus, @PaymentStatus,
             N'Unfulfilled', @SubtotalAmount, @ShippingAmount, @TotalAmount, @CustomerEmail,
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
      IF OBJECT_ID(N'[dbo].[CjImportedProducts_tbl]', N'U') IS NOT NULL
        DELETE FROM [dbo].[CjImportedProducts_tbl] WHERE ProductId = @ProductId;
      IF OBJECT_ID(N'[dbo].[ProductAddress_tbl]', N'U') IS NOT NULL
        DELETE FROM [dbo].[ProductAddress_tbl] WHERE ProductId = @ProductId;
      IF OBJECT_ID(N'[dbo].[ProductImages_tbl]', N'U') IS NOT NULL
        DELETE FROM [dbo].[ProductImages_tbl] WHERE ProductId = @ProductId;
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
      .query("SELECT AddressLine FROM [dbo].[ProductAddress_tbl] WHERE ProductId = @ProductId");
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
    const result = await pool.request().query("SELECT ProductId, AddressLine FROM [dbo].[ProductAddress_tbl]");
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
      await pool.request().input("ProductId", sql.Int, productId).query("DELETE FROM [dbo].[ProductAddress_tbl] WHERE ProductId = @ProductId");
      return;
    }
    await pool
      .request()
      .input("ProductId", sql.Int, productId)
      .input("AddressLine", sql.NVarChar, sanitized)
      .query(`
        MERGE [dbo].[ProductAddress_tbl] AS target
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
async function ensureCjImportsTable(pool) {
  if (cjImportTableEnsured) return true;
  try {
    await pool.request().query(`
      IF OBJECT_ID('[dbo].[CjImportedProducts_tbl]', 'U') IS NULL
      BEGIN
        CREATE TABLE [dbo].[CjImportedProducts_tbl] (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Pid NVARCHAR(120) NOT NULL UNIQUE,
          ProductId INT NOT NULL UNIQUE,
          Price DECIMAL(18,2) NOT NULL,
          RawJson NVARCHAR(MAX) NULL,
          CreatedAt DATETIME DEFAULT GETDATE(),
          UpdatedAt DATETIME DEFAULT GETDATE()
        );
        CREATE INDEX IX_CjImports_ProductId ON [dbo].[CjImportedProducts_tbl](ProductId);
      END
    `);
    cjImportTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure CjImportedProducts_tbl:", err);
    return false;
  }
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

  const images = [];
  if (typeof rich.bigImage === "string" && rich.bigImage.trim().length > 0) {
    images.push(rich.bigImage.trim());
  }
  if (typeof rich.mainImage === "string" && rich.mainImage.trim().length > 0) {
    images.push(rich.mainImage.trim());
  }
  if (Array.isArray(rich.images)) {
    rich.images.forEach((img) => {
      if (typeof img === "string" && img.trim().length > 0) images.push(img.trim());
      if (img && typeof img === "object") {
        const value = img.url || img.imageUrl || img.src || img.path || img.bigImage || img.mainImage;
        if (typeof value === "string" && value.trim().length > 0) images.push(value.trim());
      }
    });
  }
  if (Array.isArray(rich.imageList)) {
    rich.imageList.forEach((img) => {
      if (typeof img === "string" && img.trim().length > 0) images.push(img.trim());
      if (img && typeof img === "object") {
        const value = img.url || img.imageUrl || img.src || img.path || img.bigImage || img.mainImage;
        if (typeof value === "string" && value.trim().length > 0) images.push(value.trim());
      }
    });
  }
  if (typeof rich.productImage === "string") {
    rich.productImage
      .split(/[,|\n]/)
      .map((img) => img.trim())
      .filter(Boolean)
      .forEach((img) => images.push(img));
  }
  if (Array.isArray(rich.productImage)) {
    rich.productImage.forEach((img) => {
      if (typeof img === "string" && img.trim().length > 0) images.push(img.trim());
      if (img && typeof img === "object") {
        const value = img.url || img.imageUrl || img.src || img.path || img.bigImage || img.mainImage;
        if (typeof value === "string" && value.trim().length > 0) images.push(value.trim());
      }
    });
  }
  if (Array.isArray(rich.variantList)) {
    rich.variantList.forEach((variant) => {
      if (!variant || typeof variant !== "object") return;
      const value =
        variant.variantImage ||
        variant.variantImageUrl ||
        variant.image ||
        variant.imageUrl ||
        variant.bigImage ||
        variant.mainImage ||
        null;
      if (typeof value === "string" && value.trim().length > 0) images.push(value.trim());
      const list = variant.images || variant.imageList || null;
      if (Array.isArray(list)) {
        list.forEach((img) => {
          if (typeof img === "string" && img.trim().length > 0) images.push(img.trim());
        });
      }
    });
  }

  const placeholder = process.env.CJ_FALLBACK_IMAGE || "https://picsum.photos/seed/cj-product/600/400";
  const cover =
    rich.mainImage ||
    rich.cover ||
    rich.image ||
    rich.img ||
    rich.imageUrl ||
    rich.bigImage ||
    rich.productImage ||
    images[0] ||
    placeholder;

  const description =
    rich.description ||
    rich.desc ||
    rich.productDescription ||
    rich.productDescriptionEn ||
    rich.detail ||
    rich.remark ||
    "";

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
  const brand =
    rich.brand ||
    rich.vendorName ||
    rich.storeName ||
    rich.supplierName ||
    "CJ Dropshipping";

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

  const uniqImages = [...new Set(images.map((img) => String(img || "").trim()).filter(Boolean))];

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
      if (detailRes.ok && payload?.data) return payload;
    }
    return null;
  };

  let resolvedPid = shouldTreatAsPid ? input : null;
  if (!resolvedPid) {
    const listUrl = `${listBase}${listBase.includes("?") ? "&" : "?"}page=1&size=20&keyWord=${encodeURIComponent(input)}`;
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
    await pool
      .request()
      .input("Pid", sql.NVarChar, pid)
      .input("ProductId", sql.Int, productId)
      .input("Price", sql.Decimal(18, 2), Number(price) || 0)
      .input("RawJson", sql.NVarChar, rawJson ? JSON.stringify(rawJson).slice(0, 3999) : null)
      .query(`
        MERGE [dbo].[CjImportedProducts_tbl] AS target
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
    ? normalized.brand || "CJ Dropshipping"
    : truncateString(normalized.brand || "CJ Dropshipping", 50);
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
    .query("SELECT TOP 1 ProductId FROM [dbo].[CjImportedProducts_tbl] WHERE Pid = @Pid");

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
      .input("Brand", sql.NVarChar(100), brandDb || current?.brand || "CJ Dropshipping")
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
      .filter((img) => img.length <= 255)
      .slice(0, 30);

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
    .filter((img) => img.length <= 255)
    .slice(0, 30);

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
      const result = await pool.request().query(`
      SELECT map.Pid, map.ProductId, map.Price AS ImportedPrice, map.CreatedAt, map.UpdatedAt,
              p.*
      FROM [dbo].[CjImportedProducts_tbl] map
      LEFT JOIN [dbo].[Products_tbl] p ON p.PID = map.ProductId
      ORDER BY map.UpdatedAt DESC
    `);
    const rows = normalizeResult(result);
    const imagesMap = await loadProductImages(pool);
    const pricingMap = await loadCanonicalProductPricing(pool, rows.map((row) => row.ProductId));
    return rows.map((row) => ({
      pid: row.Pid,
      productId: row.ProductId,
      price: numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.salePrice, row.SalePrice, row.Price), 0),
      salePrice: numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.salePrice, row.SalePrice, row.Price), 0),
      buyPrice: numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.buyPrice, row.BuyPrice, row.ImportedPrice), 0),
      unitProfit: numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.salePrice, row.SalePrice, row.Price), 0) - numericValue(firstDefined(pricingMap.get(Number(row.ProductId))?.buyPrice, row.BuyPrice, row.ImportedPrice), 0),
      createdAt: row.CreatedAt ?? null,
      updatedAt: row.UpdatedAt ?? null,
      name: row.Name ?? null,
      description: row.Description ?? null,
      images: imagesMap.get(Number(row.ProductId)) || [],
      img: row.Img ?? row.IMG ?? imagesMap.get(Number(row.ProductId))?.[0] ?? null,
    }));
  } catch (err) {
    console.error("Unable to load CJ import mappings:", err);
    return [];
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

// List all views in the database
router.get("/api/views", requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS`);
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/views error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all values from a selected table
router.get("/api/table-values", requireAdmin, async (req, res) => {
  const { schema, name } = req.query;
  if (!schema || !name) return res.status(400).json({ error: "Missing schema or name" });
  try {
    const pool = await getPool();
    console.log("Fetching table:", schema, name);
    const result = await pool.request().query(`SELECT * FROM [${schema}].[${name}]`);
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/table-values error:", err);
    res.status(500).json({ error: err.message });
  }
});


// List all tables in the database
router.get("/api/tables", requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TABLE_SCHEMA, TABLE_NAME 
              FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_TYPE = 'BASE TABLE'`);
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/tables error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get current date from SQL
router.get("/api/date", async (req, res) => {
  try {
    const pool = await getPool();
    let result = await pool.request().query("SELECT GETDATE() AS now");

    const rows = normalizeResult(result);

    console.log("Full result:", result);
    console.log("Normalized rows:", rows);

    if (rows.length > 0) {
      console.log("First row:", rows[0]);
    }
    
    res.json(rows);
  } catch (err) {
    console.error("/api/date error:", err);
    res.status(500).json({ error: err.message });
  }
});



// REGISTER
router.post("/api/register", async (req, res) => {
  const { username, email, password, country, state, city, zip, address, phone, smsMarketing, firstName, lastName, birthdayMonth, birthdayDay } = req.body;
  const generatedUsername = String(username || `${firstName || "user"}.${lastName || "account"}`).trim().slice(0, 100);

  if (!generatedUsername || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await getPool();
    const clientIp = getRequestIp(req);

    const existing = await findUserByEmail(pool, email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    await pool.request()
      .input("Username", sql.NVarChar, generatedUsername)
      .input("Email", sql.NVarChar, email)
      .input("PasswordHash", sql.NVarChar, hashedPassword)
      .input("Role", sql.NVarChar, "user")
      .query(`
        INSERT INTO User_tbl (Username, Email, PasswordHash, Role, CreatedAt)
        VALUES (@Username, @Email, @PasswordHash, @Role, GETDATE())
      `);

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
      let updateReq = pool.request().input("Email", sql.NVarChar, email);
      const setClauses = [];
      optionalUpdates.forEach((field, idx) => {
        setClauses.push(`[${field.name}] = @opt${idx}`);
        updateReq = updateReq.input(`opt${idx}`, sql.NVarChar, field.value);
      });
      await updateReq.query(`UPDATE User_tbl SET ${setClauses.join(", ")} WHERE Email = @Email`);
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("/api/register error:", err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/api/register/admin", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await getPool();
    const clientIp = getRequestIp(req);

    const existing = await findUserByEmail(pool, email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    await pool.request()
      .input("Username", sql.NVarChar, username)
      .input("Email", sql.NVarChar, email)
      .input("PasswordHash", sql.NVarChar, hashedPassword)
      .input("Role", sql.NVarChar, "admin")
      .query(`
        INSERT INTO User_tbl (Username, Email, PasswordHash, Role, CreatedAt)
        VALUES (@Username, @Email, @PasswordHash, @Role, GETDATE())
      `);

    if (clientIp && (await hasUserColumn(pool, "signupip"))) {
      await pool
        .request()
        .input("Email", sql.NVarChar, email)
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

  // Do not accept reset requests until the server has a real transactional mailer.
  if (!isSendPulseMailerConfigured()) {
    return res.status(503).json({ error: "Password reset email is not configured" });
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
          AND LOWER(ISNULL(Role, 'user')) <> 'admin'
      `);
    const users = normalizeResult(userResult);

    // Keep account existence private.
    if (!users.length) {
      return res.json({ ok: true, message: genericMessage });
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
    const expiresAt = new Date(Date.now() + passwordResetCodeTtlMinutes * 60 * 1000);

    await pool.request()
      .input("UserID", sql.Int, users[0].UserID)
      .input("Email", sql.NVarChar(255), email)
      .input("CodeHash", sql.NVarChar(64), codeHash)
      .input("ExpiresAt", sql.DateTime2, expiresAt)
      .query(`
        UPDATE dbo.password_reset_codes
        SET UsedAt = SYSUTCDATETIME()
        WHERE Email = @Email AND UsedAt IS NULL;

        INSERT INTO dbo.password_reset_codes (UserID, Email, CodeHash, ExpiresAt)
        VALUES (@UserID, @Email, @CodeHash, @ExpiresAt)
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
      .input("MaxAttempts", sql.Int, passwordResetMaxAttempts)
      .query(`
        SELECT TOP 1 Id, CodeHash, Attempts
        FROM dbo.password_reset_codes
        WHERE Email = @Email
          AND UsedAt IS NULL
          AND VerifiedAt IS NULL
          AND ExpiresAt > SYSUTCDATETIME()
          AND Attempts < @MaxAttempts
        ORDER BY CreatedAt DESC
      `);
    const rows = normalizeResult(result);
    const resetCode = rows[0];

    if (!resetCode || resetCode.CodeHash !== codeHash) {
      if (resetCode) {
        await pool.request()
          .input("Id", sql.BigInt, resetCode.Id)
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
            VerifiedAt = SYSUTCDATETIME(),
            Attempts = Attempts + 1
        WHERE Id = @Id AND UsedAt IS NULL AND VerifiedAt IS NULL
      `);
    if (!updateResult.rowsAffected?.[0]) {
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
  if (password.length < 6 || password.length > 12) {
    return res.status(400).json({ error: "Password must be between 6 and 12 characters" });
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
            AND LOWER(ISNULL(u.Role, 'user')) <> 'admin'
          ORDER BY r.VerifiedAt DESC
        `);
      const resetRows = normalizeResult(resetResult);
      if (!resetRows.length) {
        await transaction.rollback();
        return res.status(400).json({ error: "Your password reset session is invalid or expired" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const passwordResult = await new sql.Request(transaction)
        .input("UserID", sql.Int, resetRows[0].UserID)
        .input("PasswordHash", sql.NVarChar(255), passwordHash)
        .query(`
          UPDATE User_tbl
          SET PasswordHash = @PasswordHash
          WHERE UserID = @UserID
            AND LOWER(ISNULL(Role, 'user')) <> 'admin'
        `);
      if (!passwordResult.rowsAffected?.[0]) {
        await transaction.rollback();
        return res.status(400).json({ error: "Your password reset session is invalid or expired" });
      }

      await new sql.Request(transaction)
        .input("UserID", sql.Int, resetRows[0].UserID)
        .query("UPDATE dbo.password_reset_codes SET UsedAt = SYSUTCDATETIME() WHERE UserID = @UserID AND UsedAt IS NULL");

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

// LOGIN
async function handleLogin(req, res, expectedRoleOverride = null) {
  const { email, password, expectedRole } = req.body || {};
  const desiredRole = expectedRoleOverride || expectedRole;
  const clientIp = getRequestIp(req);

  if (!email || !password) {
    console.error('/api/login missing credentials', { body: req.body });
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    console.log('/api/login attempt', { email, ip: req.ip, desiredRole });
    const pool = await getPool();
    const result = await pool.request()
      .input("Email", sql.NVarChar, email)
      .query(`SELECT TOP 1 * FROM User_tbl WHERE Email = @Email`);

    const rows = normalizeResult(result);
    if (rows.length === 0) {
      console.error('/api/login no user found', { email });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
        console.error('/api/login bad password', { email });
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const role = user.Role || "user";
    if (desiredRole && role.toLowerCase() !== String(desiredRole).toLowerCase()) {
      console.error('/api/login role mismatch', { email, role, desiredRole });
      return res.status(403).json({ error: "Role not permitted for this login" });
    }

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
        console.error('/api/login error: JWT_SECRET is not set', { envJWT: process.env.JWT_SECRET });
      return res.status(500).json({ error: 'Server misconfiguration: auth secret not configured' })
    }

    // Sign JWT (use the actual PK column name)
    const token = jwt.sign(
      { sub: user.UserID, email: user.Email, role: role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  // For SPA clients, return JSON rather than performing a server-side redirect.
  res.status(200).json({ message: 'Logged in', role });
} catch (err) {
      console.error("/api/login error:", err && err.stack ? err.stack : err);
      res.status(500).json({ error: "Login failed", detail: err && err.message ? err.message : 'unknown error' });
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
router.post("/api/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, clearCookieOptions());
  return res.json({ ok: true });
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
      username: req.user.email?.split("@")?.[0] || "member",
      role: req.user.role,
      createdAt: null,
      lastLogin: null,
    };
    res.json(profile || fallback);
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
    const tracking = await loadOrderTracking(pool, req.checkoutUserId, order);
    res.json({ order: { ...order, tracking } });
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

  const cart = getCartForUser(userId);
  if (!cart.length) return res.status(400).json({ error: "Cart is empty" });

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  const shippingMethod = req.body?.shippingMethod === "express" ? "express" : "standard";
  const shippingAmount = shippingMethod === "express" ? 19.99 : 0;
  const amount = subtotal + shippingAmount;
  const currency = String(req.body?.currency || "USD").trim().toUpperCase();
  const customerEmail = String(req.body?.customerEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({ error: "A valid checkout email is required" });
  }

  try {
    const session = await stripeRequest("/checkout/sessions", buildStripeCheckoutBody({
      userId,
      cart,
      amount,
      currency,
      customerEmail,
      shippingMethod,
    }));
    if (!session.id || !session.url) {
      throw new Error("Stripe did not return a hosted checkout URL");
    }

    const payment = {
      id: session.id,
      provider: "stripe",
      providerSessionId: session.id,
      userId,
      amount,
      currency,
      method,
      shippingMethod,
      customerEmail,
      checkoutUrl: session.url,
      status: "requires_payment",
      createdAt: new Date().toISOString(),
    };
    getPaymentsForUser(userId).set(payment.id, payment);
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

    let payment = getPaymentsForUser(userId).get(paymentId);
    if (!payment) {
      payment = {
        id: paymentId,
        provider: "stripe",
        providerSessionId: paymentId,
        userId,
        amount: Number(session.amount_total || 0) / 100,
        currency: String(session.currency || "usd").toUpperCase(),
        method: "card",
        shippingMethod: session.metadata?.shipping_method === "express" ? "express" : "standard",
        customerEmail: session.customer_details?.email || session.customer_email || null,
        status: "requires_payment",
        createdAt: new Date().toISOString(),
      };
      getPaymentsForUser(userId).set(payment.id, payment);
    }

    if (Number(session.amount_total || 0) !== Math.round(Number(payment.amount || 0) * 100)) {
      return res.status(409).json({ error: "Payment amount does not match the current checkout" });
    }
    if (session.payment_status !== "paid") {
      await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: payment.customerEmail, status: "payment_pending", paymentError: "Stripe payment has not been completed" });
      return res.status(402).json({ error: "Payment has not been completed" });
    }

    payment.status = "succeeded";
    payment.confirmedAt = new Date().toISOString();
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
  const payment = getPaymentsForUser(userId).get(paymentId);
  if (!payment || payment.provider !== "stripe" || payment.status !== "succeeded") {
    return res.status(402).json({ error: "Payment must be confirmed before creating the order" });
  }

  const cart = getCartForUser(userId);
  if (!cart.length) {
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: payment.customerEmail, status: "order_failed", paymentError: "Cart is empty" });
    return res.status(400).json({ error: "Cart is empty" });
  }

  const inputShipping = req.body?.shippingAddress && typeof req.body.shippingAddress === "object" ? req.body.shippingAddress : {};
  const shippingAddress = {
    fullName: String(inputShipping.fullName || "").trim(),
    email: String(inputShipping.email || "").trim(),
    phone: String(inputShipping.phone || "").trim(),
    addressLine1: String(inputShipping.addressLine1 || "").trim(),
    addressLine2: String(inputShipping.addressLine2 || "").trim(),
    city: String(inputShipping.city || "").trim(),
    region: String(inputShipping.region || "").trim(),
    postalCode: String(inputShipping.postalCode || "").trim(),
    country: String(inputShipping.country || "").trim(),
    shippingMethod: req.body?.shippingMethod === "express" ? "express" : "standard",
  };
  const missingShipping = ["fullName", "email", "phone", "addressLine1", "city", "region", "postalCode", "country"]
    .some((field) => !shippingAddress[field]);
  if (missingShipping) {
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: "Incomplete shipping and customer information" });
    return res.status(400).json({ error: "Complete shipping and customer information before creating the order" });
  }

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  const shipping = shippingAddress.shippingMethod === "express" ? 19.99 : 0;
  const expectedTotal = subtotal + shipping;
  if (Math.round(Number(payment.amount || 0) * 100) !== Math.round(expectedTotal * 100)) {
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: "Payment amount does not match the current cart" });
    return res.status(409).json({ error: "Payment amount does not match the current cart" });
  }
  const order = {
    id: `WLX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-5)}`,
    status: "Processing",
    total: expectedTotal,
    subtotal,
    shippingAmount: shipping,
    placedAt: new Date().toISOString(),
    estimatedDelivery: addOrderDays(new Date(), shippingAddress.shippingMethod === "express" ? 3 : 8),
    items: cart.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      unitCost: item.buyPrice ?? item.unitCost ?? null,
    })),
    shippingAddress,
    paymentMethod: payment.method,
    paymentStatus: "paid",
  };

  try {
    const pool = await getPool();
    const saved = await saveOrder(pool, userId, order);
    if (!saved) {
      await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: "Unable to save order" });
      return res.status(500).json({ error: "Unable to save order" });
    }
    await saveCanonicalOrderSnapshot(pool, userId, order);
    payment.status = "consumed";
    sessionCarts.set(userId, []);
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "completed" });
    res.json({ ok: true, order });
  } catch (err) {
    console.error("/api/orders/create error", err);
    await recordCheckoutAttempt({ attemptId: payment.id, paymentId: payment.id, userId, cartId: userId, customerEmail: shippingAddress.email || payment.customerEmail, status: "order_failed", paymentError: err.message || "Unable to create order" });
    res.status(500).json({ error: "Unable to create order" });
  }
});

router.post("/api/orders/checkout", requireCheckoutIdentity, async (req, res) => {
  return res.status(410).json({ error: "Legacy checkout is disabled. Use the secure /checkout/payment flow." });
});

router.get("/api/cart", requireCheckoutIdentity, async (req, res) => {
  try {
    const cart = getCartForUser(req.checkoutUserId);
    const pool = await getPool();
    const products = await loadProductsByIds(pool, cart.map((c) => c.productId));

    const items = cart.map((item) => {
      const pid = Number(item.productId);
      const product = Number.isFinite(pid) ? products.get(pid) : null;
      const price = product?.price ?? item.price ?? 0;
      return {
        ...item,
        title: product?.name ?? item.title ?? "Item",
        category: product?.category ?? item.category ?? "Collection",
        brand: product?.brand ?? item.brand ?? "Weluxo",
        sku: product?.sku ?? item.sku ?? product?.id ?? item.productId,
        price,
        salePrice: product?.salePrice ?? price,
        buyPrice: product?.buyPrice ?? item.buyPrice ?? null,
        unitProfit: product?.unitProfit ?? null,
        originalPrice: product?.originalPrice ?? item.originalPrice ?? null,
        image: product?.img ?? item.image ?? "",
        stock: product?.stock ?? null,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
    res.json({ items, subtotal });
  } catch (err) {
    console.error("/api/cart GET error", err);
    res.status(500).json({ error: "Unable to load cart" });
  }
});

router.post(["/api/cart", "/api/cart/items"], requireCheckoutIdentity, async (req, res) => {
  const productId = Number(req.body?.productId);
  const qty = Math.max(1, Number(req.body?.quantity) || 1);

  if (!Number.isFinite(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  try {
    const pool = await getPool();
    const product = await loadProductById(pool, productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const cart = getCartForUser(req.checkoutUserId);
    const id = productId.toString();
    const existing = cart.find((c) => String(c.productId) === id);
    if (existing) {
      existing.quantity += qty;
      existing.price = product.price;
      existing.title = product.name;
      existing.category = product.category;
      existing.brand = product.brand;
      existing.sku = product.sku;
      existing.salePrice = product.salePrice;
      existing.buyPrice = product.buyPrice;
      existing.originalPrice = product.originalPrice;
      existing.image = product.img || existing.image;
    } else {
      cart.push({
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
    }

    const products = await loadProductsByIds(pool, cart.map((c) => c.productId));
    const items = cart.map((item) => {
      const pid = Number(item.productId);
      const prod = Number.isFinite(pid) ? products.get(pid) : null;
      const price = prod?.price ?? item.price ?? 0;
      return {
        ...item,
        title: prod?.name ?? item.title ?? "Item",
        category: prod?.category ?? item.category ?? "Collection",
        brand: prod?.brand ?? item.brand ?? "Weluxo",
        sku: prod?.sku ?? item.sku ?? prod?.id ?? item.productId,
        price,
        salePrice: prod?.salePrice ?? price,
        buyPrice: prod?.buyPrice ?? item.buyPrice ?? null,
        unitProfit: prod?.unitProfit ?? null,
        originalPrice: prod?.originalPrice ?? item.originalPrice ?? null,
        image: prod?.img ?? item.image ?? "",
        stock: prod?.stock ?? null,
      };
    });

    const subtotal = items.reduce((sum, itm) => sum + (Number(itm.price) || 0) * itm.quantity, 0);
    res.json({ ok: true, items, subtotal });
  } catch (err) {
    console.error("/api/cart POST error", err);
    res.status(500).json({ error: "Unable to add to cart" });
  }
});

router.put(["/api/cart/:productId", "/api/cart/items/:productId"], requireCheckoutIdentity, async (req, res) => {
  const id = req.params.productId;
  const qty = Math.max(0, Number(req.body?.quantity) || 0);
  const cart = getCartForUser(req.checkoutUserId);
  const existing = cart.find((c) => String(c.productId) === id);
  if (!existing) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (qty === 0) {
    const filtered = cart.filter((c) => String(c.productId) !== id);
    sessionCarts.set(req.checkoutUserId, filtered);
    const subtotal = filtered.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    return res.json({ ok: true, items: filtered, subtotal });
  }

  existing.quantity = qty;
  try {
    const pool = await getPool();
    const products = await loadProductsByIds(pool, cart.map((c) => c.productId));
    const items = cart.map((item) => {
      const pid = Number(item.productId);
      const prod = Number.isFinite(pid) ? products.get(pid) : null;
      const price = prod?.price ?? item.price ?? 0;
      return {
        ...item,
        title: prod?.name ?? item.title ?? "Item",
        category: prod?.category ?? item.category ?? "Collection",
        brand: prod?.brand ?? item.brand ?? "Weluxo",
        sku: prod?.sku ?? item.sku ?? prod?.id ?? item.productId,
        price,
        salePrice: prod?.salePrice ?? price,
        buyPrice: prod?.buyPrice ?? item.buyPrice ?? null,
        unitProfit: prod?.unitProfit ?? null,
        originalPrice: prod?.originalPrice ?? item.originalPrice ?? null,
        image: prod?.img ?? item.image ?? "",
        stock: prod?.stock ?? null,
      };
    });
    const subtotal = items.reduce((sum, itm) => sum + (Number(itm.price) || 0) * itm.quantity, 0);
    res.json({ ok: true, items, subtotal });
  } catch (err) {
    console.error("/api/cart PUT error", err);
    res.status(500).json({ error: "Unable to update cart" });
  }
});

router.delete(["/api/cart/:productId", "/api/cart/items/:productId"], requireCheckoutIdentity, async (req, res) => {
  const id = req.params.productId;
  const cart = getCartForUser(req.checkoutUserId);
  const filtered = cart.filter((c) => String(c.productId) !== id);
  sessionCarts.set(req.checkoutUserId, filtered);

  try {
    const pool = await getPool();
    const products = await loadProductsByIds(pool, filtered.map((c) => c.productId));
    const items = filtered.map((item) => {
      const pid = Number(item.productId);
      const prod = Number.isFinite(pid) ? products.get(pid) : null;
      const price = prod?.price ?? item.price ?? 0;
      return {
        ...item,
        title: prod?.name ?? item.title ?? "Item",
        category: prod?.category ?? item.category ?? "Collection",
        brand: prod?.brand ?? item.brand ?? "Weluxo",
        sku: prod?.sku ?? item.sku ?? prod?.id ?? item.productId,
        price,
        salePrice: prod?.salePrice ?? price,
        buyPrice: prod?.buyPrice ?? item.buyPrice ?? null,
        unitProfit: prod?.unitProfit ?? null,
        originalPrice: prod?.originalPrice ?? item.originalPrice ?? null,
        image: prod?.img ?? item.image ?? "",
        stock: prod?.stock ?? null,
      };
    });
    const subtotal = items.reduce((sum, itm) => sum + (Number(itm.price) || 0) * itm.quantity, 0);
    res.json({ ok: true, items, subtotal });
  } catch (err) {
    console.error("/api/cart DELETE error", err);
    res.status(500).json({ error: "Unable to remove item" });
  }
});

router.post("/api/cart/clear", requireCheckoutIdentity, (req, res) => {
  sessionCarts.set(req.checkoutUserId, []);
  res.json({ ok: true, items: [], subtotal: 0 });
});

router.patch(["/api/cart/:productId", "/api/cart/items/:productId"], requireCheckoutIdentity, async (req, res) => {
  const id = req.params.productId;
  const quantity = Math.max(0, Number(req.body?.quantity) || 0);
  const cart = getCartForUser(req.checkoutUserId);
  const existing = cart.find((item) => String(item.productId) === String(id));
  if (!existing) return res.status(404).json({ error: "Item not found" });

  if (quantity === 0) {
    sessionCarts.set(req.checkoutUserId, cart.filter((item) => String(item.productId) !== String(id)));
  } else {
    existing.quantity = quantity;
  }
  const items = getCartForUser(req.checkoutUserId);
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  res.json({ ok: true, items, subtotal });
});

function cartSubtotal(userId) {
  return getCartForUser(userId).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
}

function cartDiscount(userId, subtotal = cartSubtotal(userId)) {
  const coupon = sessionCartCoupons.get(userId);
  if (!coupon) return 0;
  return coupon.code === "WELCOME10" ? Number((subtotal * 0.1).toFixed(2)) : 0;
}

router.post(["/api/cart/apply-coupon", "/api/cart/coupon"], requireCheckoutIdentity, (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const subtotal = cartSubtotal(req.checkoutUserId);
  if (!code) return res.status(400).json({ error: "Enter a promo code" });
  if (code !== "WELCOME10") return res.status(400).json({ error: "That promo code is not valid" });
  sessionCartCoupons.set(req.checkoutUserId, { code });
  const discount = cartDiscount(req.checkoutUserId, subtotal);
  res.json({ ok: true, code, discount, subtotal, total: subtotal - discount });
});

router.post("/api/cart/shipping-estimate", requireCheckoutIdentity, (req, res) => {
  const method = req.body?.method === "express" ? "express" : "standard";
  const subtotal = cartSubtotal(req.checkoutUserId);
  const freeShipping = method === "standard" || subtotal >= 100;
  res.json({
    ok: true,
    country: String(req.body?.country || "").trim().toUpperCase(),
    postalCode: String(req.body?.postalCode || "").trim(),
    estimates: [
      { method: "standard", label: "Standard Shipping", window: "7-15 business days", cost: 0, free: true },
      { method: "express", label: "Express Shipping", window: "3-7 business days", cost: freeShipping ? 0 : 19.99, free: freeShipping },
    ],
    selected: { method, cost: method === "express" && !freeShipping ? 19.99 : 0 },
  });
});

router.post("/api/cart/save-item", requireCheckoutIdentity, (req, res) => {
  const productId = String(req.body?.productId || "");
  const cart = getCartForUser(req.checkoutUserId);
  const item = cart.find((entry) => String(entry.productId) === productId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const saved = sessionSavedCartItems.get(req.checkoutUserId) || [];
  sessionSavedCartItems.set(req.checkoutUserId, [...saved.filter((entry) => String(entry.productId) !== productId), { ...item, savedAt: new Date().toISOString() }]);
  sessionCarts.set(req.checkoutUserId, cart.filter((entry) => String(entry.productId) !== productId));
  const items = getCartForUser(req.checkoutUserId);
  const subtotal = items.reduce((sum, entry) => sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0), 0);
  res.json({ ok: true, items, subtotal, savedItems: sessionSavedCartItems.get(req.checkoutUserId) });
});



// Header route
router.get("/api/header", async (req, res) => {
  try {
    const pool = await getPool();
    console.log('Connected to DB:', pool.config.database);

    const result = await pool.request().query("SELECT * FROM [dbo].[header_tbl]");
    const rows = normalizeResult(result);
    
    console.log('Header rows:', rows);

    res.json(rows);
  } catch (err) {
    console.error("/api/header error:", err);
    res.status(500).json([]);
  }
});

router.get("/api/head", async (req, res) => {
  try{
    const pool  = await getPool();
    console.log('connect to db :', pool.config.database);
    
    const result = await pool.request().query('SELECT * FROM [dbo].[head_tbl]');
    const rows  = normalizeResult(result);
    console.log('head rows:' , rows);
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
    res.status(500).json({ ok: false, error: err && err.message ? err.message : 'db error' });
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
    res.status(500).json({ error: err.message });
  }
});


router.post("/api/comment", upload.single('image'), async (req, res) => {
  try {
    const { name, text, email } = req.body;
    const file = req.file;

    if (!name || !text || !email) {
      return res.status(400).json({ error: "Name, email and text are required" });
    }

    const imgPath = file ? `public/uploads/${file.filename}` : null;

    const pool = await getPool();
    let request = pool.request().input("Name", name).input("Text", text);
    if (email) request = request.input("Email", email);
    if (imgPath) request = request.input("Img", imgPath);

    const insertColumns = ['Name', 'Text', 'ShowComment'];
    const insertValues = ['@Name', '@Text', '1'];
    if (email) {
      insertColumns.push('Email');
      insertValues.push('@Email');
    }
    if (imgPath) {
      insertColumns.push('Img');
      insertValues.push('@Img');
    }

    const query = `INSERT INTO Comments (${insertColumns.join(', ')}) OUTPUT INSERTED.CommentId, INSERTED.Name, INSERTED.Text, INSERTED.CreatedAt, ${email ? 'INSERTED.Email,' : ''} ${imgPath ? 'INSERTED.Img,' : ''} INSERTED.CommentId INTO #tmp SELECT 1;`;

    let result = await pool
      .request()
      .input("Name", name)
      .input("Text", text)
      .query(`
        INSERT INTO Comments (Name, Text, ShowComment)
        OUTPUT INSERTED.CommentId, INSERTED.Name, INSERTED.Text, INSERTED.CreatedAt
        VALUES (@Name, @Text, 1)
      `);

    const rows = normalizeResult(result);
    const inserted = rows[0];

    const mapped = {
      id: inserted.CommentId ?? inserted.commentId ?? inserted.id,
      name: inserted.Name ?? inserted.name ?? '',
      text: inserted.Text ?? inserted.text ?? '',
      createdAt: inserted.CreatedAt ?? inserted.createdAt ?? null,
      img: imgPath ? imgPath : null,
      email: email ?? null,
    };

    res.json(mapped);
  } catch (err) {
    console.error("/api/comment POST error:", err);
    res.status(500).json({ error: err.message });
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

// CJ Dropshipping import helpers
router.get("/api/cj/products", async (_req, res) => {
  try {
    const pool = await getPool();
    const mapped = await loadCjImports(pool);
    res.json(mapped);
  } catch (err) {
    console.error("/api/cj/products GET error:", err);
    res.status(500).json({ error: err.message || "Unable to load CJ imports" });
  }
});

router.get("/api/cj/ping", async (_req, res) => {
  const basePresent = !!(process.env.CJ_API_BASE_URL || process.env.CJ_API_BASE);
  const tokenPresent = !!(process.env.CJ_API_TOKEN || process.env.CJ_API_KEY || process.env.CJ_TOKEN);
  const tokenCached = !!(cachedCjToken && cachedCjToken.token && Date.now() < cachedCjToken.expiresAt);
  const tokenExpiresInSeconds = tokenCached
    ? Math.max(0, Math.floor((cachedCjToken.expiresAt - Date.now()) / 1000))
    : 0;
  const tokenCooldownSeconds = Math.max(0, Math.ceil((cjTokenCooldownUntil - Date.now()) / 1000));

  res.json({
    ok: basePresent && tokenPresent,
    basePresent,
    tokenPresent,
    tokenCached,
    tokenExpiresInSeconds,
    tokenCooldownSeconds,
  });
});

router.post("/api/cj/lookup", async (req, res) => {
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
    res.status(500).json({ error: err.message || "Unable to lookup CJ product" });
  }
});

router.post("/api/cj/import", async (req, res) => {
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
    const cjData = await fetchCjProduct(pid);
    if (!cjData || !normalizeCjProductData(cjData, pid)) {
      return res.status(404).json({ error: "Unable to find CJ product" });
    }
    const product = await insertOrUpdateCjProduct(pool, pid, salePrice, cjData, buyPrice);

    if (!product) {
      return res.status(500).json({ error: "Unable to import CJ product" });
    }

    res.status(201).json({
      ok: true,
      product,
      fetched: !!cjData,
      pid,
    });
  } catch (err) {
    if (err && err.name === "CjRateLimitError") {
      return res.status(429).json({
        error: err.message || "CJ rate limited",
        retryAfterSeconds: err.retryAfterSeconds ?? null,
      });
    }
    console.error("/api/cj/import POST error:", err);
    res.status(500).json({ error: err.message || "Unable to import CJ product" });
  }
});

router.delete("/api/cj/import/:pid", async (req, res) => {
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
      .query("SELECT TOP 1 ProductId FROM [dbo].[CjImportedProducts_tbl] WHERE Pid = @Pid");

    const lookupRows = normalizeResult(lookup);
    if (!lookupRows.length) {
      return res.status(404).json({ error: "Imported product not found" });
    }

    const productId = Number(lookupRows[0].ProductId);

    await pool
      .request()
      .input("Pid", sql.NVarChar, pid)
      .query("DELETE FROM [dbo].[CjImportedProducts_tbl] WHERE Pid = @Pid");

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
    res.status(500).json({ error: err.message || "Unable to delete CJ import" });
  }
});

// Products route
router.get("/api/products", async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/products", productUpload, async (req, res) => {
  try {
    const payload = normalizeProductInput(req.body);

    if (!payload.name) {
      return res.status(400).json({ error: "Product name is required" });
    }
    if (payload.salePrice < 0 || payload.buyPrice < 0 || payload.stock < 0) {
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
    console.error("/api/products POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/products/:productId", productUpload, async (req, res) => {
  const productId = Number(req.params.productId);

  if (!Number.isFinite(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  try {
    const payload = normalizeProductInput(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "Product name is required" });
    }
    if (payload.salePrice < 0 || payload.buyPrice < 0 || payload.stock < 0) {
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
    console.error("/api/products PUT error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/products/:productId", async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// Home route
router.get("/api/home", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.HomeContent_tbl");
    res.json(normalizeResult(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shop route
router.get("/api/shop", async (req, res) => {
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
      const numericRowId = Number(row.PID ?? row.id);
      const product = mapProductRow(row, pricingMap.get(numericRowId));
      const numericId = Number(row.PID ?? row.id ?? product.id);
      if (Number.isFinite(numericId)) {
        product.images = imagesMap.get(numericId) || [];
        product.address = addressMap.get(numericId) || "";
      } else {
        product.images = [];
        product.address = "";
      }
      return product;
    });

    res.json(products);
  } catch (err) {
    console.error("/api/shop error:", err);
    res.status(500).json({ error: err.message, details: err });
  }
});

// Category route
router.get("/api/category/:categoryId", async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT * FROM Product_tbl WHERE Category = ${categoryId}`);
    const rows = normalizeResult(result);

    if (rows.length > 0) {
      res.json({ category: rows[0] });
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product page route
router.get("/api/product/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT * FROM Products WHERE ProductId = ${productId}`);
    const rows = normalizeResult(result);

    if (rows.length > 0) {
      res.json({ product: rows[0] });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
