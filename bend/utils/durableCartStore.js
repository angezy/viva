const sql = require("mssql");
const { requireSchemaObjects } = require("./schemaSecurity");

const CART_TTL_DAYS = Math.min(90, Math.max(1, Number(process.env.CART_TTL_DAYS) || 30));
const developmentStates = new Map();
const developmentLocks = new Map();
let developmentFallbackWarned = false;

function ownerKey(value) {
  return String(value || "").slice(0, 128);
}

function isGuestCartOwnerKey(value) {
  return /^guest-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function missingSchemaInDevelopment(error) {
  const number = Number(error?.number ?? error?.originalError?.info?.number);
  return process.env.NODE_ENV !== "production" && (
    error?.code === "SCHEMA_MIGRATION_REQUIRED" ||
    number === 208 ||
    /Invalid object name|apply migrations through 011/i.test(String(error?.message || ""))
  );
}

function warnDevelopmentFallback() {
  if (developmentFallbackWarned) return;
  developmentFallbackWarned = true;
  console.warn("Security migration 011 is not applied; using development-only in-process cart compatibility until the local database is migrated");
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state || normalizeState()));
}

function loadDevelopmentState(ownerKey) {
  warnDevelopmentFallback();
  const key = String(ownerKey).slice(0, 128);
  const stored = developmentStates.get(key);
  if (!stored || stored.expiresAt <= Date.now()) return normalizeState();
  return cloneState(stored.state);
}

async function mutateDevelopmentState(owner, mutator) {
  const key = ownerKey(owner);
  const previous = developmentLocks.get(key) || Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    const state = loadDevelopmentState(key);
    const updated = await mutator(state) || state;
    if (!Array.isArray(updated.cart) || !Array.isArray(updated.savedGuest)) throw new Error("Invalid cart state");
    const next = { ...updated, version: Number(state.version || 0) + 1 };
    developmentStates.set(key, { state: cloneState(next), expiresAt: Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000 });
    return cloneState(next);
  });
  developmentLocks.set(key, operation);
  try { return await operation; } finally { if (developmentLocks.get(key) === operation) developmentLocks.delete(key); }
}

async function withDevelopmentStateLocks(ownerKeys, operation) {
  const keys = [...new Set(ownerKeys.map(ownerKey).filter(Boolean))].sort();
  const pending = keys.map((key) => developmentLocks.get(key) || Promise.resolve());
  const task = Promise.all(pending.map((value) => value.catch(() => {}))).then(operation);
  keys.forEach((key) => developmentLocks.set(key, task));
  try {
    return await task;
  } finally {
    keys.forEach((key) => {
      if (developmentLocks.get(key) === task) developmentLocks.delete(key);
    });
  }
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch (_error) { return fallback; }
}

function normalizeState(row = null) {
  const has = (field) => Object.prototype.hasOwnProperty.call(row || {}, field);
  const state = {
    cart: has("cart") ? row.cart : parseJson(row?.cart_json, []),
    coupon: has("coupon") ? row.coupon : parseJson(row?.coupon_json, null),
    savedGuest: has("savedGuest") ? row.savedGuest : parseJson(row?.saved_guest_json, []),
    version: Number(row?.version || 0),
  };
  if (!Array.isArray(state.cart)) state.cart = [];
  if (!Array.isArray(state.savedGuest)) state.savedGuest = [];
  if (!state.coupon || typeof state.coupon !== "object" || Array.isArray(state.coupon)) state.coupon = null;
  return state;
}

function activeStateFromRow(row) {
  if (row && new Date(row.expires_at).getTime() <= Date.now()) return normalizeState();
  return normalizeState(row);
}

function boundedQuantity(value, maximum) {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 ? Math.min(quantity, maximum) : null;
}

function mergeCartItems(customerCart = [], guestCart = [], maxQuantity = 99) {
  const maximum = Math.min(999, Math.max(1, Math.trunc(Number(maxQuantity) || 99)));
  const merged = [];
  const positions = new Map();

  for (const item of [...customerCart, ...guestCart]) {
    const productId = String(item?.productId ?? "").trim();
    const quantity = boundedQuantity(item?.quantity, maximum);
    if (!productId || quantity == null) continue;

    const position = positions.get(productId);
    if (position == null) {
      positions.set(productId, merged.length);
      merged.push({ ...item, productId, quantity });
      continue;
    }

    merged[position] = {
      ...merged[position],
      quantity: Math.min(maximum, merged[position].quantity + quantity),
    };
  }

  return merged;
}

function mergeGuestCartState(customerState, guestState, maxQuantity = 99) {
  const customer = normalizeState(customerState);
  const guest = normalizeState(guestState);
  return {
    ...customer,
    cart: mergeCartItems(customer.cart, guest.cart, maxQuantity),
    // A signed-in customer's existing coupon wins; otherwise keep the coupon
    // the customer selected while shopping as a guest. Cart reads will still
    // validate its expiry before calculating a discount.
    coupon: customer.coupon || guest.coupon || null,
  };
}

function stateExpiresAt() {
  return new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function writeCartState(transaction, key, state, expiresAt = stateExpiresAt()) {
  return new sql.Request(transaction)
    .input("OwnerKey", sql.NVarChar(128), key)
    .input("CartJson", sql.NVarChar(sql.MAX), JSON.stringify(state.cart))
    .input("CouponJson", sql.NVarChar(sql.MAX), state.coupon ? JSON.stringify(state.coupon) : null)
    .input("SavedJson", sql.NVarChar(sql.MAX), JSON.stringify(state.savedGuest))
    .input("ExpiresAt", sql.DateTime2(3), expiresAt)
    .query(`
      UPDATE [Commerce].[DurableCartStates]
      SET [cart_json] = @CartJson, [coupon_json] = @CouponJson, [saved_guest_json] = @SavedJson,
          [version] = [version] + 1, [expires_at] = @ExpiresAt, [updated_at] = SYSUTCDATETIME()
      WHERE [owner_key] = @OwnerKey;
      IF @@ROWCOUNT = 0
        INSERT INTO [Commerce].[DurableCartStates]
          ([owner_key], [cart_json], [coupon_json], [saved_guest_json], [expires_at])
        VALUES (@OwnerKey, @CartJson, @CouponJson, @SavedJson, @ExpiresAt);`);
}

async function loadCartState(pool, owner) {
  try {
    await requireSchemaObjects(pool, ["Commerce.DurableCartStates"]);
    const result = await pool.request().input("OwnerKey", sql.NVarChar(128), ownerKey(owner)).query(`
      SELECT TOP 1 [cart_json], [coupon_json], [saved_guest_json], [version], [expires_at]
      FROM [Commerce].[DurableCartStates]
      WHERE [owner_key] = @OwnerKey AND [expires_at] > SYSUTCDATETIME()`);
    return normalizeState(result.recordset?.[0]);
  } catch (error) {
    if (missingSchemaInDevelopment(error)) return loadDevelopmentState(owner);
    throw error;
  }
}

async function mutateCartState(pool, owner, mutator) {
  try {
    await requireSchemaObjects(pool, ["Commerce.DurableCartStates"]);
  } catch (error) {
    if (missingSchemaInDevelopment(error)) return mutateDevelopmentState(owner, mutator);
    throw error;
  }
  const key = ownerKey(owner);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await new sql.Request(transaction).input("OwnerKey", sql.NVarChar(128), key).query(`
      SELECT TOP 1 [cart_json], [coupon_json], [saved_guest_json], [version], [expires_at]
      FROM [Commerce].[DurableCartStates] WITH (UPDLOCK, HOLDLOCK)
      WHERE [owner_key] = @OwnerKey`);
    const state = activeStateFromRow(result.recordset?.[0]);
    const updated = await mutator(state) || state;
    if (!Array.isArray(updated.cart) || !Array.isArray(updated.savedGuest)) throw new Error("Invalid durable cart state");
    await writeCartState(transaction, key, updated);
    await transaction.commit();
    return { ...updated, version: state.version + 1 };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function mergeGuestCartIntoUserCart(pool, guestOwnerKey, customerOwnerKey, maxQuantity = 99) {
  const guestKey = ownerKey(guestOwnerKey);
  const customerKey = ownerKey(customerOwnerKey);
  if (!isGuestCartOwnerKey(guestKey) || !customerKey || guestKey === customerKey) {
    return loadCartState(pool, customerKey);
  }

  try {
    await requireSchemaObjects(pool, ["Commerce.DurableCartStates"]);
  } catch (error) {
    if (!missingSchemaInDevelopment(error)) throw error;
    return withDevelopmentStateLocks([guestKey, customerKey], async () => {
      const guestState = loadDevelopmentState(guestKey);
      const customerState = loadDevelopmentState(customerKey);
      if (!guestState.cart.length) return customerState;
      const merged = mergeGuestCartState(customerState, guestState, maxQuantity);
      const next = { ...merged, version: Number(customerState.version || 0) + 1 };
      developmentStates.set(customerKey, { state: cloneState(next), expiresAt: Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000 });
      developmentStates.delete(guestKey);
      return cloneState(next);
    });
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const lockedStates = new Map();
    for (const key of [guestKey, customerKey].sort()) {
      const result = await new sql.Request(transaction).input("OwnerKey", sql.NVarChar(128), key).query(`
        SELECT TOP 1 [cart_json], [coupon_json], [saved_guest_json], [version], [expires_at]
        FROM [Commerce].[DurableCartStates] WITH (UPDLOCK, HOLDLOCK)
        WHERE [owner_key] = @OwnerKey`);
      lockedStates.set(key, activeStateFromRow(result.recordset?.[0]));
    }

    const guestState = lockedStates.get(guestKey);
    const customerState = lockedStates.get(customerKey);
    if (!guestState.cart.length) {
      await transaction.commit();
      return customerState;
    }

    const merged = mergeGuestCartState(customerState, guestState, maxQuantity);
    await writeCartState(transaction, customerKey, merged);
    await new sql.Request(transaction)
      .input("OwnerKey", sql.NVarChar(128), guestKey)
      .query("DELETE FROM [Commerce].[DurableCartStates] WHERE [owner_key] = @OwnerKey");
    await transaction.commit();
    return { ...merged, version: customerState.version + 1 };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function purgeExpiredCartStates(pool, batchSize = 500) {
  const size = Math.min(5000, Math.max(1, Number(batchSize) || 500));
  return pool.request().input("BatchSize", sql.Int, size).query(`
    DELETE TOP (@BatchSize) FROM [Commerce].[DurableCartStates] WHERE [expires_at] <= SYSUTCDATETIME();
    SELECT @@ROWCOUNT AS deleted;`);
}

module.exports = {
  isGuestCartOwnerKey,
  loadCartState,
  mergeCartItems,
  mergeGuestCartIntoUserCart,
  mergeGuestCartState,
  missingSchemaInDevelopment,
  mutateCartState,
  normalizeState,
  purgeExpiredCartStates,
};
