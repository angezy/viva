import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from "./siteSettings";

export async function getSiteSettingsServer() {
  const backendUrl = process.env.BACKEND_URL?.trim()?.replace(/\/$/, "");
  if (!backendUrl) return DEFAULT_SITE_SETTINGS;

  try {
    const response = await fetch(`${backendUrl}/api/site-settings`, { cache: "no-store" });
    if (!response.ok) return DEFAULT_SITE_SETTINGS;
    return normalizeSiteSettings(await response.json());
  } catch (_error) {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function siteUrlFor(site, path = "") {
  const base = String(site?.siteUrl || DEFAULT_SITE_SETTINGS.siteUrl).replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function getSitePageMetadata({ title, description, path, robots }) {
  const site = await getSiteSettingsServer();
  const url = siteUrlFor(site, path);
  return {
    title,
    description,
    ...(robots ? { robots } : {}),
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: site.siteName, type: "website" },
    twitter: { card: "summary", title, description },
  };
}
