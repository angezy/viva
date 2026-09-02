const test = require("node:test");
const assert = require("node:assert/strict");
const { configured, currentLocationFromTracking, fetchTracking, requestCj, resetCjTrackingCache, stageFromCjStatus, trackingEventFromRecord } = require("../utils/cjTracking");

test("CJ status values map to the storefront's six delivery stages", () => {
  assert.equal(stageFromCjStatus("processing"), "Packed");
  assert.equal(stageFromCjStatus("UNSHIPPED"), "Packed");
  assert.equal(stageFromCjStatus("shipped"), "Shipped");
  assert.equal(stageFromCjStatus("In transit"), "In Transit");
  assert.equal(stageFromCjStatus("Out for delivery"), "Out for Delivery");
  assert.equal(stageFromCjStatus("Delivered"), "Delivered");
  assert.equal(stageFromCjStatus("COMPLETED"), "Delivered");
  assert.equal(stageFromCjStatus("unknown", "Packed"), "Packed");
});

test("CJ tracking queries authenticate on the server and normalize a tracking record", async () => {
  resetCjTrackingCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("getAccessToken")) return new Response(JSON.stringify({ result: true, data: { accessToken: "server-token" } }), { status: 200 });
    return new Response(JSON.stringify({ result: true, data: [{ trackingNumber: "CJ-123", trackingStatus: "In transit", trackingFrom: "CN", trackingTo: "US", lastMileCarrier: "CJPacket" }] }), { status: 200 });
  };
  const record = await fetchTracking("CJ-123", { fetchImpl, env: { CJ_API_KEY: "private-api-key" } });
  assert.equal(record.trackingStatus, "In transit");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers["CJ-Access-Token"], "server-token");
  assert.doesNotMatch(calls[1].url, /private-api-key/);
  assert.match(currentLocationFromTracking(record), /^CN.*US$/);
  const event = trackingEventFromRecord(record, "In Transit");
  assert.equal(event.status, "In Transit");
  assert.equal(event.title, "In Transit");
  assert.equal(event.description, "CJPacket reports: In transit.");
  assert.match(event.location, /^CN.*US$/);
  assert.ok(event.eventAt);
  assert.equal(configured({ CJ_API_KEY: "present" }), true);
  assert.equal(configured({}), false);
});

test("CJ retries a QPS-limited request once through the shared request queue", async () => {
  resetCjTrackingCache();
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({ result: false, code: 1600200, message: "Too Many Requests, QPS limit is 1 time/1second" }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: true, data: { ok: true } }), { status: 200 });
  };

  const result = await requestCj("product/variant/query", {
    query: { productSku: "TEST-SKU" },
    fetchImpl,
    env: { CJ_ACCESS_TOKEN: "test-token", CJ_REQUEST_MIN_INTERVAL_MS: "0" },
  });

  assert.deepEqual(result.data, { ok: true });
  assert.equal(attempts, 2);
});
