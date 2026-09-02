const { CjTrackingError, requestCj } = require("./cjTracking");

const DEFAULT_SOURCE_COUNTRY = "CN";
const DEFAULT_TARGET_COUNTRY = "US";
const DEFAULT_LOGISTICS = "PacketPlus";

function text(value, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function money(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : fallback;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function responseList(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.data?.records)) return payload.data.records;
  return [];
}

function extractCjProductId(raw, fallback = "") {
  const candidates = [
    raw?.data?.pid,
    raw?.data?.product?.pid,
    raw?.data?.productInfo?.pid,
    raw?.data?.productDetails?.pid,
    raw?.product?.pid,
    raw?.pid,
  ];

  for (const candidate of candidates) {
    const value = text(candidate, 100);
    if (value) return value;
  }

  let discovered = "";
  function visit(value, depth = 0) {
    if (discovered || !value || depth > 5 || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    const valuePid = text(value.pid || value.productId, 100);
    const valueId = text(value.id, 100);
    if (valuePid && (value.variants || value.productName || value.productNameEn || value.nameEn || value.productSku)) {
      discovered = valuePid;
      return;
    }
    if (valueId && (value.variants || value.productName || value.productNameEn || value.nameEn || value.productSku || value.sku)) {
      discovered = valueId;
      return;
    }
    Object.values(value).forEach((entry) => visit(entry, depth + 1));
  }
  visit(raw);
  return discovered || text(fallback, 100);
}

function extractCjVariantRecords(raw, fallbackImage = "") {
  const records = [];
  const seen = new Set();

  function add(value) {
    if (!value || typeof value !== "object") return;
    const cjVariantId = text(value.vid || value.variantId || value.variantID, 100);
    const looksLikeVariant = Boolean(
      value.vid
      || value.variantSku
      || value.variantName
      || value.variantNameEn
      || value.variantKey
      || value.variantSellPrice
      || value.variantWeight
    );
    if (!cjVariantId || !looksLikeVariant || seen.has(cjVariantId)) return;
    seen.add(cjVariantId);
    records.push({
      cjVariantId,
      sku: text(value.variantSku || value.sku || value.productSku, 200),
      title: text(value.variantNameEn || value.variantName || value.variantKey || value.title || value.variantSku || value.sku, 500),
      image: text(firstValue(value.variantImage, value.variantImageUrl, value.image, value.imageUrl, fallbackImage), 500),
      price: money(firstValue(value.variantSellPrice, value.sellPrice, value.variantPrice, value.price)),
      weight: money(firstValue(value.variantWeight, value.weight)),
      weightUnit: text(value.weightUnit || "g", 10) || "g",
    });
  }

  function visit(value, depth = 0) {
    if (!value || depth > 6) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    add(value);
    Object.values(value).forEach((entry) => visit(entry, depth + 1));
  }

  visit(raw);
  return records;
}

function storeSyncEnabled(env = process.env) {
  return String(env.CJ_STORE_SYNC_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

function connectionConfig(env = process.env) {
  const parseArea = Number(env.CJ_CONNECTION_DEFAULT_AREA ?? 1);
  const defaultArea = Number.isInteger(parseArea) && parseArea > 0 ? parseArea : 1;
  const ignoreInventory = String(env.CJ_CONNECTION_IGNORE_INVENTORY ?? "0").trim() === "1" ? 1 : 0;
  return {
    shopId: text(env.CJ_SHOP_ID, 50) || null,
    defaultArea,
    logistics: text(env.CJ_PRODUCT_CONNECTION_LOGISTICS || env.CJ_LOGISTIC_NAME || DEFAULT_LOGISTICS, 200),
    sourceCountryCode: text(env.CJ_SOURCE_COUNTRY_CODE || env.CJ_FROM_COUNTRY_CODE || DEFAULT_SOURCE_COUNTRY, 20).toUpperCase(),
    sourceCountry: text(env.CJ_SOURCE_COUNTRY || "China", 100),
    targetCountryCode: text(env.CJ_TARGET_COUNTRY_CODE || DEFAULT_TARGET_COUNTRY, 20).toUpperCase(),
    targetCountry: text(env.CJ_TARGET_COUNTRY || "United States", 100),
    ignoreCheckInventory: ignoreInventory,
  };
}

async function listCjShops(options = {}) {
  const payload = await requestCj("shop/getShops", options);
  return responseList(payload);
}

async function saveCjStoreProduct(product, options = {}) {
  const payload = await requestCj("store/product/saveProduct", {
    method: "POST",
    body: {
      id: text(product?.id, 64),
      title: text(product?.title, 500),
      image: text(product?.image, 400),
      ...(text(product?.description, 5000) ? { description: text(product.description, 5000) } : {}),
      ...(money(product?.priceMin) !== null ? { priceMin: money(product.priceMin) } : {}),
      ...(money(product?.priceMax) !== null ? { priceMax: money(product.priceMax) } : {}),
      ...(text(product?.priceCurrency, 10) ? { priceCurrency: text(product.priceCurrency, 10).toUpperCase() } : {}),
    },
    ...options,
  });
  return payload?.data ?? true;
}

async function saveCjStoreVariants(variants, options = {}) {
  if (!Array.isArray(variants) || !variants.length) return [];
  const payload = await requestCj("store/product/saveVariantBatch", {
    method: "POST",
    body: { variants },
    ...options,
  });
  return responseList(payload);
}

async function createCjProductConnection(connection, options = {}) {
  const config = connectionConfig(options.env || process.env);
  const body = {
    ...(text(connection?.shopId || config.shopId, 50) ? { shopId: text(connection?.shopId || config.shopId, 50) } : {}),
    defaultArea: Number(connection?.defaultArea ?? config.defaultArea),
    logistics: text(connection?.logistics || config.logistics, 200),
    cjProductId: text(connection?.cjProductId, 50),
    platformProductId: text(connection?.platformProductId, 100),
    ...(text(connection?.sourceCountryCode || config.sourceCountryCode, 20) ? { sourceCountryCode: text(connection?.sourceCountryCode || config.sourceCountryCode, 20).toUpperCase() } : {}),
    ...(text(connection?.sourceCountry || config.sourceCountry, 100) ? { sourceCountry: text(connection?.sourceCountry || config.sourceCountry, 100) } : {}),
    ...(text(connection?.targetCountryCode || config.targetCountryCode, 20) ? { targetCountryCode: text(connection?.targetCountryCode || config.targetCountryCode, 20).toUpperCase() } : {}),
    ...(text(connection?.targetCountry || config.targetCountry, 100) ? { targetCountry: text(connection?.targetCountry || config.targetCountry, 100) } : {}),
    variantList: Array.isArray(connection?.variantList) ? connection.variantList : [],
    ignoreCheckInventory: Number(connection?.ignoreCheckInventory ?? config.ignoreCheckInventory) === 1 ? 1 : 0,
  };
  const payload = await requestCj("product/conn/connection", { method: "POST", body, ...options });
  return payload?.data ?? true;
}

async function disconnectCjProductConnection({ shopId, platformProductId, platformVariantId } = {}, options = {}) {
  const config = connectionConfig(options.env || process.env);
  const query = {
    ...(text(shopId || config.shopId, 50) ? { shopId: text(shopId || config.shopId, 50) } : {}),
    platformProductId: text(platformProductId, 100),
    ...(text(platformVariantId, 100) ? { platformVariantId: text(platformVariantId, 100) } : {}),
  };
  return requestCj("product/conn/connection", { method: "DELETE", query, ...options });
}

function toStoreVariants(records, { platformProductId, fallbackImage, salePrice, currency = "USD", defaultPlatformVariantId = "" } = {}) {
  const normalizedProductId = text(platformProductId, 100);
  return records.map((record, index) => {
    const platformVariantId = index === 0 && defaultPlatformVariantId
      ? text(defaultPlatformVariantId, 100)
      : `${normalizedProductId}-${index + 1}`.slice(0, 100);
    const variantPrice = money(record.price, money(salePrice, 0));
    return {
      id: platformVariantId,
      productId: normalizedProductId,
      title: text(record.title || record.sku || `Variant ${index + 1}`, 500),
      sku: text(record.sku || `${normalizedProductId}-${index + 1}`, 200),
      image: text(record.image || fallbackImage, 500),
      ...(variantPrice !== null ? { shopPrice: variantPrice, shopPriceCurrency: text(currency, 10).toUpperCase() || "USD" } : {}),
      ...(record.weight !== null ? { weight: record.weight, weightUnit: record.weightUnit || "g" } : {}),
    };
  });
}

async function syncCjStoreProduct({
  cjProductId,
  platformProductId,
  title,
  image,
  description,
  salePrice,
  currency = "USD",
  raw,
  defaultPlatformVariantId,
} = {}, options = {}) {
  const env = options.env || process.env;
  const result = {
    enabled: storeSyncEnabled(env),
    status: "not_attempted",
    shopId: connectionConfig(env).shopId,
    storeProductSaved: false,
    connectionCreated: false,
    error: null,
    variantCount: 0,
  };

  if (!result.enabled) {
    result.status = "disabled";
    return result;
  }

  const normalizedCjProductId = extractCjProductId(raw, cjProductId);
  const normalizedPlatformProductId = text(platformProductId, 100);
  const normalizedImage = text(image, 500);
  if (!normalizedCjProductId || !normalizedPlatformProductId || !text(title, 500) || !normalizedImage) {
    result.status = "failed";
    result.error = "CJ store sync requires a CJ product ID, site product ID, title, and public image URL.";
    return result;
  }

  try {
    await saveCjStoreProduct({
      id: normalizedPlatformProductId,
      title,
      image: normalizedImage,
      description,
      priceMin: salePrice,
      priceMax: salePrice,
      priceCurrency: currency,
    }, { ...options, env });
    result.storeProductSaved = true;

    let records = extractCjVariantRecords(raw, normalizedImage);
    if (!records.length) {
      try {
        const variantPayload = await requestCj("product/variant/query", {
          query: { pid: normalizedCjProductId },
          ...options,
          env,
        });
        records = extractCjVariantRecords(variantPayload, normalizedImage);
      } catch (error) {
        // The store product is still useful in CJ even when variant discovery
        // is temporarily unavailable; the manual connection can be retried.
        result.error = String(error?.providerMessage || error?.message || "CJ variants could not be loaded").slice(0, 600);
      }
    }

    const storeVariants = toStoreVariants(records, {
      platformProductId: normalizedPlatformProductId,
      fallbackImage: normalizedImage,
      salePrice,
      currency,
      defaultPlatformVariantId,
    });
    result.variantCount = storeVariants.length;
    if (storeVariants.length) {
      await saveCjStoreVariants(storeVariants, { ...options, env });
    }

    if (!storeVariants.length) {
      result.status = "saved";
      result.error = result.error || "CJ saved the site product, but no CJ variant was found to connect.";
      return result;
    }

    const config = connectionConfig(env);
    result.shopId = config.shopId;
    await createCjProductConnection({
      shopId: config.shopId,
      defaultArea: config.defaultArea,
      logistics: config.logistics,
      cjProductId: normalizedCjProductId,
      platformProductId: normalizedPlatformProductId,
      sourceCountryCode: config.sourceCountryCode,
      sourceCountry: config.sourceCountry,
      targetCountryCode: config.targetCountryCode,
      targetCountry: config.targetCountry,
      ignoreCheckInventory: config.ignoreCheckInventory,
      variantList: records.map((record, index) => ({
        cjVariantId: record.cjVariantId,
        platformVariantId: storeVariants[index].id,
      })),
    }, { ...options, env });

    result.connectionCreated = true;
    result.status = "connected";
    result.error = null;
    return result;
  } catch (error) {
    result.status = result.storeProductSaved ? "saved" : "failed";
    result.error = String(error?.providerMessage || error?.message || "CJ store sync failed").slice(0, 600);
    if (error instanceof CjTrackingError) {
      result.code = error.code ?? null;
      result.requestId = error.requestId || null;
    }
    return result;
  }
}

module.exports = {
  connectionConfig,
  createCjProductConnection,
  disconnectCjProductConnection,
  extractCjProductId,
  extractCjVariantRecords,
  listCjShops,
  saveCjStoreProduct,
  saveCjStoreVariants,
  storeSyncEnabled,
  syncCjStoreProduct,
  toStoreVariants,
};
