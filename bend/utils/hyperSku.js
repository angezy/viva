const HYPERSKU_API_BASE_URL = "https://api.hypersku.com";

const HYPERSKU_PATHS = Object.freeze({
  token: "/api/auth/admin/token",
  countryCodes: "/api/customer/admin/logistics/getCountryCode",
  logisticsBySku: "/api/customer/admin/logistics/getLogisticsInfo-Sku",
  createOrder: "/api/customer/admin/orders/create",
  ordersByExternalId: "/api/customer/admin/orders/getOrdersByExternalOrderId",
  orderStatus: "/api/customer/admin/orders/status",
  orderByStoreId: "/api/customer/admin/orders/list",
  internationalLogistics: "/api/customer/admin/logistics/internationalLogisticsInfo",
});

let accessTokenCache = null;
let accessTokenPromise = null;
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

class HyperSkuError extends Error {
  constructor(message, { retryable = false, statusCode = null, providerMessage = "", path = "" } = {}) {
    super(message);
    this.name = "HyperSkuError";
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.providerMessage = providerMessage;
    this.path = path;
  }
}

function configured(env = process.env) {
  return Boolean(
    String(env.HYPERSKU_ACCESS_TOKEN || "").trim()
    || String(env.HYPERSKU_API_KEY || "").trim()
    || (
      String(env.HYPERSKU_USERNAME || "").trim()
      && String(env.HYPERSKU_PASSWORD || "").trim()
      && String(env.HYPERSKU_API_KEY || "").trim()
    )
  );
}

function requestTimeout(env = process.env) {
  const configuredTimeout = Number(env.HYPERSKU_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) ? Math.min(60_000, Math.max(5_000, configuredTimeout)) : 20_000;
}

function requestInterval(env = process.env) {
  const configuredInterval = Number(env.HYPERSKU_REQUEST_MIN_INTERVAL_MS);
  return Number.isFinite(configuredInterval) ? Math.min(5_000, Math.max(0, configuredInterval)) : 250;
}

function apiBaseUrl(env = process.env) {
  const value = String(env.HYPERSKU_API_BASE_URL || HYPERSKU_API_BASE_URL).trim();
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new Error("HyperSKU API base URL must use http or https");
    return url.toString().replace(/\/$/, "");
  } catch (_error) {
    throw new HyperSkuError("HyperSKU API base URL is invalid");
  }
}

function tokenUrl(env = process.env) {
  return String(env.HYPERSKU_TOKEN_URL || `${apiBaseUrl(env)}${HYPERSKU_PATHS.token}`).trim();
}

function authorizationValue(token, env = process.env) {
  const prefix = String(env.HYPERSKU_AUTH_HEADER_PREFIX || "").trim();
  return prefix ? `${prefix} ${token}` : token;
}

function expiryFromSeconds(value, fallbackMs = 55 * 60 * 1000) {
  const seconds = Number(value);
  return Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.max(30_000, (seconds - 30) * 1000) : fallbackMs);
}

function cacheAccessToken(token, expiresIn) {
  const normalized = String(token || "").trim();
  if (!normalized) throw new HyperSkuError("HyperSKU did not return an access token");
  accessTokenCache = { token: normalized, expiresAt: expiryFromSeconds(expiresIn) };
  return normalized;
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch (_error) { return { raw: text.slice(0, 500) }; }
}

function providerFailure(payload) {
  if (payload?.rel === false) return true;
  if (payload?.success === false || payload?.result === false) return true;
  if (payload?.status !== undefined && payload?.status !== null && String(payload.status) !== "0") return true;
  return false;
}

function scheduleRequest(task, env) {
  const scheduled = requestQueue.then(async () => {
    const waitMs = Math.max(0, requestInterval(env) - (Date.now() - lastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt = Date.now();
    return task();
  });
  requestQueue = scheduled.catch(() => {});
  return scheduled;
}

async function requestToken(fetchImpl, env) {
  const apiKey = String(env.HYPERSKU_API_KEY || "").trim();
  const username = String(env.HYPERSKU_USERNAME || "").trim();
  const password = String(env.HYPERSKU_PASSWORD || "").trim();
  if (!apiKey || !username || !password) throw new HyperSkuError("HyperSKU username/password authentication is incomplete");

  const response = await scheduleRequest(() => fetchImpl(tokenUrl(env), {
    method: "POST",
    headers: { Authorization: authorizationValue(apiKey, env), Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(requestTimeout(env)),
  }), env);
  const payload = await responseJson(response);
  const token = payload?.token || payload?.accessToken || payload?.data?.token || payload?.data?.accessToken;
  if (!response.ok || providerFailure(payload) || !token) {
    throw new HyperSkuError("HyperSKU authentication failed", {
      retryable: response.status >= 500 || response.status === 429,
      statusCode: response.status,
      providerMessage: String(payload?.message || payload?.msg || "").slice(0, 500),
      path: HYPERSKU_PATHS.token,
    });
  }
  return cacheAccessToken(token, payload?.expiresIn || payload?.data?.expiresIn);
}

async function getAccessToken({ fetchImpl = global.fetch, env = process.env } = {}) {
  const suppliedToken = String(env.HYPERSKU_ACCESS_TOKEN || "").trim();
  if (suppliedToken) return suppliedToken;
  if (String(env.HYPERSKU_USERNAME || "").trim() && String(env.HYPERSKU_PASSWORD || "").trim()) {
    if (accessTokenCache?.expiresAt > Date.now()) return accessTokenCache.token;
    if (typeof fetchImpl !== "function") throw new HyperSkuError("Fetch is unavailable for HyperSKU authentication");
    if (!accessTokenPromise) accessTokenPromise = requestToken(fetchImpl, env).finally(() => { accessTokenPromise = null; });
    return accessTokenPromise;
  }
  const apiKey = String(env.HYPERSKU_API_KEY || "").trim();
  if (apiKey) return apiKey;
  throw new HyperSkuError("HyperSKU API credentials are not configured");
}

async function requestHyperSku(path, { method = "GET", query, body, fetchImpl = global.fetch, env = process.env, token } = {}) {
  if (!configured(env)) throw new HyperSkuError("HyperSKU integration is not configured");
  if (typeof fetchImpl !== "function") throw new HyperSkuError("Fetch is unavailable for HyperSKU integration");
  const accessToken = token || await getAccessToken({ fetchImpl, env });
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(`${apiBaseUrl(env)}/${normalizedPath}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.append(key, String(value));
  }
  const hasBody = body !== undefined;
  const response = await scheduleRequest(() => fetchImpl(url, {
    method,
    headers: {
      Authorization: authorizationValue(accessToken, env),
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(requestTimeout(env)),
  }), env);
  const payload = await responseJson(response);
  if (!response.ok || providerFailure(payload)) {
    throw new HyperSkuError("HyperSKU request failed", {
      retryable: response.status >= 500 || response.status === 429,
      statusCode: response.status,
      providerMessage: String(payload?.message || payload?.msg || "").slice(0, 500),
      path: `/${normalizedPath}`.slice(0, 200),
    });
  }
  return payload;
}

async function testConnection(options = {}) {
  const payload = await requestHyperSku(HYPERSKU_PATHS.countryCodes, options);
  return { ok: true, countryCount: Array.isArray(payload?.data) ? payload.data.length : null };
}

function requireArray(value, message) {
  if (!Array.isArray(value) || !value.length) throw new HyperSkuError(message);
  return value;
}

async function getCountryCodes(options = {}) {
  const payload = await requestHyperSku(HYPERSKU_PATHS.countryCodes, options);
  return payload?.data || [];
}

async function getLogisticsBySku({ countryCode, skuItems } = {}, options = {}) {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new HyperSkuError("A valid HyperSKU destination country code is required");
  const payload = await requestHyperSku(HYPERSKU_PATHS.logisticsBySku, { method: "POST", body: { countryCode: code, skuItems: requireArray(skuItems, "At least one HyperSKU item is required") }, ...options });
  return payload?.data || payload;
}

async function createOrder(orderPayload, options = {}) {
  if (!orderPayload || typeof orderPayload !== "object" || Array.isArray(orderPayload)) throw new HyperSkuError("A HyperSKU order payload is required");
  const payload = await requestHyperSku(HYPERSKU_PATHS.createOrder, { method: "POST", body: orderPayload, ...options });
  return payload?.data || payload;
}

async function getOrdersByExternalOrderId({ storeCode, storeOrderId } = {}, options = {}) {
  const normalizedStoreOrderId = String(storeOrderId || "").trim();
  if (!normalizedStoreOrderId) throw new HyperSkuError("A HyperSKU store order id is required");
  const payload = await requestHyperSku(HYPERSKU_PATHS.ordersByExternalId, {
    method: "POST",
    body: { storeCode: String(storeCode || process.env.HYPERSKU_STORE_CODE || "").trim(), storeOrderId: normalizedStoreOrderId },
    ...options,
  });
  return payload?.data || payload;
}

async function getOrderStatus(orderIds, options = {}) {
  const ids = requireArray(orderIds, "At least one HyperSKU order id is required");
  const payload = await requestHyperSku(HYPERSKU_PATHS.orderStatus, { method: "POST", body: ids, ...options });
  return payload?.data || payload;
}

async function getOrderByStoreOrderId(storeOrderId, options = {}) {
  const normalizedStoreOrderId = String(storeOrderId || "").trim();
  if (!normalizedStoreOrderId) throw new HyperSkuError("A HyperSKU store order id is required");
  const payload = await requestHyperSku(`${HYPERSKU_PATHS.orderByStoreId}/${encodeURIComponent(normalizedStoreOrderId)}`, options);
  return payload?.data || payload;
}

async function getInternationalLogisticsInfo(storeOrderId, options = {}) {
  const normalizedStoreOrderId = String(storeOrderId || "").trim();
  if (!normalizedStoreOrderId) throw new HyperSkuError("A HyperSKU store order id is required");
  const payload = await requestHyperSku(`${HYPERSKU_PATHS.internationalLogistics}/${encodeURIComponent(normalizedStoreOrderId)}`, options);
  return payload?.data || payload;
}

function resetHyperSkuAuthCache() {
  accessTokenCache = null;
  accessTokenPromise = null;
  requestQueue = Promise.resolve();
  lastRequestAt = 0;
}

module.exports = {
  HYPERSKU_API_BASE_URL,
  HYPERSKU_PATHS,
  HyperSkuError,
  configured,
  createOrder,
  getAccessToken,
  getCountryCodes,
  getInternationalLogisticsInfo,
  getLogisticsBySku,
  getOrderByStoreOrderId,
  getOrdersByExternalOrderId,
  getOrderStatus,
  requestHyperSku,
  resetHyperSkuAuthCache,
  testConnection,
};
