import { createTheme } from "@mui/material/styles";
import { DEFAULT_SITE_SETTINGS, getSiteFontFamily } from "./lib/siteSettings";

export const DEFAULT_SITE_COLORS = {
  primary: DEFAULT_SITE_SETTINGS.primaryColor,
  primaryDark: DEFAULT_SITE_SETTINGS.primaryDarkColor,
  linkHover: DEFAULT_SITE_SETTINGS.linkHoverColor,
  primaryLight: DEFAULT_SITE_SETTINGS.primaryLightColor,
  primarySoft: DEFAULT_SITE_SETTINGS.primarySoftColor,
  accent: DEFAULT_SITE_SETTINGS.accentColor,
  accentDark: DEFAULT_SITE_SETTINGS.accentDarkColor,
  accentLight: DEFAULT_SITE_SETTINGS.accentLightColor,
  accentSoft: DEFAULT_SITE_SETTINGS.accentSoftColor,
  background: DEFAULT_SITE_SETTINGS.backgroundColor,
  surface: DEFAULT_SITE_SETTINGS.surfaceColor,
  surfaceMuted: DEFAULT_SITE_SETTINGS.surfaceMutedColor,
  border: DEFAULT_SITE_SETTINGS.borderColor,
  textPrimary: DEFAULT_SITE_SETTINGS.textPrimaryColor,
  textSecondary: DEFAULT_SITE_SETTINGS.textSecondaryColor,
  success: DEFAULT_SITE_SETTINGS.successColor,
  warning: DEFAULT_SITE_SETTINGS.warningColor,
  error: DEFAULT_SITE_SETTINGS.errorColor,
};

function safeHex(value, fallback) {
  const candidate = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return `#${candidate.slice(1).split("").map((digit) => `${digit}${digit}`).join("")}`;
  }
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

export function getSiteColors(siteSettings = {}) {
  const settingMap = {
    primary: "primaryColor",
    primaryDark: "primaryDarkColor",
    linkHover: "linkHoverColor",
    primaryLight: "primaryLightColor",
    primarySoft: "primarySoftColor",
    accent: "accentColor",
    accentDark: "accentDarkColor",
    accentLight: "accentLightColor",
    accentSoft: "accentSoftColor",
    background: "backgroundColor",
    surface: "surfaceColor",
    surfaceMuted: "surfaceMutedColor",
    border: "borderColor",
    textPrimary: "textPrimaryColor",
    textSecondary: "textSecondaryColor",
    success: "successColor",
    warning: "warningColor",
    error: "errorColor",
  };

  return Object.fromEntries(Object.entries(settingMap).map(([colorKey, settingKey]) => [
    colorKey,
    safeHex(siteSettings[settingKey], DEFAULT_SITE_COLORS[colorKey]),
  ]));
}

export function buildSiteColorVars(siteSettings = {}) {
  const colors = getSiteColors(siteSettings);
  return Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [
      `--color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  );
}

export function buildSiteFontVars(siteSettings = {}) {
  return { "--site-font-family": getSiteFontFamily(siteSettings.fontFamily, siteSettings.customFontName) };
}

export function createSiteTheme(siteSettings = {}) {
  const colors = getSiteColors(siteSettings);

  return createTheme({
    palette: {
      mode: "light",
      primary: { main: colors.primary, dark: colors.primaryDark, light: colors.primaryLight, contrastText: "#ffffff" },
      secondary: { main: colors.accent, dark: colors.accentDark, light: colors.accentLight, contrastText: "#2b2b2b" },
      background: { default: colors.background, paper: colors.surface },
      text: { primary: colors.textPrimary, secondary: colors.textSecondary },
      divider: colors.border,
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
    },
    typography: { fontFamily: getSiteFontFamily(siteSettings.fontFamily, siteSettings.customFontName), button: { fontWeight: 800, textTransform: "none" } },
    shape: { borderRadius: 14 },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { backgroundColor: colors.background, color: colors.textPrimary, fontFamily: getSiteFontFamily(siteSettings.fontFamily, siteSettings.customFontName) }, "::selection": { backgroundColor: colors.primarySoft, color: colors.textPrimary } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 999, fontWeight: 800 }, containedPrimary: { boxShadow: `0 8px 18px ${colors.primary}33` }, containedSecondary: { boxShadow: `0 8px 18px ${colors.accent}33` } } },
      MuiCard: { styleOverrides: { root: { backgroundColor: colors.surface, borderColor: colors.border } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: colors.surface, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colors.primaryLight }, "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: colors.primary, borderWidth: 2 } } } },
      MuiInputLabel: { styleOverrides: { root: { color: colors.textSecondary, "&.Mui-focused": { color: colors.primary } } } },
      MuiLink: { styleOverrides: { root: { color: colors.primary, "&:hover": { color: colors.linkHover } } } },
      MuiLinearProgress: { styleOverrides: { root: { backgroundColor: colors.primarySoft }, bar: { backgroundColor: colors.primary } } },
    },
  });
}

export const siteTheme = createSiteTheme();
