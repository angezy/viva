const { CjTrackingError, requestCj } = require("./cjTracking");

const VARIANT_CACHE_TTL_MS = 30 * 60 * 1000;
const variantCache = new Map();

function text(value, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finiteMoney(...values) {
  for (const value of values) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount >= 0) return Math.round(amount * 100) / 100;
  }
  return null;
}

function responseList(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  return [];
}

function extractCjShippingIdentifiers(rawValue, lookupValue = "") {
  let raw = rawValue;
  if (typeof rawValue === "string") {
    try { raw = JSON.parse(rawValue); } catch (_error) { raw = null; }
  }
  const lookup = text(lookupValue, 120).toLowerCase();
  const productSkus = [];
  const variants = [];

  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const productSku = text(value.productSku, 120);
    if (productSku && !productSkus.some((sku) => sku.toLowerCase() === productSku.toLowerCase())) productSkus.push(productSku);
    const vid = text(value.vid || value.variantId, 120);
    if (vid) variants.push({
      vid,
      variantSku: text(value.variantSku || value.sku, 120),
      productSku,
    });
    Object.values(value).forEach(visit);
  }
  visit(raw);

  const exactVariant = variants.find((variant) => lookup && variant.variantSku.toLowerCase() === lookup);
  const singleVariant = variants.length === 1 ? variants[0] : null;
  return {
    productSku: exactVariant?.productSku || productSkus[0] || "",
    vid: exactVariant?.vid || singleVariant?.vid || "",
  };
}

function normalizeFreightOptions(payload) {
  const seen = new Set();
  return responseList(payload)
    .map((item) => {
      const logisticName = text(item?.logisticName || item?.logisticsName, 200);
      const cost = finiteMoney(item?.totalPostageFee, item?.postageAmount, item?.logisticPrice);
      if (!logisticName || cost == null) return null;
      return {
        method: logisticName,
        logisticName,
        label: logisticName,
        window: text(item?.logisticAging || item?.arrivalTime || "Delivery time shown by carrier", 120),
        cost,
        currency: "USD",
        free: cost === 0,
      };
    })
    .filter((option) => {
      if (!option) return false;
      const key = option.logisticName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.cost - right.cost || left.logisticName.localeCompare(right.logisticName));
}

function looksLikeProductId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text(value, 120));
}

function chooseVariant(records, lookup, storefrontSku) {
  const candidates = Array.isArray(records) ? records : [];
  const expected = [lookup, storefrontSku].map((value) => text(value, 120).toLowerCase()).filter(Boolean);
  const exact = candidates.find((item) => {
    const values = [item?.vid, item?.variantSku, item?.sku, item?.productSku]
      .map((value) => text(value, 120).toLowerCase())
      .filter(Boolean);
    return expected.some((value) => values.includes(value));
  });
  const selected = exact || (candidates.length === 1 ? candidates[0] : null);
  const vid = text(selected?.vid || selected?.variantId, 120);
  return vid ? { vid, variantSku: text(selected?.variantSku || selected?.sku, 120) } : null;
}

async function queryVariants(query, options) {
  const payload = await requestCj("product/variant/query", { query, ...options });
  return responseList(payload);
}

function isCjProductNotFound(error) {
  return error?.name === "CjTrackingError" && Number(error?.code) === 1602001;
}

async function queryVariantsIfAvailable(query, options) {
  try {
    return await queryVariants(query, options);
  } catch (error) {
    // A product may have been re-indexed by CJ. Treat this as a miss so the
    // caller can try the catalog-search fallback; do not mask other errors.
    if (isCjProductNotFound(error)) return [];
    throw error;
  }
}

function productSkusFromSearch(payload) {
  const data = payload?.data;
  const pages = [
    ...(Array.isArray(data) ? data : []),
    ...(Array.isArray(data?.list) ? data.list : []),
    ...(Array.isArray(data?.content) ? data.content : []),
    ...(Array.isArray(data?.records) ? data.records : []),
    ...(Array.isArray(data?.productList) ? data.productList : []),
  ];
  const products = pages.flatMap((page) => Array.isArray(page?.productList) ? page.productList : [page]);
  return [...new Set(products
    .map((product) => text(product?.productSku || product?.sku || product?.spu, 120))
    .filter(Boolean))];
}

async function findProductSkuCandidates(lookup, options) {
  const payload = await requestCj("product/listV2", {
    query: { page: 1, size: 20, keyWord: text(lookup, 120) },
    ...options,
  });
  return productSkusFromSearch(payload);
}

async function resolveCjVariantId({ lookup, storefrontSku, productSku }, options = {}) {
  const normalizedLookup = text(lookup, 120);
  const normalizedSku = text(storefrontSku, 120);
  const normalizedProductSku = text(productSku, 120);
  if (!normalizedLookup) throw new CjTrackingError("This product is not linked to a CJ catalog item");

  const cacheKey = `${normalizedLookup.toLowerCase()}|${normalizedSku.toLowerCase()}|${normalizedProductSku.toLowerCase()}`;
  const cached = variantCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return cached.value;

  const primaryProductSku = normalizedProductSku || normalizedSku || normalizedLookup;
  const primaryQuery = looksLikeProductId(normalizedLookup)
    ? { pid: normalizedLookup }
    : { productSku: primaryProductSku };
  let records = await queryVariantsIfAvailable(primaryQuery, options);
  let selected = chooseVariant(records, normalizedLookup, normalizedSku);

  if (!selected && !looksLikeProductId(normalizedLookup) && normalizedLookup.toLowerCase() !== primaryProductSku.toLowerCase()) {
    records = await queryVariantsIfAvailable({ productSku: normalizedLookup }, options);
    selected = chooseVariant(records, normalizedLookup, normalizedSku);
  }

  // Older imports can store a variant SKU where CJ now requires its parent
  // product SKU. Search CJ's catalog, then resolve the returned product SKU
  // back to the exact original variant SKU.
  if (!selected && !looksLikeProductId(normalizedLookup)) {
    const candidates = await findProductSkuCandidates(normalizedLookup, options);
    const tried = new Set([primaryProductSku, normalizedLookup].map((value) => value.toLowerCase()));
    for (const candidate of candidates) {
      if (tried.has(candidate.toLowerCase())) continue;
      tried.add(candidate.toLowerCase());
      records = await queryVariantsIfAvailable({ productSku: candidate }, options);
      selected = chooseVariant(records, normalizedLookup, normalizedSku);
      if (selected) break;
    }
  }
  if (!selected) throw new CjTrackingError(`No unambiguous CJ variant was found for ${normalizedLookup}`);

  variantCache.set(cacheKey, { value: selected, expiresAt: Date.now() + VARIANT_CACHE_TTL_MS });
  return selected;
}

async function calculateCjFreight({ startCountryCode, endCountryCode, zip, products }, options = {}) {
  const origin = text(startCountryCode, 2).toUpperCase();
  const destination = text(endCountryCode, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(origin) || !/^[A-Z]{2}$/.test(destination)) {
    throw new CjTrackingError("Valid origin and destination country codes are required");
  }
  if (!Array.isArray(products) || !products.length) throw new CjTrackingError("At least one CJ product is required");

  const payload = await requestCj("logistic/freightCalculate", {
    method: "POST",
    body: {
      startCountryCode: origin,
      endCountryCode: destination,
      ...(text(zip, 30) ? { zip: text(zip, 30) } : {}),
      products: products.map((product) => ({
        quantity: Math.max(1, Number.parseInt(product.quantity, 10) || 1),
        vid: text(product.vid, 120),
      })),
    },
    ...options,
  });
  const freightOptions = normalizeFreightOptions(payload);
  if (!freightOptions.length) throw new CjTrackingError("CJ returned no shipping services for this cart and destination");
  return freightOptions;
}

function resetCjShippingCache() {
  variantCache.clear();
}

module.exports = {
  calculateCjFreight,
  extractCjShippingIdentifiers,
  normalizeFreightOptions,
  resetCjShippingCache,
  resolveCjVariantId,
};
