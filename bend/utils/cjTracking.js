const CJ_API_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

const TRACKING_STAGES = [
  "Processing",
  "Packed",
  "Shipped",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

let accessTokenCache = null;
let accessTokenPromise = null;
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

function requestTimeout(env = process.env) {
  const configuredTimeout = Number(env.CJ_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) ? Math.min(60_000, Math.max(5_000, configuredTimeout)) : 20_000;
}

function requestInterval(env = process.env) {
  const configuredInterval = Number(env.CJ_REQUEST_MIN_INTERVAL_MS);
  // CJ's one-request-per-second limit is strict at its edge, so keep a small
  // buffer even when an older environment still specifies 1100ms.
  return Number.isFinite(configuredInterval) ? Math.min(5_000, Math.max(1_250, configuredInterval)) : 1_250;
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

class CjTrackingError extends Error {
  constructor(message, { retryable = false, statusCode = null, code = null, providerMessage = "", requestId = "", path = "" } = {}) {
    super(message);
    this.name = "CjTrackingError";
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.code = code;
    this.providerMessage = providerMessage;
    this.requestId = requestId;
    this.path = path;
  }
}

function configured(env = process.env) {
  return Boolean(
    String(env.CJ_ACCESS_TOKEN || "").trim()
    || String(env.CJ_API_KEY || "").trim()
    || String(env.CJ_API_TOKEN || "").trim()
    || String(env.CJ_TOKEN || "").trim()
  );
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cacheAccessToken(token, expiryValue) {
  const expiry = parseDate(expiryValue);
  // CJ access tokens are long-lived. Keep a shorter local cache so a rotated
  // token is picked up without restarting the service.
  const maxCacheLifetime = Date.now() + (30 * 60 * 1000);
  const expiresAt = expiry ? Math.min(new Date(expiry).getTime() - 60_000, maxCacheLifetime) : maxCacheLifetime;
  accessTokenCache = { token, expiresAt };
  return token;
}

async function responseJson(response) {
  try {
    // CJ returns identifiers that exceed JavaScript's safe integer range.
    // Preserve those values as strings so a later update request sends the
    // exact logistics/order ID instead of a rounded number.
    if (typeof response?.text === "function") {
      const text = await response.text();
      if (!text) return null;
      const safeJson = text.replace(/("(?:\\.|[^"\\])*"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g, '$1"$2"');
      return JSON.parse(safeJson);
    }
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function rateLimited(response, payload) {
  return response?.status === 429
    || Number(payload?.code) === 1600200
    || /too\s+many\s+requests|qps\s+limit/i.test(String(payload?.message || ""));
}

function rateLimitRetryDelay(env = process.env) {
  return Math.max(1_250, requestInterval(env));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestAccessToken(fetchImpl, env) {
  const apiKey = String(env.CJ_API_KEY || env.CJ_API_TOKEN || env.CJ_TOKEN || "").trim();
  if (!apiKey) throw new CjTrackingError("CJ tracking is not configured");

  const response = await scheduleRequest(() => fetchImpl(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
    signal: AbortSignal.timeout(requestTimeout(env)),
  }), env);
  const payload = await responseJson(response);
  const token = String(payload?.data?.accessToken || "").trim();
  if (!response.ok || !token || payload?.result === false || payload?.success === false) {
    throw new CjTrackingError("CJ authentication failed", {
      retryable: response.status >= 500 || rateLimited(response, payload),
      statusCode: response.status,
      code: payload?.code ?? null,
      providerMessage: String(payload?.message || "").slice(0, 500),
      requestId: String(payload?.requestId || "").slice(0, 100),
      path: "authentication/getAccessToken",
    });
  }
  return cacheAccessToken(token, payload?.data?.accessTokenExpiryDate);
}

async function getAccessToken({ fetchImpl = global.fetch, env = process.env } = {}) {
  const suppliedToken = String(env.CJ_ACCESS_TOKEN || "").trim();
  if (suppliedToken) return suppliedToken;
  if (typeof fetchImpl !== "function") throw new CjTrackingError("Fetch is unavailable for CJ tracking");
  if (accessTokenCache?.expiresAt > Date.now()) return accessTokenCache.token;
  if (!accessTokenPromise) {
    accessTokenPromise = requestAccessToken(fetchImpl, env).finally(() => { accessTokenPromise = null; });
  }
  return accessTokenPromise;
}

async function requestCj(path, { method = "GET", query, body, bodyJson, fetchImpl = global.fetch, env = process.env } = {}) {
  if (!configured(env)) throw new CjTrackingError("CJ integration is not configured");
  if (typeof fetchImpl !== "function") throw new CjTrackingError("Fetch is unavailable for CJ integration");

  const token = await getAccessToken({ fetchImpl, env });
  const url = new URL(`${CJ_API_BASE_URL}/${String(path || "").replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.append(key, String(value));
  }

  const hasBody = body !== undefined || bodyJson !== undefined;
  const executeRequest = () => fetchImpl(url, {
    method,
    headers: {
      "CJ-Access-Token": token,
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: bodyJson === undefined ? JSON.stringify(body) : bodyJson } : {}),
    signal: AbortSignal.timeout(requestTimeout(env)),
  });
  let response = await scheduleRequest(executeRequest, env);
  let payload = await responseJson(response);
  // The request was rejected before order creation, so a single queued retry
  // is safe. It also covers a fresh access-token request counting toward the
  // same CJ account-wide QPS limit.
  if (rateLimited(response, payload)) {
    await wait(rateLimitRetryDelay(env));
    response = await scheduleRequest(executeRequest, env);
    payload = await responseJson(response);
  }
  if (!response.ok || payload?.result === false || payload?.success === false) {
    throw new CjTrackingError("CJ request failed", {
      retryable: response.status >= 500 || rateLimited(response, payload),
      statusCode: response.status,
      code: payload?.code ?? null,
      providerMessage: String(payload?.message || "").slice(0, 500),
      requestId: String(payload?.requestId || "").slice(0, 100),
      path: String(path || "").slice(0, 200),
    });
  }
  return payload || {};
}

async function createCjOrder(orderPayload, options = {}) {
  const payload = await requestCj("shopping/order/createOrderV3", {
    method: "POST",
    body: orderPayload,
    ...options,
  });
  const data = payload?.data;
  const orderId = typeof data === "string"
    ? data
    : String(data?.orderId || data?.id || data?.orderCode || "").trim();
  if (!orderId) throw new CjTrackingError("CJ did not return an order id");
  return {
    orderId,
    orderCode: typeof data === "object" ? String(data?.orderCode || data?.cjOrderCode || "").trim() || null : null,
    shipmentOrderId: typeof data === "object" ? String(data?.shipmentOrderId || data?.shipmentOrderID || "").trim() || null : null,
    cjOrderId: typeof data === "object" ? String(data?.cjOrderId || "").trim() || null : null,
    data,
    requestId: payload?.requestId || null,
  };
}

async function confirmCjOrder(orderId, options = {}) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId || normalizedOrderId.length > 200) throw new CjTrackingError("A valid CJ order id is required");
  await requestCj("shopping/order/confirmOrder", {
    method: "PATCH",
    body: { orderId: normalizedOrderId },
    ...options,
  });
  return normalizedOrderId;
}

// Deduct the CJ account balance for a normal dropshipping order. This endpoint
// is intentionally separate from sandbox simulatePay: calling it can charge
// real CJ funds, so the fulfillment route guards it behind CJ_AUTO_PAY_ENABLED.
async function payCjOrderBalance(orderId, options = {}) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId || normalizedOrderId.length > 200) throw new CjTrackingError("A valid CJ order id is required");
  const payload = await requestCj("shopping/pay/payBalance", {
    method: "POST",
    body: { orderId: normalizedOrderId },
    ...options,
  });
  return payload?.data ?? true;
}

async function payCjOrderBalanceV2({ shipmentOrderId, payId, orderType } = {}, options = {}) {
  const normalizedShipmentOrderId = String(shipmentOrderId || "").trim();
  if (!normalizedShipmentOrderId || normalizedShipmentOrderId.length > 200) throw new CjTrackingError("A valid CJ shipment order id is required");
  const body = { shipmentOrderId: normalizedShipmentOrderId };
  if (payId !== undefined && payId !== null && String(payId).trim()) body.payId = String(payId).trim();
  if (orderType !== undefined && orderType !== null && String(orderType).trim()) body.orderType = String(orderType).trim();
  const payload = await requestCj("shopping/pay/payBalanceV2", {
    method: "POST",
    body,
    ...options,
  });
  return payload?.data ?? true;
}

async function fetchCjOrderDetail(orderId, options = {}) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId || normalizedOrderId.length > 200) throw new CjTrackingError("A valid CJ order id is required");
  const payload = await requestCj("shopping/order/getOrderDetail", {
    query: { orderId: normalizedOrderId },
    ...options,
  });
  return payload?.data || null;
}

function stageFromCjStatus(status, fallbackStatus = "Processing") {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return stageFromLocalStatus(fallbackStatus);

  if (/delivered|completed|fulfilled|signed\s*(for|by)?|received\s*(by|at)?\s*(recipient|customer)?/.test(value)) return "Delivered";
  if (/out\s+for\s+delivery|with\s+(the\s+)?(local\s+)?courier|local\s+delivery/.test(value)) return "Out for Delivery";
  if (/in\s+transit|in-transit|transit|customs|departed|arrived\s+at|flight|transport|moving|on\s+the\s+way/.test(value)) return "In Transit";
  if (/unshipped|pending|processing|packed|packing|ready\s+to\s+ship|awaiting\s+(dispatch|shipment)/.test(value)) return "Packed";
  if (/shipped|dispatch|handed\s*(over|to)|carrier\s+(received|accepted)|label\s+created/.test(value)) return "Shipped";
  return stageFromLocalStatus(fallbackStatus);
}

function stageFromLocalStatus(status) {
  const value = String(status || "Processing").toLowerCase();
  if (value.includes("out for")) return "Out for Delivery";
  if (value.includes("deliver")) return "Delivered";
  if (value.includes("transit")) return "In Transit";
  if (value.includes("ship")) return "Shipped";
  if (value.includes("pack")) return "Packed";
  return "Processing";
}

function stageIndex(status) {
  return TRACKING_STAGES.indexOf(stageFromLocalStatus(status));
}

function normalizeTrackingNumber(value) {
  const trackingNumber = String(value || "").trim();
  if (!trackingNumber || trackingNumber.length > 200) throw new CjTrackingError("A valid tracking number is required");
  return trackingNumber;
}

function currentLocationFromTracking(record) {
  const from = String(record?.trackingFrom || "").trim();
  const to = String(record?.trackingTo || "").trim();
  if (from && to) return `${from} → ${to}`;
  return to || from || null;
}

function trackingEventFromRecord(record, stage) {
  const reportedStatus = String(record?.trackingStatus || stage).trim();
  const carrier = String(record?.lastMileCarrier || record?.logisticName || "Shipping carrier")
    .replace(/\bcj\s*dropshipping\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || "Shipping carrier";
  return {
    status: stage,
    title: stage,
    description: `${carrier} reports: ${reportedStatus}.`,
    location: currentLocationFromTracking(record),
    eventAt: parseDate(record?.deliveryTime) || new Date().toISOString(),
  };
}

async function fetchTracking(trackingNumber, { fetchImpl = global.fetch, env = process.env } = {}) {
  if (!configured(env)) throw new CjTrackingError("CJ tracking is not configured");
  if (typeof fetchImpl !== "function") throw new CjTrackingError("Fetch is unavailable for CJ tracking");
  const normalizedNumber = normalizeTrackingNumber(trackingNumber);
  const token = await getAccessToken({ fetchImpl, env });
  const url = new URL(`${CJ_API_BASE_URL}/logistic/trackInfo`);
  url.searchParams.append("trackNumber", normalizedNumber);

  const response = await fetchImpl(url, {
    headers: { "CJ-Access-Token": token, Accept: "application/json" },
    signal: AbortSignal.timeout(requestTimeout(env)),
  });
  const payload = await responseJson(response);
  if (!response.ok || payload?.result === false || payload?.success === false) {
    throw new CjTrackingError("CJ tracking lookup failed", { retryable: response.status >= 500 || response.status === 429 });
  }
  const records = Array.isArray(payload?.data) ? payload.data : [];
  const record = records.find((item) => String(item?.trackingNumber || "").toLowerCase() === normalizedNumber.toLowerCase()) || records[0] || null;
  return record;
}

function resetCjTrackingCache() {
  accessTokenCache = null;
  accessTokenPromise = null;
  requestQueue = Promise.resolve();
  lastRequestAt = 0;
}

module.exports = {
  CJ_API_BASE_URL,
  CjTrackingError,
  TRACKING_STAGES,
  configured,
  confirmCjOrder,
  createCjOrder,
  currentLocationFromTracking,
  fetchCjOrderDetail,
  fetchTracking,
  getAccessToken,
  payCjOrderBalance,
  payCjOrderBalanceV2,
  requestCj,
  resetCjTrackingCache,
  stageFromCjStatus,
  stageFromLocalStatus,
  stageIndex,
  trackingEventFromRecord,
};
