const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculateCjFreight,
  extractCjShippingIdentifiers,
  normalizeFreightOptions,
  resetCjShippingCache,
  resolveCjVariantId,
} = require("../utils/cjShipping");

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

test("normalizes, de-duplicates, and sorts CJ freight services", () => {
  const options = normalizeFreightOptions({ data: [
    { logisticName: "Fast Line", logisticAging: "3-5 days", logisticPrice: 12.345, totalPostageFee: 13.2 },
    { logisticName: "Budget Line", logisticAging: "8-12 days", logisticPrice: 4.1 },
    { logisticName: "fast line", logisticPrice: 99 },
    { logisticName: "Missing price" },
  ] });

  assert.deepEqual(options.map((option) => [option.logisticName, option.cost]), [
    ["Budget Line", 4.1],
    ["Fast Line", 13.2],
  ]);
});

test("extracts the original product SKU from a stored import payload", () => {
  assert.deepEqual(extractCjShippingIdentifiers({ data: { productSku: "CJYD1987029" } }, "CJYD198702901AZ"), {
    productSku: "CJYD1987029",
    vid: "",
  });
  assert.deepEqual(extractCjShippingIdentifiers({ variants: [{ productSku: "BASE", variantSku: "RED", vid: "VID-RED" }] }, "RED"), {
    productSku: "BASE",
    vid: "VID-RED",
  });
});

test("resolves a mapped variant SKU to its CJ VID", async () => {
  resetCjShippingCache();
  let requestedUrl = "";
  const fetchImpl = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({ result: true, data: [{ vid: "variant-id-1", variantSku: "SKU-RED" }] });
  };
  const result = await resolveCjVariantId(
    { lookup: "SKU-RED", storefrontSku: "STORE-SKU" },
    { fetchImpl, env: { CJ_ACCESS_TOKEN: "test-token", CJ_REQUEST_MIN_INTERVAL_MS: "0" } },
  );

  assert.equal(result.vid, "variant-id-1");
  assert.match(requestedUrl, /product\/variant\/query/);
  assert.match(requestedUrl, /productSku=STORE-SKU/);
});

test("resolves an older variant-SKU mapping through CJ catalog search", async () => {
  resetCjShippingCache();
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    const requestedUrl = String(url);
    requestedUrls.push(requestedUrl);
    if (requestedUrl.includes("product/listV2")) {
      return jsonResponse({ result: true, data: { content: [{ productList: [{ sku: "CJYD1987029" }] }] } });
    }
    if (requestedUrl.includes("productSku=7") || requestedUrl.includes("productSku=CJYD198702901AZ")) {
      return jsonResponse({ result: false, code: 1602001, message: "Product not found" });
    }
    return jsonResponse({ result: true, data: [{ vid: "1767474217676705792", variantSku: "CJYD198702901AZ" }] });
  };

  const result = await resolveCjVariantId(
    { lookup: "CJYD198702901AZ", storefrontSku: "7" },
    { fetchImpl, env: { CJ_ACCESS_TOKEN: "test-token", CJ_REQUEST_MIN_INTERVAL_MS: "0" } },
  );

  assert.equal(result.vid, "1767474217676705792");
  assert.ok(requestedUrls.some((url) => url.includes("product/listV2") && url.includes("keyWord=CJYD198702901AZ")));
  assert.ok(requestedUrls.some((url) => url.includes("productSku=CJYD1987029")));
});

test("sends CJ VID quantities and returns live freight choices", async () => {
  let requestBody;
  const fetchImpl = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return jsonResponse({ result: true, data: [{ logisticName: "Sandbox Line", logisticAging: "5-9 days", logisticPrice: 7.5 }] });
  };
  const options = await calculateCjFreight({
    startCountryCode: "CN",
    endCountryCode: "US",
    zip: "10001",
    products: [{ vid: "variant-id-1", quantity: 2 }],
  }, { fetchImpl, env: { CJ_ACCESS_TOKEN: "test-token", CJ_REQUEST_MIN_INTERVAL_MS: "0" } });

  assert.deepEqual(requestBody, {
    startCountryCode: "CN",
    endCountryCode: "US",
    zip: "10001",
    products: [{ quantity: 2, vid: "variant-id-1" }],
  });
  assert.equal(options[0].logisticName, "Sandbox Line");
  assert.equal(options[0].cost, 7.5);
});
