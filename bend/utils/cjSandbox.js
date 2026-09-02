const { CjTrackingError, requestCj } = require("./cjTracking");

const SANDBOX_TARGET_STATUSES = new Set([400, 500, 600, 700]);

function normalizeOrderId(value) {
  const orderId = String(value || "").trim();
  if (!orderId || orderId.length > 200) throw new CjTrackingError("A valid CJ sandbox order id is required");
  return orderId;
}

function normalizeTrackingNumber(value) {
  const trackingNumber = String(value || "").trim();
  if (!trackingNumber || trackingNumber.length > 64) throw new CjTrackingError("A sandbox tracking number must be 1 to 64 characters");
  if (/[\u0000-\u001f\u007f]/.test(trackingNumber)) throw new CjTrackingError("A sandbox tracking number contains invalid characters");
  return trackingNumber;
}

function normalizeOrderCode(value) {
  const orderCode = String(value || "").trim();
  if (!orderCode || orderCode.length > 200) throw new CjTrackingError("A valid CJ order code is required");
  return orderCode;
}

function normalizeLogisticsId(value) {
  const id = String(value || "").trim();
  if (!/^\d{1,20}$/.test(id)) throw new CjTrackingError("A valid CJ logistics option id is required");
  return id;
}

function normalizeLogisticsName(value) {
  const logisticsName = String(value || "").trim();
  if (!logisticsName || logisticsName.length > 200 || /[\u0000-\u001f\u007f]/.test(logisticsName)) {
    throw new CjTrackingError("A valid CJ logistics name is required");
  }
  return logisticsName;
}

async function getCjOrderOptionalLogistics(orderCode, options = {}) {
  const payload = await requestCj("shopping/order/getOrderLogisticsInfo", {
    query: { orderCode: normalizeOrderCode(orderCode) },
    ...options,
  });
  return Array.isArray(payload?.data) ? payload.data : [];
}

function chooseInStockCjLogistics(options) {
  const candidates = Array.isArray(options) ? options : [];
  const selected = candidates.find((option) => option?.hasStock === true) || candidates.find(Boolean) || null;
  if (!selected) throw new CjTrackingError("CJ returned no available logistics service for this sandbox order");
  return {
    id: normalizeLogisticsId(selected.id),
    orderCode: normalizeOrderCode(selected.orderCode),
    logisticsName: normalizeLogisticsName(selected.logisticsName),
  };
}

async function updateCjOrderLogistics({ id, orderCode, logisticsName }, options = {}) {
  const normalizedId = normalizeLogisticsId(id);
  const normalizedOrderCode = normalizeOrderCode(orderCode);
  const normalizedLogisticsName = normalizeLogisticsName(logisticsName);
  const bodyJson = `{"id":${normalizedId},"orderCode":${JSON.stringify(normalizedOrderCode)},"logisticsName":${JSON.stringify(normalizedLogisticsName)},"from":1}`;
  const payload = await requestCj("shopping/order/updateLogistics", {
    method: "POST",
    bodyJson,
    ...options,
  });
  return payload?.data ?? true;
}

async function simulateCjSandboxPayment(orderId, options = {}) {
  const payload = await requestCj("shopping/sandbox/simulatePay", {
    method: "POST",
    body: { orderId: normalizeOrderId(orderId) },
    ...options,
  });
  return payload?.data ?? true;
}

async function updateCjSandboxStatus(orderId, targetStatus, options = {}) {
  const normalizedStatus = Number(targetStatus);
  if (!SANDBOX_TARGET_STATUSES.has(normalizedStatus)) {
    throw new CjTrackingError("CJ sandbox status must be 400, 500, 600, or 700");
  }
  const payload = await requestCj("shopping/sandbox/updateStatus", {
    method: "POST",
    body: { orderId: normalizeOrderId(orderId), targetStatus: normalizedStatus },
    ...options,
  });
  return payload?.data ?? true;
}

async function updateCjSandboxTrackingNumber(orderId, trackingNumber, options = {}) {
  const payload = await requestCj("shopping/sandbox/updateTrackNumber", {
    method: "POST",
    body: {
      orderId: normalizeOrderId(orderId),
      trackNumber: normalizeTrackingNumber(trackingNumber),
    },
    ...options,
  });
  return payload?.data ?? true;
}

module.exports = {
  SANDBOX_TARGET_STATUSES,
  chooseInStockCjLogistics,
  getCjOrderOptionalLogistics,
  simulateCjSandboxPayment,
  updateCjOrderLogistics,
  updateCjSandboxStatus,
  updateCjSandboxTrackingNumber,
};
