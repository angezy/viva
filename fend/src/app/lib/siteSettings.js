export const SITE_FONT_OPTIONS = [
  { value: "system", label: "System UI", stack: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
  { value: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { value: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { value: "trebuchet", label: "Trebuchet MS", stack: "\"Trebuchet MS\", Arial, sans-serif" },
  { value: "georgia", label: "Georgia", stack: "Georgia, \"Times New Roman\", serif" },
  { value: "times", label: "Times New Roman", stack: "\"Times New Roman\", Times, serif" },
  { value: "courier", label: "Courier New", stack: "\"Courier New\", Courier, monospace" },
  { value: "custom", label: "Custom font", stack: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" },
];

export const SITE_FONT_FORMAT_OPTIONS = [
  { value: "woff2", label: "WOFF2" },
  { value: "woff", label: "WOFF" },
  { value: "ttf", label: "TrueType (TTF)" },
  { value: "otf", label: "OpenType (OTF)" },
];

export const DEFAULT_SITE_SETTINGS = {
  siteName: "Weluxo",
  siteDescription: "Weluxo Shop - Your partner in performance.",
  siteTagline: "Move with intent",
  siteUrl: "https://weluxo.com",
  siteKeywords: "online shop, lifestyle products, performance gear",
  siteLogoUrl: "",
  siteFaviconUrl: "",
  siteOgImageUrl: "",
  fontFamily: "system",
  customFontName: "",
  customFontUrl: "",
  customFontFormat: "woff2",
  primaryColor: "#2563eb",
  primaryDarkColor: "#1746b2",
  linkHoverColor: "#1746b2",
  primaryLightColor: "#5b8def",
  primarySoftColor: "#eef4ff",
  accentColor: "#f28c28",
  accentDarkColor: "#c96a0e",
  accentLightColor: "#ffb15a",
  accentSoftColor: "#fff4e5",
  backgroundColor: "#fbf4e8",
  surfaceColor: "#ffffff",
  surfaceMutedColor: "#fffaf2",
  borderColor: "#e7dfd3",
  textPrimaryColor: "#2b2b2b",
  textSecondaryColor: "#62656b",
  successColor: "#2e8b57",
  warningColor: "#f28c28",
  errorColor: "#c94a4a",
  supportEmail: "support@weluxo.com",
  supportPhone: "",
  supportHours: "Support available within 24-48 hours",
};

export function isValidCustomFontName(value) {
  return /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(String(value || "").trim());
}

export function isValidCustomFontUrl(value) {
  return /^(?:https?:\/\/|\/uploads\/fonts\/)[^\s"'<>]+$/i.test(String(value || "").trim());
}

export function getSiteFontFamily(value, customFontName = "") {
  if (value === "custom" && isValidCustomFontName(customFontName)) {
    return `${JSON.stringify(String(customFontName).trim())}, ${SITE_FONT_OPTIONS[0].stack}`;
  }
  return SITE_FONT_OPTIONS.find((option) => option.value === value)?.stack || SITE_FONT_OPTIONS[0].stack;
}

export function getSiteCustomFontFace(siteSettings = {}) {
  if (
    siteSettings.fontFamily !== "custom" ||
    !isValidCustomFontName(siteSettings.customFontName) ||
    !isValidCustomFontUrl(siteSettings.customFontUrl)
  ) return "";

  const format = SITE_FONT_FORMAT_OPTIONS.some((option) => option.value === siteSettings.customFontFormat)
    ? siteSettings.customFontFormat
    : SITE_FONT_FORMAT_OPTIONS[0].value;
  return `@font-face{font-family:${JSON.stringify(String(siteSettings.customFontName).trim())};src:url(${JSON.stringify(String(siteSettings.customFontUrl).trim())}) format(\"${format}\");font-display:swap;}`;
}

export function normalizeSiteSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const colors = [
    "primaryColor", "primaryDarkColor", "linkHoverColor", "primaryLightColor", "primarySoftColor",
    "accentColor", "accentDarkColor", "accentLightColor", "accentSoftColor",
    "backgroundColor", "surfaceColor", "surfaceMutedColor", "borderColor",
    "textPrimaryColor", "textSecondaryColor", "successColor", "warningColor", "errorColor",
  ];
  const safeColors = colors.reduce((result, key) => {
    const candidate = String(source[key] || "").trim();
    result[key] = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(candidate) ? candidate : DEFAULT_SITE_SETTINGS[key];
    return result;
  }, {});
  const fontFamily = SITE_FONT_OPTIONS.some((option) => option.value === source.fontFamily)
    ? source.fontFamily
    : DEFAULT_SITE_SETTINGS.fontFamily;
  const customFontName = isValidCustomFontName(source.customFontName) ? String(source.customFontName).trim() : "";
  const customFontUrl = isValidCustomFontUrl(source.customFontUrl) ? String(source.customFontUrl).trim() : "";
  const customFontFormat = SITE_FONT_FORMAT_OPTIONS.some((option) => option.value === source.customFontFormat)
    ? source.customFontFormat
    : DEFAULT_SITE_SETTINGS.customFontFormat;
  return { ...DEFAULT_SITE_SETTINGS, ...source, fontFamily, customFontName, customFontUrl, customFontFormat, ...safeColors };
}

export async function fetchSiteSettings() {
  const response = await fetch("/api/site-settings", { cache: "no-store" });
  if (!response.ok) throw new Error(`Site settings request failed (${response.status})`);
  return normalizeSiteSettings(await response.json());
}
