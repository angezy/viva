const test = require("node:test");
const assert = require("node:assert/strict");
const { confirmCjOrder, createCjOrder, payCjOrderBalance, resetCjTrackingCache } = require("../utils/cjTracking");

test("CJ order creation uses the server token and returns CJ's order id", async () => {
  resetCjTrackingCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("getAccessToken")) {
      return new Response(JSON.stringify({ result: true, data: { accessToken: "server-token" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: true, data: "CJ-ORDER-123" }), { status: 200 });
  };

  const result = await createCjOrder({ orderNumber: "WLX-123", products: [{ vid: "variant-1", quantity: 1 }] }, {
    fetchImpl,
    env: { CJ_API_KEY: "private-api-key" },
  });

  assert.equal(result.orderId, "CJ-ORDER-123");
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /shopping\/order\/createOrderV3/);
  assert.equal(calls[1].options.headers["CJ-Access-Token"], "server-token");
  assert.doesNotMatch(calls[1].options.body, /private-api-key/);
});

test("CJ order creation preserves a safe provider diagnostic when CJ rejects an order", async () => {
  resetCjTrackingCache();
  const fetchImpl = async (url) => {
    if (String(url).includes("getAccessToken")) {
      return new Response(JSON.stringify({ result: true, data: { accessToken: "server-token" } }), { status: 200 });
    }
    return new Response(JSON.stringify({
      result: false,
      code: 1600100,
      message: "The selected logistics service is unavailable.",
      requestId: "cj-request-123",
    }), { status: 200 });
  };

  await assert.rejects(
    () => createCjOrder({ orderNumber: "WLX-123", products: [{ vid: "variant-1", quantity: 1 }] }, {
      fetchImpl,
      env: { CJ_API_KEY: "private-api-key" },
    }),
    (error) => {
      assert.equal(error.name, "CjTrackingError");
      assert.equal(error.code, 1600100);
      assert.equal(error.providerMessage, "The selected logistics service is unavailable.");
      assert.equal(error.requestId, "cj-request-123");
      return true;
    },
  );
});

test("CJ order confirmation uses the documented PATCH endpoint", async () => {
  resetCjTrackingCache();
  let call;
  const fetchImpl = async (url, options = {}) => {
    call = { url: String(url), options };
    return new Response(JSON.stringify({ result: true, data: "CJ-ORDER-123" }), { status: 200 });
  };

  await confirmCjOrder("CJ-ORDER-123", {
    fetchImpl,
    env: { CJ_ACCESS_TOKEN: "server-token", CJ_REQUEST_MIN_INTERVAL_MS: "1250" },
  });

  assert.match(call.url, /shopping\/order\/confirmOrder/);
  assert.equal(call.options.method, "PATCH");
  assert.deepEqual(JSON.parse(call.options.body), { orderId: "CJ-ORDER-123" });
});

test("CJ live balance payment uses the documented order id payload", async () => {
  resetCjTrackingCache();
  let call;
  const fetchImpl = async (url, options = {}) => {
    call = { url: String(url), options };
    return new Response(JSON.stringify({ result: true, data: null }), { status: 200 });
  };

  await payCjOrderBalance("2608271719200642800", {
    fetchImpl,
    env: { CJ_ACCESS_TOKEN: "server-token", CJ_REQUEST_MIN_INTERVAL_MS: "1250" },
  });

  assert.match(call.url, /shopping\/pay\/payBalance$/);
  assert.equal(call.options.method, "POST");
  assert.deepEqual(JSON.parse(call.options.body), { orderId: "2608271719200642800" });
});
