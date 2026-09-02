export function hideSupplierBranding(value, fallback = "") {
  const cleaned = String(value ?? "")
    .replace(/\bcj\s*dropshipping\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || fallback;
}
