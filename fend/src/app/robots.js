const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://weluxo.com").replace(/\/$/, "");

export default function robots() {
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
          "/tables",
          "/signin",
          "/signup",
          "/register",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
