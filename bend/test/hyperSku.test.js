const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HYPERSKU_PATHS,
  configured,
  createOrder,
  getCountryCodes,
  getOrderByStoreOrderId,
  resetHyperSkuAuthCache,
  testConnection,
} = require("../utils/hyperSku");

const baseEnv = {
  HYPERSKU_API_BASE_URL: "https://api.hypersku.com",
  HYPERSKU_REQUEST_MIN_INTERVAL_MS: "0",
};

test("HyperSKU considers a direct access token or API key configured", () => {
  assert.equal(configured({ HYPERSKU_ACCESS_TOKEN: "access-token" }), true);
  assert.equal(configured({ HYPERSKU_API_KEY: "api-key" }), true);
  assert.equal(configured({ HYPERSKU_USERNAME: "user", HYPERSKU_PASSWORD: "pass" }), false);
  assert.equal(configured({}), false);
});

test("HyperSKU connection test uses the documented country-code endpoint", async () => {
  resetHyperSkuAuthCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ status: 0, data: [{ countryCode: "US" }] }), { status: 200 });
  };

  const result = await testConnection({ fetchImpl, env: { ...baseEnv, HYPERSKU_API_KEY: "private-api-key" } });
  assert.deepEqual(result, { ok: true, countryCount: 1 });
  assert.match(calls[0].url, new RegExp(`${HYPERSKU_PATHS.countryCodes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  assert.equal(calls[0].options.headers.Authorization, "private-api-key");
  assert.doesNotMatch(calls[0].url, /private-api-key/);
});

test("HyperSKU can exchange API username/password for a server-side token", async () => {
  resetHyperSkuAuthCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith(HYPERSKU_PATHS.token)) {
      return new Response(JSON.stringify({ status: 0, token: "issued-token", expiresIn: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: 0, data: [{ countryCode: "CA" }] }), { status: 200 });
  };

  const result = await getCountryCodes({ fetchImpl, env: {
    ...baseEnv,
    HYPERSKU_API_KEY: "private-api-key",
    HYPERSKU_USERNAME: "api-user",
    HYPERSKU_PASSWORD: "private-password",
  } });
  assert.deepEqual(result, [{ countryCode: "CA" }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, "private-api-key");
  assert.deepEqual(JSON.parse(calls[0].options.body), { username: "api-user", password: "private-password" });
  assert.equal(calls[1].options.headers.Authorization, "issued-token");
  assert.doesNotMatch(calls[1].url, /private-(?:api-key|password)/);
});

test("HyperSKU order requests stay server-authenticated and preserve provider payloads", async () => {
  resetHyperSkuAuthCache();
  let call;
  const fetchImpl = async (url, options = {}) => {
    call = { url: String(url), options };
    return new Response(JSON.stringify({ status: 0, data: { orderBaseInfo: { orderId: 123 } } }), { status: 200 });
  };

  const created = await createOrder({
    logisticsId: 42,
    shippingAddress: { firstName: "Test", lastName: "Customer", countryCode: "US" },
    skuItems: [{ num: 1, skuId: 987 }],
    thirdOrderId: 1001,
    thirdOrderName: "WLX-1001",
  }, { fetchImpl, env: { ...baseEnv, HYPERSKU_ACCESS_TOKEN: "server-token" } });
  assert.deepEqual(created, { orderBaseInfo: { orderId: 123 } });
  assert.match(call.url, /\/api\/customer\/admin\/orders\/create$/);
  assert.equal(call.options.headers.Authorization, "server-token");
  assert.equal(JSON.parse(call.options.body).thirdOrderName, "WLX-1001");

  await getOrderByStoreOrderId("WLX-1001", { fetchImpl, env: { ...baseEnv, HYPERSKU_ACCESS_TOKEN: "server-token" } });
  assert.match(call.url, /\/api\/customer\/admin\/orders\/list\/WLX-1001$/);
});

test("HyperSKU provider errors expose status without returning credentials", async () => {
  resetHyperSkuAuthCache();
  const fetchImpl = async () => new Response(JSON.stringify({ status: 401, message: "invalid credential" }), { status: 401 });
  await assert.rejects(
    () => testConnection({ fetchImpl, env: { ...baseEnv, HYPERSKU_ACCESS_TOKEN: "private-token" } }),
    (error) => {
      assert.equal(error.name, "HyperSkuError");
      assert.equal(error.statusCode, 401);
      assert.equal(error.providerMessage, "invalid credential");
      return true;
    },
  );
});
