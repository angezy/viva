import { getSiteSettingsServer, siteUrlFor } from "./lib/siteSettingsServer";

export default async function robots() {
  const siteUrl = siteUrlFor(await getSiteSettingsServer());
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/account",
          "/account/",
          "/checkout/",
          "/invoice/",
          "/support/",
          "/signin",
          "/signup",
          "/register",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
