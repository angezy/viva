"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import {
  DEFAULT_SITE_SETTINGS,
  getSiteFontFamily,
  isValidCustomFontName,
  isValidCustomFontUrl,
  SITE_FONT_FORMAT_OPTIONS,
  SITE_FONT_OPTIONS,
} from "../../lib/siteSettings";

function normalizeHexColor(value) {
  const candidate = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return `#${candidate.slice(1).split("").map((digit) => `${digit}${digit}`).join("")}`;
  }
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "";
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
    description: "Choose a preset or add your own WOFF2, WOFF, TTF, or OTF font for the storefront, account pages, and dashboard.",
    fields: [
      { key: "fontFamily", label: "Site font", type: "select", options: SITE_FONT_OPTIONS, helperText: "Choose Custom font below to use an uploaded or hosted font." },
      { key: "customFontName", label: "Custom font name", customOnly: true, placeholder: "Acme Sans", helperText: "Letters, numbers, spaces, hyphens, and underscores only." },
      { key: "customFontUrl", label: "Custom font file URL", customOnly: true, fullWidth: true, placeholder: "/uploads/fonts/acme-sans.woff2", helperText: "Upload a font below or use an HTTPS URL with CORS enabled." },
      { key: "customFontFormat", label: "Font format", type: "select", options: SITE_FONT_FORMAT_OPTIONS, customOnly: true, helperText: "Use the format that matches the uploaded file." },
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
    description: "Edit the popup shown once to new visitors. The discount code is already available in checkout when WELCOME10 is selected.",
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
  const [form, setForm] = useState(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [uploadingFont, setUploadingFont] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setHydrated(true);
    let active = true;
    fetch("/api/dashboard/settings", { credentials: "include", cache: "no-store" })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.error || "Unable to load settings"))))
      .then((data) => active && setForm({ ...DEFAULT_SITE_SETTINGS, ...(data.site || {}) }))
      .catch((loadError) => active && setError(loadError.message || "Unable to load settings"))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const updateField = (key, value) => {
    const normalizedValue = key.endsWith("Color") ? normalizeHexColor(value) || value : value;
    setForm((current) => ({ ...current, [key]: normalizedValue }));
    if (typeof window !== "undefined" && (key === "fontFamily" || key.startsWith("customFont") || (key.endsWith("Color") && normalizeHexColor(normalizedValue)))) {
      window.dispatchEvent(new CustomEvent("site-settings-updated", {
        detail: { [key]: key.endsWith("Color") ? normalizeHexColor(normalizedValue) : normalizedValue },
      }));
    }
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

      const nextValues = {
        fontFamily: "custom",
        customFontUrl: body.url,
        customFontFormat: body.format,
        customFontName: form.customFontName || "Custom Font",
      };
      setForm((current) => ({ ...current, ...nextValues }));
      window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: nextValues }));
      setMessage("Font uploaded. Review the custom font details, then save site settings.");
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload font");
    } finally {
      setUploadingFont(false);
    }
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
      setError(`${invalidColor} must be a hex color such as #2563eb.`);
      return;
    }
    if (form.fontFamily === "custom") {
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
      if (body.site) setForm((current) => ({ ...current, ...body.site }));
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

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1280, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: "#0b6c3a", fontWeight: 850, letterSpacing: "0.14em" }}>Store configuration</Typography>
        <Typography component="h1" sx={{ mt: 0.5, color: "#0f172a", fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: "-0.04em" }}>Site identity &amp; SEO</Typography>
        <Typography sx={{ mt: 0.75, color: "#64748b", maxWidth: 720 }}>Change the store name, font, colors, SEO defaults, logo, and support details from one place. These settings are shared by the public storefront and dashboard.</Typography>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5} component="form" onSubmit={save}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={2.5}>
            {FIELD_GROUPS.map((group) => (
              <Card key={group.title} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 8px 25px rgba(15,23,42,0.05)" }}>
                <CardContent sx={{ p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}>
                  <Typography sx={{ color: "#0f172a", fontSize: 19, fontWeight: 850 }}>{group.title}</Typography>
                  <Typography sx={{ mt: 0.5, mb: 2.5, color: "#64748b", fontSize: 13 }}>{group.description}</Typography>
                  <Grid container spacing={2}>
                    {group.fields.map((field) => (
                      <Grid item xs={12} sm={field.fullWidth || field.key === "siteDescription" || field.key === "siteKeywords" ? 12 : 6} key={field.key}>
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
                            <TextField
                              fullWidth
                              label={`${field.label} hex code`}
                              value={form[field.key] || ""}
                              onChange={(event) => updateField(field.key, event.target.value)}
                              placeholder="#2563eb"
                              helperText={field.helperText || "Use #RRGGBB"}
                              error={Boolean(form[field.key]) && !normalizeHexColor(form[field.key])}
                              disabled={hydrated && (loading || saving)}
                              inputProps={{ maxLength: 7, spellCheck: false }}
                              size="small"
                            />
                          </Stack>
                        ) : field.type === "select" ? (
                          <TextField
                            fullWidth
                            select
                            label={field.label}
                            value={form[field.key] || ""}
                            onChange={(event) => updateField(field.key, event.target.value)}
                            helperText={field.helperText}
                            disabled={hydrated && (loading || saving || (field.customOnly && form.fontFamily !== "custom"))}
                            size="small"
                          >
                            {(field.options || SITE_FONT_OPTIONS).map((option) => (
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
                            disabled={hydrated && (loading || saving || (field.customOnly && form.fontFamily !== "custom"))}
                            size="small"
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                  {group.title === "Typography" && (
                    <Stack spacing={0.75} sx={{ mt: 2.5, pt: 2, borderTop: "1px solid #e2e8f0" }}>
                      <Typography sx={{ color: "#0f172a", fontSize: 14, fontWeight: 800 }}>Upload a font file</Typography>
                      <Typography sx={{ color: "#64748b", fontSize: 12 }}>Upload a font to the site, then save the settings to activate it everywhere.</Typography>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUploadOutlinedIcon />}
                        disabled={hydrated && (loading || saving || uploadingFont)}
                        sx={{ alignSelf: "flex-start", mt: 0.5, borderRadius: 999, textTransform: "none", fontWeight: 800 }}
                      >
                        {uploadingFont ? "Uploading..." : "Choose font file"}
                        <input hidden type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={uploadFont} />
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
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
    </Box>
  );
}
