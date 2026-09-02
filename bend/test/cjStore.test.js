const test = require("node:test");
const assert = require("node:assert/strict");
const { resetCjTrackingCache } = require("../utils/cjTracking");
const {
  extractCjProductId,
  extractCjVariantRecords,
  syncCjStoreProduct,
} = require("../utils/cjStore");

test("CJ store sync saves a site product, variants, and product connection", async () => {
  resetCjTrackingCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ result: true, data: true }), { status: 200 });
  };

  const result = await syncCjStoreProduct({
    cjProductId: "fallback-cj-product",
    platformProductId: 42,
    title: "Example site product",
    image: "https://example.com/product.jpg",
    description: "Example description",
    salePrice: 19.99,
    raw: {
      data: {
        pid: "cj-product-123",
        variants: [{ vid: "cj-variant-123", variantSku: "CJ-SKU-123", variantNameEn: "Blue" }],
      },
    },
  }, {
    fetchImpl,
    env: {
      CJ_ACCESS_TOKEN: "server-token",
      CJ_SHOP_ID: "shop-1",
      CJ_PRODUCT_CONNECTION_LOGISTICS: "PacketPlus",
      CJ_REQUEST_MIN_INTERVAL_MS: "1250",
    },
  });

  assert.equal(result.status, "connected");
  assert.equal(result.variantCount, 1);
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /store\/product\/saveProduct/);
  assert.match(calls[1].url, /store\/product\/saveVariantBatch/);
  assert.match(calls[2].url, /product\/conn\/connection/);

  const connection = JSON.parse(calls[2].options.body);
  assert.equal(connection.shopId, "shop-1");
  assert.equal(connection.cjProductId, "cj-product-123");
  assert.equal(connection.platformProductId, "42");
  assert.deepEqual(connection.variantList, [{
    cjVariantId: "cj-variant-123",
    platformVariantId: "42-1",
  }]);
});

test("CJ store sync can be disabled without calling CJ", async () => {
  const result = await syncCjStoreProduct({
    cjProductId: "cj-product-123",
    platformProductId: 42,
    title: "Example site product",
    image: "https://example.com/product.jpg",
  }, { env: { CJ_STORE_SYNC_ENABLED: "false" } });

  assert.equal(result.status, "disabled");
  assert.equal(result.storeProductSaved, false);
});

test("CJ store helpers preserve product and variant identifiers from detail data", () => {
  const raw = {
    data: {
      pid: "cj-product-123",
      variants: [{ vid: "cj-variant-123", variantSku: "CJ-SKU-123" }],
    },
  };
  assert.equal(extractCjProductId(raw, "fallback"), "cj-product-123");
  assert.deepEqual(extractCjVariantRecords(raw, "https://example.com/product.jpg"), [{
    cjVariantId: "cj-variant-123",
    sku: "CJ-SKU-123",
    title: "CJ-SKU-123",
    image: "https://example.com/product.jpg",
    price: null,
    weight: null,
    weightUnit: "g",
  }]);
});
