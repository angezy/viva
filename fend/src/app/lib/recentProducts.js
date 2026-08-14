const STORAGE_KEY = "weluxo_recently_viewed_v1";
const MAX_RECENT_PRODUCTS = 8;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function productSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productKey(product = {}) {
  return String(product.id ?? product.PID ?? product.ProductId ?? product.productId ?? product.slug ?? product.Slug ?? product.name ?? product.Name ?? "");
}

export function getRecentlyViewed() {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.key && item.slug) : [];
  } catch (_error) {
    return [];
  }
}

export function rememberProduct(product = {}) {
  if (!canUseStorage()) return;
  const title = product.title || product.name || product.Name || product.productName || "";
  const slug = product.slug || product.Slug || product.handle || product.Handle || productSlug(title);
  const key = productKey({ ...product, slug });
  if (!key || !slug || !title) return;

  const entry = {
    key,
    slug: String(slug).replace(/^\/product\//, "").replace(/^\//, ""),
    title,
    category: product.category || product.Category || "Collection",
    image: product.image || product.img || product.Img || product.IMG || product.imageUrl || (Array.isArray(product.images) ? product.images[0] : "") || "",
    price: Number(product.price ?? product.Price ?? 0) || 0,
    viewedAt: Date.now(),
  };
  const existing = getRecentlyViewed().filter((item) => item.key !== key);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_RECENT_PRODUCTS)));
  window.dispatchEvent(new CustomEvent("weluxo:recent-products-updated"));
}
