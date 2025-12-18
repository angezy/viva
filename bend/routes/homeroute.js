const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require("fs");
const JWT_SECRET = process.env.JWT_SECRET;
const sql = require('mssql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

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

function getTokenFromRequest(req) {
  const header = req.headers?.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  if (req.cookies && req.cookies.viva_token) {
    return req.cookies.viva_token;
  }
  if (req.body && typeof req.body.token === "string") {
    return req.body.token;
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


// Helper function to normalize result
function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;       
  if (result.recordset) return result.recordset;  
  return [];
}

function mapProductRow(row = {}) {
  return {
    id: row.PID ?? row.id ?? row.productId ?? null,
    category: row.Category ?? row.category ?? null,
    brand: row.Brand ?? row.brand ?? "Generic",
    name: row.Name ?? row.name ?? null,
    description: row.Description ?? row.description ?? "",
    price: row.Price ?? row.price ?? 0,
    alt: row.Alt ?? row.alt ?? "",
    img: row.Img ?? row.IMG ?? row.img ?? row.image ?? null,
    stock: row.Stock ?? row.stock ?? row.Quantity ?? row.quantity ?? 0,
    address: row.Address ?? row.address ?? "",
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
    return mapProductRow(rows[0]);
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
    const map = new Map();
    rows.forEach((row) => {
      const mapped = mapProductRow(row);
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
  const rawPrice = body.price ?? body.Price ?? 0;
  const rawStock = body.stock ?? body.Stock ?? body.quantity ?? body.Quantity ?? 0;

  const price = Number(rawPrice);
  const stock = Number(rawStock);

  return {
    name: typeof titleOrName === "string" ? titleOrName.trim() : "",
    category: typeof category === "string" && category.trim().length > 0 ? category.trim() : "General",
    description,
    brand: typeof brand === "string" && brand.trim().length > 0 ? brand.trim() : "Generic",
    image,
    alt,
    price: Number.isFinite(price) ? price : 0,
    stock: Number.isFinite(stock) ? stock : 0,
  };
}

let cachedProductStockColumn = undefined;
let productImagesTableEnsured = false;
let productAddressesTableEnsured = false;
let ordersTableEnsured = false;

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
          PlacedAt DATETIME NOT NULL DEFAULT GETDATE()
        );
        CREATE INDEX IX_Orders_UserId ON [dbo].[Orders_tbl](UserId);
      END
    `);
    ordersTableEnsured = true;
    return true;
  } catch (err) {
    console.error("Unable to ensure Orders_tbl:", err);
    return false;
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
  return {
    id: row.OrderId ?? row.orderId ?? row.id,
    userId: row.UserId ?? row.userId,
    status: row.Status ?? row.status ?? "Processing",
    total: Number(row.Total ?? row.total ?? 0),
    placedAt: row.PlacedAt ?? row.placedAt ?? new Date().toISOString(),
    items: Array.isArray(items) ? items : [],
  };
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
      .input("PlacedAt", sql.DateTime, order.placedAt ? new Date(order.placedAt) : new Date())
      .query(`
        MERGE [dbo].[Orders_tbl] AS target
        USING (SELECT @OrderId AS OrderId, @UserId AS UserId) AS source
        ON target.OrderId = source.OrderId AND target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET Status = @Status, Total = @Total, Items = @Items, PlacedAt = @PlacedAt
        WHEN NOT MATCHED THEN
          INSERT (OrderId, UserId, Status, Total, Items, PlacedAt)
          VALUES (@OrderId, @UserId, @Status, @Total, @Items, @PlacedAt);
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

async function insertOrUpdateCjProduct(pool, pid, desiredPrice, cjPayload) {
  const normalized = normalizeCjProductData(cjPayload, pid);
  const price = Number.isFinite(Number(desiredPrice))
    ? Number(desiredPrice)
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

    await upsertCjImportMapping(pool, pid, productId, price, normalized.raw);

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

  await upsertCjImportMapping(pool, pid, insertedId, price, normalized.raw);

  const decorated = mapProductRow(inserted);
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
             p.Name, p.Description, p.Price, p.Img
      FROM [dbo].[CjImportedProducts_tbl] map
      LEFT JOIN [dbo].[Products_tbl] p ON p.PID = map.ProductId
      ORDER BY map.UpdatedAt DESC
    `);
    const rows = normalizeResult(result);
    const imagesMap = await loadProductImages(pool);
    return rows.map((row) => ({
      pid: row.Pid,
      productId: row.ProductId,
      price: row.Price ?? row.ImportedPrice ?? 0,
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
router.get("/api/views", async (req, res) => {
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
router.get("/api/table-values", async (req, res) => {
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
router.get("/api/tables", async (req, res) => {
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
  const { username, email, password, country, state, city, zip, address } = req.body;

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

  // Use the same cookie name the frontend expects (viva_token)
  res.cookie("viva_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60, // 1 hour
  });
  // For SPA clients, return JSON rather than performing a server-side redirect.
  res.status(200).json({ message: 'Logged in', token, role });
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
  res.clearCookie("viva_token");
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

router.get("/api/orders/track/:orderId", requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const order = await loadOrderById(pool, String(req.user.id), req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ order });
  } catch (err) {
    console.error("/api/orders/track error", err);
    res.status(500).json({ error: "Unable to track order" });
  }
});

router.post("/api/orders/checkout", requireAuth, async (req, res) => {
  const userId = String(req.user.id);
  const cart = getCartForUser(userId);
  if (!cart.length) {
    return res.status(400).json({ error: "Cart is empty" });
  }
  const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  const order = {
    id: `ord-${Date.now()}`,
    status: "Processing",
    total,
    placedAt: new Date().toISOString(),
    items: cart.map((item) => ({ title: item.title, quantity: item.quantity, price: item.price })),
  };

  try {
    const pool = await getPool();
    await saveOrder(pool, userId, order);
    sessionCarts.set(userId, []);
    res.json({ ok: true, order });
  } catch (err) {
    console.error("/api/orders/checkout error", err);
    res.status(500).json({ error: "Unable to place order" });
  }
});

router.get("/api/cart", requireAuth, async (req, res) => {
  try {
    const cart = getCartForUser(String(req.user.id));
    const pool = await getPool();
    const products = await loadProductsByIds(pool, cart.map((c) => c.productId));

    const items = cart.map((item) => {
      const pid = Number(item.productId);
      const product = Number.isFinite(pid) ? products.get(pid) : null;
      const price = product?.price ?? item.price ?? 0;
      return {
        ...item,
        title: product?.name ?? item.title ?? "Item",
        price,
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

router.post("/api/cart", requireAuth, async (req, res) => {
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

    const cart = getCartForUser(String(req.user.id));
    const id = productId.toString();
    const existing = cart.find((c) => String(c.productId) === id);
    if (existing) {
      existing.quantity += qty;
      existing.price = product.price;
      existing.title = product.name;
      existing.image = product.img || existing.image;
    } else {
      cart.push({
        productId: id,
        title: product.name,
        price: product.price,
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
        price,
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

router.put("/api/cart/:productId", requireAuth, async (req, res) => {
  const id = req.params.productId;
  const qty = Math.max(0, Number(req.body?.quantity) || 0);
  const cart = getCartForUser(String(req.user.id));
  const existing = cart.find((c) => String(c.productId) === id);
  if (!existing) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (qty === 0) {
    const filtered = cart.filter((c) => String(c.productId) !== id);
    sessionCarts.set(String(req.user.id), filtered);
    return res.json({ ok: true, items: filtered });
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
        price,
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

router.delete("/api/cart/:productId", requireAuth, async (req, res) => {
  const id = req.params.productId;
  const cart = getCartForUser(String(req.user.id));
  const filtered = cart.filter((c) => String(c.productId) !== id);
  sessionCarts.set(String(req.user.id), filtered);

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
        price,
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

router.post("/api/cart/clear", requireAuth, (req, res) => {
  sessionCarts.set(String(req.user.id), []);
  res.json({ ok: true, items: [], subtotal: 0 });
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
    const priceInput = req.body?.price ?? req.body?.Price;

    if (!pid) {
      return res.status(400).json({ error: "pid is required" });
    }

    if (priceInput === undefined || priceInput === null || String(priceInput).trim() === "") {
      return res.status(400).json({ error: "price is required" });
    }

    const price = Number(priceInput);
    if (!Number.isFinite(price)) {
      return res.status(400).json({ error: "price must be a number" });
    }

    const pool = await getPool();
    const cjData = await fetchCjProduct(pid);
    if (!cjData || !normalizeCjProductData(cjData, pid)) {
      return res.status(404).json({ error: "Unable to find CJ product" });
    }
    const product = await insertOrUpdateCjProduct(pool, pid, price, cjData);

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

      await saveProductImages(pool, productId, []);
      await saveProductAddress(pool, productId, "");
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

    const [imagesMap, addressMap] = await Promise.all([loadProductImages(pool), loadProductAddresses(pool)]);

    const products = rows.map((row) => {
      const product = mapProductRow(row);
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
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/products", productUpload, async (req, res) => {
  try {
    const payload = normalizeProductInput(req.body);

    if (!payload.name) {
      return res.status(400).json({ error: "Product name is required" });
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

    await Promise.all([saveProductImages(pool, insertedId, additionalImages), saveProductAddress(pool, insertedId, address)]);

    const decorated = mapProductRow(inserted);
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
    await Promise.all([saveProductImages(pool, productId, additionalImages), saveProductAddress(pool, productId, address)]);

    const decorated = mapProductRow(updated);
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

    await saveProductImages(pool, productId, []);
    await saveProductAddress(pool, productId, "");

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

    const [imagesMap, addressMap] = await Promise.all([loadProductImages(pool), loadProductAddresses(pool)]);

    const products = rows.map((row) => {
      const product = mapProductRow(row);
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
