const sanitizeHtml = require("sanitize-html");

const MAX_CJ_IMAGE_URLS = 100;
const MAX_CJ_IMAGE_URL_LENGTH = 500;
const IMAGE_FIELDS = [
  "url", "imageUrl", "src", "path", "bigImage", "mainImage", "cover", "image", "img",
  "productImage", "images", "imageList", "productImages", "productImageList", "detailImages",
  "detailImageList", "variantImage", "variantImageUrl", "variantList", "variants",
];

function normalizeCjImageUrl(value) {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (!input || input.length > MAX_CJ_IMAGE_URL_LENGTH) return "";

  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch (_error) {
    return "";
  }
}

function extractCjImageUrls(value, limit = MAX_CJ_IMAGE_URLS) {
  const images = [];
  const seen = new Set();
  const max = Math.max(1, Math.min(Number(limit) || MAX_CJ_IMAGE_URLS, MAX_CJ_IMAGE_URLS));

  function add(value) {
    if (images.length >= max) return;
    const url = normalizeCjImageUrl(value);
    if (url && !seen.has(url)) {
      seen.add(url);
      images.push(url);
    }
  }

  function visit(item, depth = 0) {
    if (images.length >= max || item === null || item === undefined || depth > 5) return;
    if (typeof item === "string") {
      const sourceRegex = /<img\b[^>]*\bsrc\s*=\s*(?:["']([^"']+)["']|([^\s>]+))/gi;
      let match;
      while ((match = sourceRegex.exec(item)) !== null) add(match[1] || match[2]);

      add(item);
      item.split(/[|,\n]/).forEach(add);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    if (typeof item === "object") {
      IMAGE_FIELDS.forEach((field) => visit(item[field], depth + 1));
    }
  }

  visit(value);
  return images;
}

function sanitizeCjDescription(value) {
  if (value === null || value === undefined) return "";
  const withLineBreaks = String(value)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/(?:p|div|li|h[1-6]|tr|table|ul|ol)\s*>/gi, "\n")
    .replace(/<\s*(?:p|div|li|h[1-6]|tr|table|ul|ol)\b[^>]*>/gi, "\n");
  const text = sanitizeHtml(withLineBreaks, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ["script", "style", "textarea", "option"],
  });

  return text
    .replace(/\u00a0/g, " ")
    .replace(/\bcj\s*dropshipping\b/gi, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/^\s*(?:product\s+)?images?\s*:\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = { extractCjImageUrls, sanitizeCjDescription };
