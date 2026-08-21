import "./globals.css";
import ConditionalShell from "./components/ConditionalShell";
import ToastProvider from "./components/ToastProvider";
import ScrollToTop from "./components/ScrollToTop";
import SiteThemeProvider from "./components/SiteThemeProvider";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { getSiteSettingsServer } from "./lib/siteSettingsServer";
import { buildSiteColorVars, buildSiteFontVars } from "./theme";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const site = await getSiteSettingsServer();
  let metadataBase;
  try {
    metadataBase = new URL(site.siteUrl);
  } catch (_error) {
    metadataBase = undefined;
  }

  const metadata = {
    title: { default: site.siteName, template: `%s | ${site.siteName}` },
    description: site.siteDescription,
    applicationName: site.siteName,
    keywords: site.siteKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    openGraph: {
      type: "website",
      siteName: site.siteName,
      title: site.siteName,
      description: site.siteDescription,
      ...(site.siteOgImageUrl ? { images: [{ url: site.siteOgImageUrl }] } : {}),
    },
    twitter: {
      card: site.siteOgImageUrl ? "summary_large_image" : "summary",
      title: site.siteName,
      description: site.siteDescription,
    },
  };

  if (metadataBase) metadata.metadataBase = metadataBase;
  if (site.siteFaviconUrl) metadata.icons = { icon: site.siteFaviconUrl };
  return metadata;
}

export default async function RootLayout({ children }) {
  const siteSettings = await getSiteSettingsServer();

  return (
    <html lang="en">
      <body style={{ ...buildSiteColorVars(siteSettings), ...buildSiteFontVars(siteSettings) }}>
        <AppRouterCacheProvider>
          <SiteThemeProvider siteSettings={siteSettings}>
            <ScrollToTop />
            <ConditionalShell>{children}</ConditionalShell>
            <ToastProvider />
          </SiteThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
