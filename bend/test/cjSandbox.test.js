const test = require("node:test");
const assert = require("node:assert/strict");
const { resetCjTrackingCache } = require("../utils/cjTracking");
const {
  chooseInStockCjLogistics,
  getCjOrderOptionalLogistics,
  simulateCjSandboxPayment,
  updateCjOrderLogistics,
  updateCjSandboxStatus,
  updateCjSandboxTrackingNumber,
} = require("../utils/cjSandbox");

test("CJ sandbox helpers use only the documented simulation endpoints", async () => {
  resetCjTrackingCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("getAccessToken")) {
      return new Response(JSON.stringify({ result: true, data: { accessToken: "sandbox-token" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: true, data: true }), { status: 200 });
  };
  const options = { fetchImpl, env: { CJ_API_TOKEN: "private-api-key" } };

  await simulateCjSandboxPayment("SD-1", options);
  await updateCjSandboxStatus("SD-1", 400, options);
  await updateCjSandboxTrackingNumber("SD-1", "SBX-TRACK-1", options);

  assert.match(calls[1].url, /shopping\/sandbox\/simulatePay/);
  assert.match(calls[2].url, /shopping\/sandbox\/updateStatus/);
  assert.match(calls[3].url, /shopping\/sandbox\/updateTrackNumber/);
  assert.deepEqual(JSON.parse(calls[2].options.body), { orderId: "SD-1", targetStatus: 400 });
  assert.deepEqual(JSON.parse(calls[3].options.body), { orderId: "SD-1", trackNumber: "SBX-TRACK-1" });
  assert.doesNotMatch(calls[3].options.body, /private-api-key/);
});

test("CJ sandbox helpers reject unsafe simulation inputs before calling CJ", async () => {
  await assert.rejects(() => updateCjSandboxStatus("SD-1", 300), /400, 500, 600, or 700/);
  await assert.rejects(() => updateCjSandboxTrackingNumber("SD-1", "bad\nnumber"), /invalid characters/);
});

test("CJ sandbox logistics repair preserves large logistics IDs exactly", async () => {
  const replacement = chooseInStockCjLogistics([
    { id: "2608271719200642600", orderCode: "SD-1", logisticsName: "Sandbox Line", hasStock: true },
  ]);
  assert.deepEqual(replacement, {
    id: "2608271719200642600",
    orderCode: "SD-1",
    logisticsName: "Sandbox Line",
  });

  let body = "";
  const fetchImpl = async (_url, options = {}) => {
    body = options.body;
    return new Response(JSON.stringify({ result: true, data: true }), { status: 200 });
  };
  await updateCjOrderLogistics(replacement, {
    fetchImpl,
    env: { CJ_ACCESS_TOKEN: "sandbox-token", CJ_REQUEST_MIN_INTERVAL_MS: "1250" },
  });
  assert.match(body, /"id":2608271719200642600/);
  assert.doesNotMatch(body, /"id":"2608271719200642600"/);
});

test("CJ sandbox logistics lookup preserves large CJ IDs as strings", async () => {
  const fetchImpl = async () => new Response(
    '{"result":true,"data":[{"id":2608271719200642600,"orderCode":"SD-1","logisticsName":"Sandbox Line","hasStock":true}]}',
    { status: 200 },
  );
  const options = await getCjOrderOptionalLogistics("SD-1", {
    fetchImpl,
    env: { CJ_ACCESS_TOKEN: "sandbox-token", CJ_REQUEST_MIN_INTERVAL_MS: "1250" },
  });
  assert.equal(options[0].id, "2608271719200642600");
});
