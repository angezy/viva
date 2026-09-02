const sql = require("mssql");

let couponsTableEnsured = false;
let couponRedemptionsTableEnsured = false;

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
    const result = await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready");
    if (result.recordset?.[0]?.ready !== 1) throw new Error("Coupon schema is missing; apply migration 005");
    couponsTableEnsured = true;
    return true;
  } catch (error) {
    console.error("Unable to ensure Coupons table:", error);
    return false;
  }
}

async function ensureCouponRedemptionsTable(pool) {
  if (couponRedemptionsTableEnsured) return true;

  try {
    if (!(await ensureCouponsTable(pool))) return false;

    const result = await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.CouponRedemptions', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready");
    if (result.recordset?.[0]?.ready !== 1) throw new Error("Coupon redemption schema is missing; apply migration 007");
    couponRedemptionsTableEnsured = true;
    return true;
  } catch (error) {
    console.error("Unable to ensure CouponRedemptions table:", error);
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

function normalizeCouponCustomerEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email ? email.slice(0, 255) : null;
}

function getCouponCustomerIdentity(userId, customerEmail) {
  const normalizedUserId = userId === null || userId === undefined ? "" : String(userId).trim();
  const normalizedEmail = normalizeCouponCustomerEmail(customerEmail);
  const isGuest = !normalizedUserId || normalizedUserId.toLowerCase().startsWith("guest-");

  if (!isGuest) {
    return {
      customerKey: `user:${normalizedUserId}`.slice(0, 255),
      customerEmail: normalizedEmail,
    };
  }
  if (normalizedUserId) {
    return {
      customerKey: `guest:${normalizedUserId}`.slice(0, 255),
      customerEmail: normalizedEmail,
    };
  }
  if (!normalizedEmail) return null;
  return {
    customerKey: `email:${normalizedEmail}`.slice(0, 255),
    customerEmail: normalizedEmail,
  };
}

async function hasCouponBeenRedeemed(pool, coupon, { userId, customerEmail } = {}) {
  if (!coupon?.id) return false;
  const identity = getCouponCustomerIdentity(userId, customerEmail);
  if (!identity) return false;
  if (!(await ensureCouponRedemptionsTable(pool))) {
    throw new Error("Coupon redemption storage is unavailable");
  }

  const result = await pool
    .request()
    .input("CouponId", sql.Int, Number(coupon.id))
    .input("CustomerKey", sql.NVarChar(255), identity.customerKey)
    .input("CustomerEmail", sql.NVarChar(255), identity.customerEmail)
    .query(`
      SELECT TOP 1 RedemptionId
      FROM dbo.CouponRedemptions
      WHERE CouponId = @CouponId
        AND (CustomerKey = @CustomerKey OR (CustomerEmail IS NOT NULL AND CustomerEmail = @CustomerEmail));
    `);

  return Boolean(result?.recordset?.length || result?.recordsets?.[0]?.length);
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
  ensureCouponRedemptionsTable,
  findCouponByCode,
  getCouponCustomerIdentity,
  hasCouponBeenRedeemed,
  isValidCouponCode,
  mapCouponRow,
  normalizeCouponCustomerEmail,
  normalizeCouponCode,
};
