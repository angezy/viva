"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildSiteColorVars, buildSiteFontVars, createSiteTheme } from "../theme";
import { getSiteCustomFontFace, normalizeSiteSettings } from "../lib/siteSettings";

const SiteSettingsContext = createContext(normalizeSiteSettings());

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

export default function SiteThemeProvider({ children, siteSettings }) {
  const [currentSettings, setCurrentSettings] = useState(() => normalizeSiteSettings(siteSettings));
  const theme = useMemo(() => createSiteTheme(currentSettings), [currentSettings]);
  const customFontFace = useMemo(() => getSiteCustomFontFace(currentSettings), [currentSettings]);
  const siteVars = useMemo(() => ({
    ...buildSiteColorVars(currentSettings),
    ...buildSiteFontVars(currentSettings),
  }), [currentSettings]);

  useEffect(() => {
    queueMicrotask(() => setCurrentSettings(normalizeSiteSettings(siteSettings)));
  }, [siteSettings]);

  useEffect(() => {
    const applySettings = (value) => setCurrentSettings((previous) => normalizeSiteSettings({ ...previous, ...value }));
    const handleSettingsUpdated = (event) => applySettings(event.detail || {});

    window.addEventListener("site-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("site-settings-updated", handleSettingsUpdated);
  }, []);

  useEffect(() => {
    Object.entries(siteVars).forEach(([name, value]) => document.body.style.setProperty(name, value));
  }, [siteVars]);

  useEffect(() => {
    let style = document.head.querySelector("style[data-site-custom-font]");
    if (!customFontFace) {
      style?.remove();
      return undefined;
    }
    if (!style) {
      style = document.createElement("style");
      style.setAttribute("data-site-custom-font", "true");
      document.head.appendChild(style);
    }
    style.textContent = customFontFace;
    return undefined;
  }, [customFontFace]);

  return (
    <SiteSettingsContext.Provider value={currentSettings}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SiteSettingsContext.Provider>
  );
}
