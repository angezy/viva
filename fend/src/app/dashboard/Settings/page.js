"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  CUSTOM_FONT_VALUE,
  CUSTOM_FONT_OPTION_PREFIX,
  getSiteFontFamily,
  isValidCustomFontName,
  isValidCustomFontUrl,
  normalizeSiteSettings,
  SITE_FONT_FORMAT_OPTIONS,
  SITE_FONT_OPTIONS,
} from "../../lib/siteSettings";
import { useSiteSettings } from "../../components/SiteThemeProvider";

function normalizeHexColor(value) {
  const candidate = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return `#${candidate.slice(1).split("").map((digit) => `${digit}${digit}`).join("")}`;
  }
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "";
}

const COLOR_RECOMMENDATIONS = [
  { label: "Sunset", value: "#FF6B35" },
  { label: "Forest", value: "#287A65" },
  { label: "Ocean", value: "#315C78" },
  { label: "Gold", value: "#F28C28" },
  { label: "Rose", value: "#C94A4A" },
  { label: "Slate", value: "#475569" },
];

function getColorRecommendations(value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query || query === "#") return COLOR_RECOMMENDATIONS;

  const matches = COLOR_RECOMMENDATIONS.filter((recommendation) => (
    recommendation.value.toLowerCase().startsWith(query)
    || recommendation.label.toLowerCase().includes(query.replace(/^#/, ""))
  ));
  return matches.length ? matches : COLOR_RECOMMENDATIONS;
}

function getFontOptions(siteSettings) {
  const customFonts = Array.isArray(siteSettings?.customFonts) ? siteSettings.customFonts : [];
  const customOptions = customFonts.map((font) => ({
    value: `${CUSTOM_FONT_OPTION_PREFIX}${font.id}`,
    label: `${font.name} · imported`,
    stack: getSiteFontFamily(CUSTOM_FONT_VALUE, font.name),
  }));
  const activeCustomId = String(siteSettings?.customFontId || "").trim();

  // Keep legacy/incomplete custom settings selectable while they are being
  // repaired or saved. MUI warns when a controlled Select value has no item.
  if (siteSettings?.fontFamily === CUSTOM_FONT_VALUE) {
    if (activeCustomId && !customOptions.some((option) => option.value === `${CUSTOM_FONT_OPTION_PREFIX}${activeCustomId}`)) {
      customOptions.push({
        value: `${CUSTOM_FONT_OPTION_PREFIX}${activeCustomId}`,
        label: `${siteSettings.customFontName || "Custom font"} · active`,
        stack: getSiteFontFamily(CUSTOM_FONT_VALUE, siteSettings.customFontName),
      });
    } else if (!activeCustomId) {
      customOptions.push({
        value: CUSTOM_FONT_VALUE,
        label: `${siteSettings.customFontName || "Custom font"} · active`,
        stack: getSiteFontFamily(CUSTOM_FONT_VALUE, siteSettings.customFontName),
      });
    }
  }

  return [
    ...SITE_FONT_OPTIONS,
    ...customOptions,
  ];
}

const FIELD_GROUPS = [
  {
    title: "Brand identity",
    description: "These values appear in the public header, footer, dashboard, and customer-facing shell.",
    fields: [
      { key: "siteName", label: "Site name", required: true },
      { key: "siteTagline", label: "Tagline" },
      { key: "siteDescription", label: "Site description", multiline: true, minRows: 3, required: true },
      { key: "siteLogoUrl", label: "Logo URL", placeholder: "https://example.com/logo.svg" },
      { key: "siteFaviconUrl", label: "Favicon URL", placeholder: "https://example.com/favicon.ico" },
    ],
  },
  {
    title: "Complete site colors",
    description: "Edit every shared storefront color. Each field accepts a picker or a #RRGGBB / #RGB hex code.",
    fields: [
      { key: "primaryColor", label: "Primary", type: "color", helperText: "Main buttons and links" },
      { key: "primaryDarkColor", label: "Primary dark", type: "color", helperText: "Hover and active states" },
      { key: "linkHoverColor", label: "Link hover", type: "color", helperText: "Header and text link hover states" },
      { key: "primaryLightColor", label: "Primary light", type: "color", helperText: "Soft highlights" },
      { key: "primarySoftColor", label: "Primary soft", type: "color", helperText: "Selected backgrounds" },
      { key: "accentColor", label: "Accent", type: "color", helperText: "Secondary actions" },
      { key: "accentDarkColor", label: "Accent dark", type: "color", helperText: "Accent hover states" },
      { key: "accentLightColor", label: "Accent light", type: "color", helperText: "Accent highlights" },
      { key: "accentSoftColor", label: "Accent soft", type: "color", helperText: "Accent backgrounds" },
      { key: "backgroundColor", label: "Page background", type: "color", helperText: "Main site background" },
      { key: "surfaceColor", label: "Surface", type: "color", helperText: "Cards and panels" },
      { key: "surfaceMutedColor", label: "Muted surface", type: "color", helperText: "Search and subtle panels" },
      { key: "borderColor", label: "Borders", type: "color", helperText: "Dividers and outlines" },
      { key: "textPrimaryColor", label: "Primary text", type: "color", helperText: "Headings and main text" },
      { key: "textSecondaryColor", label: "Secondary text", type: "color", helperText: "Labels and supporting text" },
      { key: "successColor", label: "Success", type: "color", helperText: "Success messages" },
      { key: "warningColor", label: "Warning", type: "color", helperText: "Warning messages" },
      { key: "errorColor", label: "Error", type: "color", helperText: "Error messages" },
    ],
  },
  {
    title: "Typography",
    description: "Choose a preset or upload a font for the storefront, account pages, and dashboard. Variable WOFF2/TTF files downloaded from Google Fonts are supported.",
    fields: [
      { key: "fontFamily", label: "Site font", type: "select", options: SITE_FONT_OPTIONS, helperText: "Custom fonts are managed with the button below." },
    ],
  },
  {
    title: "SEO and sharing",
    description: "Used for browser metadata, search previews, social sharing, and canonical links.",
    fields: [
      { key: "siteUrl", label: "Canonical site URL", required: true, placeholder: "https://example.com" },
      { key: "siteKeywords", label: "SEO keywords", multiline: true, minRows: 2, helperText: "Separate keywords with commas." },
      { key: "siteOgImageUrl", label: "Social preview image URL", placeholder: "https://example.com/social-card.jpg" },
    ],
  },
  {
    title: "Customer contact",
    description: "Shown in support and contact experiences when those pages do not provide their own value.",
    fields: [
      { key: "supportEmail", label: "Support email", type: "email" },
      { key: "supportPhone", label: "Support phone" },
      { key: "supportHours", label: "Support hours" },
    ],
  },
  {
    title: "First-visit welcome offer",
    description: "Edit the optional popup shown once to new visitors. Configure a coupon first, then enable the offer.",
    fields: [
      { key: "welcomePopupEnabled", label: "Show welcome popup", type: "toggle", helperText: "Turn the first-visit offer on or off." },
      { key: "welcomePopupEyebrow", label: "Eyebrow" },
      { key: "welcomePopupTitle", label: "Offer title", fullWidth: true, required: true },
      { key: "welcomePopupDescription", label: "Offer description", multiline: true, minRows: 2, fullWidth: true, required: true },
      { key: "welcomePopupButtonLabel", label: "Button label" },
      { key: "welcomePopupCouponCode", label: "Coupon code", helperText: "Use a code that exists in Dashboard → Coupons." },
      { key: "welcomePopupFinePrint", label: "Fine print", fullWidth: true },
    ],
  },
];

export default function SiteSettingsPage() {
  const siteSettings = useSiteSettings();
  const [form, setForm] = useState(siteSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [uploadingFont, setUploadingFont] = useState(false);
  const [customFontDialogOpen, setCustomFontDialogOpen] = useState(false);
  const customFontInputRef = useRef(null);
  const [customFontDraft, setCustomFontDraft] = useState({
    name: "",
    url: "",
    format: "woff2",
    variable: false,
    id: "",
    fileName: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeColorField, setActiveColorField] = useState(null);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
    let active = true;
    fetch("/api/dashboard/settings", { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.error || "Unable to load settings"))))
      .then((data) => active && setForm((current) => normalizeSiteSettings({ ...current, ...(data.site || {}) })))
      .catch((loadError) => active && setError(loadError.message || "Unable to load settings"))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const updateField = (key, value) => {
    // Keep the color draft exactly as entered. Expanding #RGB while the user is
    // typing makes the controlled input jump and prevents deleting/editing it.
    const draftValue = key.endsWith("Color") ? String(value) : value;
    const normalizedValue = key.endsWith("Color") ? normalizeHexColor(draftValue) : draftValue;
    setForm((current) => ({ ...current, [key]: draftValue }));
    if (typeof window !== "undefined" && (key === "fontFamily" || key.startsWith("customFont") || (key.endsWith("Color") && normalizedValue))) {
      window.dispatchEvent(new CustomEvent("site-settings-updated", {
        detail: { [key]: normalizedValue },
      }));
    }
    setMessage("");
    setError("");
  };

  const openCustomFontDialog = () => {
    setCustomFontDraft({
      name: form.customFontName || "",
      url: form.customFontUrl || "",
      format: form.customFontFormat || "woff2",
      variable: form.customFontVariable === true,
      id: form.customFontId || "",
      fileName: form.customFontUrl?.split("/").pop() || "",
    });
    setCustomFontDialogOpen(true);
    setMessage("");
    setError("");
  };

  const closeCustomFontDialog = () => {
    if (uploadingFont) return;
    setCustomFontDialogOpen(false);
  };

  const updateCustomFontDraft = (key, value) => {
    setCustomFontDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const uploadFont = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingFont(true);
    setMessage("");
    setError("");
    try {
      const payload = new FormData();
      payload.append("font", file);
      const response = await fetch("/api/dashboard/settings/font-upload", {
        method: "POST",
        credentials: "include",
        body: payload,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to upload font");

      setCustomFontDraft((current) => ({
        ...current,
        url: body.url,
        format: body.format,
        variable: body.variable === true,
        id: body.id || current.id,
        fileName: body.name || file.name,
      }));
      setMessage("Font uploaded. Add a name, then apply it to the site.");
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload font");
    } finally {
      setUploadingFont(false);
    }
  };

  const applyCustomFont = () => {
    const name = String(customFontDraft.name || "").trim();
    const url = String(customFontDraft.url || "").trim();
    if (!isValidCustomFontName(name)) {
      setError("Enter a font name beginning with a letter. Use letters, numbers, spaces, hyphens, or underscores.");
      return;
    }
    if (!isValidCustomFontUrl(url)) {
      setError("Choose a font file or enter a valid HTTPS/custom font URL before applying it.");
      return;
    }

    const fontId = customFontDraft.id || `font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const importedFont = {
      id: fontId,
      name,
      url,
      format: customFontDraft.format,
      variable: customFontDraft.variable === true,
    };
    const existingFonts = Array.isArray(form.customFonts) ? form.customFonts : [];
    const customFonts = existingFonts.some((font) => font.id === fontId)
      ? existingFonts.map((font) => font.id === fontId ? importedFont : font)
      : [...existingFonts, importedFont];
    const nextValues = {
      fontFamily: CUSTOM_FONT_VALUE,
      customFontName: name,
      customFontUrl: url,
      customFontFormat: customFontDraft.format,
      customFontVariable: customFontDraft.variable === true,
      customFontId: fontId,
      customFonts,
    };
    setForm((current) => ({ ...current, ...nextValues }));
    window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: nextValues }));
    setCustomFontDialogOpen(false);
    setMessage(`${name} is ready. Save site settings to publish the font.`);
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.siteName.trim() || !form.siteDescription.trim() || !form.siteUrl.trim()) {
      setError("Site name, site description, and canonical site URL are required.");
      return;
    }
    const colorFields = [
      "primaryColor", "primaryDarkColor", "primaryLightColor", "primarySoftColor",
      "linkHoverColor",
      "accentColor", "accentDarkColor", "accentLightColor", "accentSoftColor",
      "backgroundColor", "surfaceColor", "surfaceMutedColor", "borderColor",
      "textPrimaryColor", "textSecondaryColor", "successColor", "warningColor", "errorColor",
    ];
    const invalidColor = colorFields.find((key) => !normalizeHexColor(form[key]));
    if (invalidColor) {
      setError(`${invalidColor} must be a hex color such as #FF6B35.`);
      return;
    }
    if (form.fontFamily === CUSTOM_FONT_VALUE) {
      if (!isValidCustomFontName(form.customFontName)) {
        setError("Enter a valid custom font name before saving.");
        return;
      }
      if (!isValidCustomFontUrl(form.customFontUrl)) {
        setError("Upload a font file or enter a valid HTTPS/custom font URL before saving.");
        return;
      }
    }

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/dashboard/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: form }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save site settings");
      if (body.site) setForm((current) => normalizeSiteSettings({ ...current, ...body.site }));
      if (body.site && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: body.site }));
      }
      setMessage("Site settings saved. The selected font is now applied across the site.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save site settings");
    } finally {
      setSaving(false);
    }
  };

  const selectFont = (value) => {
    if (!value.startsWith(CUSTOM_FONT_OPTION_PREFIX)) {
      updateField("fontFamily", value);
      return;
    }
    const fontId = value.slice(CUSTOM_FONT_OPTION_PREFIX.length);
    const selectedFont = (Array.isArray(form.customFonts) ? form.customFonts : []).find((font) => font.id === fontId);
    if (!selectedFont) return;
    const nextValues = {
      fontFamily: CUSTOM_FONT_VALUE,
      customFontId: selectedFont.id,
      customFontName: selectedFont.name,
      customFontUrl: selectedFont.url,
      customFontFormat: selectedFont.format,
      customFontVariable: selectedFont.variable === true,
    };
    setForm((current) => ({ ...current, ...nextValues }));
    window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: nextValues }));
    setMessage("");
    setError("");
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: "var(--color-primary)", fontWeight: 850, letterSpacing: "0.14em" }}>Store configuration</Typography>
        <Typography component="h1" sx={{ mt: 0.5, color: "#0f172a", fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: "-0.04em" }}>Site identity &amp; SEO</Typography>
        <Typography sx={{ mt: 0.75, color: "#64748b", maxWidth: 720 }}>Change the store name, font, colors, SEO defaults, logo, and support details from one place. These settings are shared by the public storefront and dashboard.</Typography>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5} component="form" onSubmit={save}>
        <Grid
          size={{
            xs: 12,
            lg: 8
          }}>
          <Stack spacing={2.5}>
            {FIELD_GROUPS.map((group) => (
              <Card key={group.title} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 8px 25px rgba(15,23,42,0.05)" }}>
                <CardContent sx={{ p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}>
                  <Typography sx={{ color: "#0f172a", fontSize: 19, fontWeight: 850 }}>{group.title}</Typography>
                  <Typography sx={{ mt: 0.5, mb: 2.5, color: "#64748b", fontSize: 13 }}>{group.description}</Typography>
                  <Grid container spacing={2}>
                    {group.fields.map((field) => (
                      <Grid
                        key={field.key}
                        size={{
                          xs: 12,
                          sm: field.fullWidth || field.key === "siteDescription" || field.key === "siteKeywords" ? 12 : 6
                        }}>
                        {field.type === "color" ? (
                          <Stack direction="row" spacing={1} alignItems="flex-start">
                            <TextField
                              type="color"
                              label={field.label}
                              value={normalizeHexColor(form[field.key]) || "#000000"}
                              onChange={(event) => updateField(field.key, event.target.value)}
                              disabled={hydrated && (loading || saving)}
                              InputLabelProps={{ shrink: true }}
                              sx={{ width: 78, flexShrink: 0, "& input": { height: 40, p: 0.5, cursor: "pointer" } }}
                              size="small"
                            />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <TextField
                                fullWidth
                                label={`${field.label} hex code`}
                                value={form[field.key] || ""}
                                onFocus={() => setActiveColorField(field.key)}
                                onChange={(event) => updateField(field.key, event.target.value)}
                                placeholder="#FF6B35"
                                helperText={field.helperText || "Use #RRGGBB"}
                                error={Boolean(form[field.key]) && !normalizeHexColor(form[field.key])}
                                disabled={hydrated && (loading || saving)}
                                inputProps={{ maxLength: 7, spellCheck: false }}
                                size="small"
                              />
                              {activeColorField === field.key && (
                                <Box sx={{ mt: 0.75 }}>
                                  <Typography sx={{ mb: 0.5, color: "#64748b", fontSize: 11, fontWeight: 700 }}>
                                    Recommended colors
                                  </Typography>
                                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                    {getColorRecommendations(form[field.key]).map((recommendation) => (
                                      <Box
                                        key={recommendation.value}
                                        component="button"
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => updateField(field.key, recommendation.value)}
                                        aria-label={`Use ${recommendation.label} ${recommendation.value}`}
                                        sx={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                          px: 0.75,
                                          py: 0.35,
                                          border: "1px solid #e2e8f0",
                                          borderRadius: 999,
                                          backgroundColor: "#ffffff",
                                          color: "#475569",
                                          cursor: "pointer",
                                          font: "inherit",
                                          fontSize: 11,
                                          "&:hover": { borderColor: recommendation.value, backgroundColor: "#f8fafc" },
                                        }}
                                      >
                                        <Box sx={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: recommendation.value, border: "1px solid rgba(15,23,42,0.15)" }} />
                                        {recommendation.label}
                                      </Box>
                                    ))}
                                  </Stack>
                                </Box>
                              )}
                            </Box>
                          </Stack>
                        ) : field.type === "select" ? (
                          <TextField
                            fullWidth
                            select
                            label={field.label}
                            value={field.key === "fontFamily" && form.fontFamily === CUSTOM_FONT_VALUE && form.customFontId
                              ? `${CUSTOM_FONT_OPTION_PREFIX}${form.customFontId}`
                              : (form[field.key] || "")}
                            onChange={(event) => field.key === "fontFamily" ? selectFont(event.target.value) : updateField(field.key, event.target.value)}
                            helperText={field.helperText}
                            disabled={hydrated && (loading || saving)}
                            size="small"
                          >
                            {(field.key === "fontFamily" ? getFontOptions(form) : (field.options || SITE_FONT_OPTIONS)).map((option) => (
                              <MenuItem key={option.value} value={option.value} sx={option.stack ? { fontFamily: option.stack } : undefined}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : field.type === "toggle" ? (
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 40 }}>
                            <Switch
                              checked={Boolean(form[field.key])}
                              onChange={(event) => updateField(field.key, event.target.checked)}
                              disabled={hydrated && (loading || saving)}
                              color="primary"
                            />
                            <Box>
                              <Typography sx={{ color: "#0f172a", fontWeight: 750, fontSize: 14 }}>{field.label}</Typography>
                              {field.helperText && <Typography sx={{ color: "#64748b", fontSize: 12 }}>{field.helperText}</Typography>}
                            </Box>
                          </Stack>
                        ) : (
                          <TextField
                            fullWidth
                            label={field.label}
                            value={form[field.key] || ""}
                            onChange={(event) => updateField(field.key, event.target.value)}
                            required={field.required}
                            type={field.type || "text"}
                            multiline={field.multiline}
                            minRows={field.minRows}
                            placeholder={field.placeholder}
                            helperText={field.helperText}
                            disabled={hydrated && (loading || saving)}
                            size="small"
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                  {group.title === "Typography" && (
                    <Stack spacing={0.75} sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #e2e8f0" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
                        <Box>
                          <Typography sx={{ color: "#0f172a", fontSize: 14, fontWeight: 800 }}>
                            {form.fontFamily === CUSTOM_FONT_VALUE ? "Custom font active" : "Add a custom font"}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontSize: 12 }}>
                            {form.fontFamily === CUSTOM_FONT_VALUE
                              ? `${form.customFontName || "Unnamed font"}${form.customFontVariable ? " · variable" : ""}`
                              : "Upload a font file in a popup. It will not appear in the preset list."}
                          </Typography>
                        </Box>
                        {form.fontFamily === CUSTOM_FONT_VALUE && form.customFontVariable && <Chip size="small" label="Variable" color="primary" variant="outlined" />}
                      </Stack>
                      <Button
                        type="button"
                        variant="outlined"
                        startIcon={form.fontFamily === CUSTOM_FONT_VALUE ? <EditOutlinedIcon /> : <CloudUploadOutlinedIcon />}
                        onClick={openCustomFontDialog}
                        disabled={hydrated && (loading || saving)}
                        sx={{ alignSelf: "flex-start", mt: 0.5, borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                      >
                        {form.fontFamily === CUSTOM_FONT_VALUE ? "Edit custom font" : "Upload custom font"}
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>

        <Grid
          size={{
            xs: 12,
            lg: 4
          }}>
          <Card sx={{ position: { lg: "sticky" }, top: { lg: 84 }, borderRadius: 3, bgcolor: "#ffffff", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", boxShadow: "0 12px 35px rgba(43,43,43,0.08)" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography sx={{ color: "var(--color-accent)", fontSize: 11, fontWeight: 850, letterSpacing: "0.14em", textTransform: "uppercase" }}>Live preview</Typography>
              <Typography sx={{ mt: 1.5, fontSize: 30, fontWeight: 950, letterSpacing: "-0.05em", color: form.primaryColor, fontFamily: getSiteFontFamily(form.fontFamily, form.customFontName) }}>{form.siteName || "Your site name"}</Typography>
              <Typography sx={{ mt: 1, color: "var(--color-text-secondary)", lineHeight: 1.7, fontFamily: getSiteFontFamily(form.fontFamily, form.customFontName) }}>{form.siteDescription || "Your site description will appear here."}</Typography>
              <Divider sx={{ my: 2.5, borderColor: form.backgroundColor }} />
              <Typography sx={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Browser title</Typography>
              <Typography sx={{ mt: 0.4, fontWeight: 800 }}>{form.siteName || "Your site name"}</Typography>
              <Typography sx={{ mt: 2, fontSize: 12, color: "var(--color-text-secondary)" }}>Tagline</Typography>
              <Typography sx={{ mt: 0.4, fontWeight: 800 }}>{form.siteTagline || "Your tagline"}</Typography>
              <Button type="submit" fullWidth variant="contained" startIcon={<SaveOutlinedIcon />} disabled={hydrated && (loading || saving)} sx={{ mt: 3, bgcolor: form.primaryColor, color: "#ffffff", borderRadius: 999, py: 1.15, textTransform: "none", fontWeight: 900, "&:hover": { bgcolor: form.primaryColor } }}>
                {saving ? "Saving..." : "Save site settings"}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={customFontDialogOpen} onClose={closeCustomFontDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 6, color: "#0f172a", fontWeight: 850 }}>
          Upload a custom font
          <IconButton aria-label="Close custom font dialog" onClick={closeCustomFontDialog} disabled={uploadingFont} sx={{ position: "absolute", top: 10, right: 12 }}>
            <CloseOutlinedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {message && <Alert severity="success">{message}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            <Typography sx={{ color: "#64748b", fontSize: 13 }}>
              Upload a WOFF2, WOFF, TTF, or OTF file. Google Fonts variable downloads work when you mark the file as variable.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              required
              label="Font family name"
              value={customFontDraft.name}
              onChange={(event) => updateCustomFontDraft("name", event.target.value)}
              placeholder="Acme Sans"
              helperText="Letters, numbers, spaces, hyphens, and underscores only."
              disabled={uploadingFont}
            />
            <Box sx={{ p: 1.5, border: "1px dashed #cbd5e1", borderRadius: 2, bgcolor: "#f8fafc" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: "#0f172a", fontSize: 13, fontWeight: 800 }}>Font file</Typography>
                  <Typography sx={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {customFontDraft.fileName || "No file uploaded yet"}
                  </Typography>
                </Box>
                <Button type="button" variant="contained" startIcon={<CloudUploadOutlinedIcon />} onClick={() => customFontInputRef.current?.click()} disabled={uploadingFont} sx={{ flexShrink: 0, textTransform: "none", fontWeight: 800 }}>
                  {uploadingFont ? "Uploading..." : "Choose file"}
                </Button>
                <input ref={customFontInputRef} hidden type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={uploadFont} />
              </Stack>
            </Box>
            <FormControlLabel
              control={<Checkbox checked={customFontDraft.variable} onChange={(event) => updateCustomFontDraft("variable", event.target.checked)} disabled={uploadingFont} />}
              label={<Box><Typography sx={{ color: "#0f172a", fontSize: 13, fontWeight: 750 }}>This is a variable font</Typography><Typography sx={{ color: "#64748b", fontSize: 12 }}>Enable this for variable fonts downloaded from Google Fonts so all weight values use the font’s axis.</Typography></Box>}
              sx={{ alignItems: "flex-start", ml: 0, mr: 0 }}
            />
            <Divider />
            <Typography sx={{ color: "#64748b", fontSize: 12, fontWeight: 750 }}>Or use an already hosted font file</Typography>
            <TextField
              fullWidth
              label="Font file URL"
              value={customFontDraft.url}
              onChange={(event) => updateCustomFontDraft("url", event.target.value)}
              placeholder="/uploads/fonts/acme-sans.woff2"
              helperText="Use an uploaded file or an HTTPS URL with CORS enabled."
              disabled={uploadingFont}
            />
            <TextField
              select
              fullWidth
              label="Font format"
              value={customFontDraft.format}
              onChange={(event) => updateCustomFontDraft("format", event.target.value)}
              helperText="Choose the format that matches the URL."
              disabled={uploadingFont}
            >
              {SITE_FONT_FORMAT_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeCustomFontDialog} disabled={uploadingFont} sx={{ textTransform: "none", fontWeight: 750 }}>Cancel</Button>
          <Button onClick={applyCustomFont} variant="contained" disabled={uploadingFont} sx={{ textTransform: "none", fontWeight: 800 }}>Use this font</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
