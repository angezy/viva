const sql = require("mssql");

let couponsTableEnsured = false;

function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase();
}

function rowValue(row, ...keys) {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    const matchingKey = row && Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (matchingKey) return row[matchingKey];
  }
  return undefined;
}

function isValidCouponCode(value) {
  return /^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(normalizeCouponCode(value));
}

async function ensureCouponsTable(pool) {
  if (couponsTableEnsured) return true;

  try {
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.Coupons', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Coupons (
          CouponId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Coupons PRIMARY KEY,
          Code NVARCHAR(64) NOT NULL,
          DiscountPercent DECIMAL(5,2) NOT NULL,
          ExpiresAt DATETIME2(3) NOT NULL,
          IsActive BIT NOT NULL CONSTRAINT DF_Coupons_IsActive DEFAULT (1),
          CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Coupons_CreatedAt DEFAULT SYSUTCDATETIME(),
          UpdatedAt DATETIME2(3) NULL,
          CONSTRAINT UQ_Coupons_Code UNIQUE (Code),
          CONSTRAINT CK_Coupons_DiscountPercent CHECK (DiscountPercent > 0 AND DiscountPercent <= 100)
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM dbo.Coupons WHERE Code = N'WELCOME10')
      BEGIN
        INSERT INTO dbo.Coupons (Code, DiscountPercent, ExpiresAt, IsActive)
        VALUES (N'WELCOME10', 10, DATEADD(year, 100, SYSUTCDATETIME()), 1);
      END;
    `);
    couponsTableEnsured = true;
    return true;
  } catch (error) {
    console.error("Unable to ensure Coupons table:", error);
    return false;
  }
}

function mapCouponRow(row = {}) {
  const expiresAt = rowValue(row, "ExpiresAt", "expiresAt", "expiresat") ?? null;
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const expired = !expiresAtDate || Number.isNaN(expiresAtDate.getTime()) || expiresAtDate.getTime() <= Date.now();
  const isActive = Boolean(rowValue(row, "IsActive", "isActive", "isactive") ?? true);

  return {
    id: rowValue(row, "CouponId", "couponId", "couponid", "id"),
    code: normalizeCouponCode(rowValue(row, "Code", "code")),
    discountPercent: Number(rowValue(row, "DiscountPercent", "discountPercent", "discountpercent") ?? 0),
    expiresAt: expiresAtDate && !Number.isNaN(expiresAtDate.getTime()) ? expiresAtDate.toISOString() : null,
    isActive,
    status: expired ? "Expired" : isActive ? "Active" : "Inactive",
    createdAt: rowValue(row, "CreatedAt", "createdAt", "createdat") ?? null,
    updatedAt: rowValue(row, "UpdatedAt", "updatedAt", "updatedat") ?? null,
  };
}

function couponIsUsable(coupon) {
  if (!coupon || coupon.isActive === false) return false;
  const expiresAt = new Date(coupon.expiresAt || 0).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function calculateCouponDiscount(subtotal, coupon) {
  if (!couponIsUsable(coupon)) return 0;
  const amount = Math.max(0, Number(subtotal) || 0);
  const percent = Math.min(100, Math.max(0, Number(coupon.discountPercent) || 0));
  return Number(Math.min(amount, amount * percent / 100).toFixed(2));
}

async function findCouponByCode(pool, code) {
  const normalized = normalizeCouponCode(code);
  if (!normalized || !(await ensureCouponsTable(pool))) return null;

  const result = await pool
    .request()
    .input("Code", sql.NVarChar(64), normalized)
    .query("SELECT TOP 1 * FROM dbo.Coupons WHERE Code = @Code");
  const row = result?.recordset?.[0] || result?.recordsets?.[0]?.[0];
  return row ? mapCouponRow(row) : null;
}

module.exports = {
  calculateCouponDiscount,
  couponIsUsable,
  ensureCouponsTable,
  findCouponByCode,
  isValidCouponCode,
  mapCouponRow,
  normalizeCouponCode,
};
