"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { buildSiteColorVars, buildSiteFontVars, createSiteTheme } from "../theme";
import { fetchSiteSettings, getSiteCustomFontFace, normalizeSiteSettings } from "../lib/siteSettings";

export default function SiteThemeProvider({ children, siteSettings }) {
  const [currentSettings, setCurrentSettings] = useState(() => normalizeSiteSettings(siteSettings));
  const theme = useMemo(() => createSiteTheme(currentSettings), [currentSettings]);
  const customFontFace = useMemo(() => getSiteCustomFontFace(currentSettings), [currentSettings]);
  const siteVars = useMemo(() => ({
    ...buildSiteColorVars(currentSettings),
    ...buildSiteFontVars(currentSettings),
  }), [currentSettings]);

  useEffect(() => {
    setCurrentSettings(normalizeSiteSettings(siteSettings));
  }, [siteSettings]);

  useEffect(() => {
    const applySettings = (value) => setCurrentSettings((previous) => normalizeSiteSettings({ ...previous, ...value }));
    const handleSettingsUpdated = (event) => applySettings(event.detail || {});

    fetchSiteSettings().then(applySettings).catch(() => undefined);
    window.addEventListener("site-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("site-settings-updated", handleSettingsUpdated);
  }, []);

  useEffect(() => {
    Object.entries(siteVars).forEach(([name, value]) => document.body.style.setProperty(name, value));
  }, [siteVars]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {customFontFace && <style data-site-custom-font dangerouslySetInnerHTML={{ __html: customFontFace }} />}
      {children}
    </ThemeProvider>
  );
}
