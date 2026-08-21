import blogContent from "../../data/blog.json";
import { getSiteSettingsServer, siteUrlFor } from "./lib/siteSettingsServer";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pathSlug(value, prefix) {
  return slugify(String(value || "").replace(new RegExp(`^/?${prefix}/`, "i"), ""));
}

function productSlug(product = {}) {
  return pathSlug(product.slug || product.Slug || product.handle || product.Handle || product.name || product.Name || product.title, "product");
}

async function loadCatalog() {
  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!backendUrl) return [];

  try {
    const response = await fetch(`${backendUrl}/api/shop`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (_error) {
    return [];
  }
}

export default async function sitemap() {
  const now = new Date();
  const site = await getSiteSettingsServer();
  const siteUrl = siteUrlFor(site);
  const catalog = await loadCatalog();
  const products = catalog
    .map((product) => productSlug(product))
    .filter(Boolean);
  const categories = [...new Set(catalog.map((product) => slugify(product.category || product.Category)).filter(Boolean))];
  const posts = Array.isArray(blogContent?.posts)
    ? blogContent.posts.map((post) => pathSlug(post.slug || post.Slug || post.title, "blog")).filter(Boolean)
    : [];

  const staticPages = [
    "",
    "/shop",
    "/aboutus",
    "/contact",
    "/blog",
    "/faq",
    "/help-center",
    "/how-it-works",
    "/why-weluxo",
    "/privacy-policy",
    "/terms-conditions",
    "/shipping-policy",
    "/return-refund-policy",
    "/payment-security",
    "/order-confirmation",
  ];

  return [
    ...staticPages.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: path === "" || path === "/shop" || path === "/blog" ? "daily" : "monthly",
      priority: path === "" ? 1 : path === "/shop" ? 0.9 : 0.7,
    })),
    ...categories.map((category) => ({
      url: `${siteUrl}/category/${encodeURIComponent(category)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...products.map((slug) => ({
      url: `${siteUrl}/product/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...posts.map((slug) => ({
      url: `${siteUrl}/blog/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    })),
  ];
}
