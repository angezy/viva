import defaultContent from "../../../data/how-it-works.json";
import HowItWorksSection from "../components/HowItWorksSection";
import { getSiteSettingsServer, siteUrlFor } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  const site = await getSiteSettingsServer();
  const replaceBrand = (value) => String(value || "").replaceAll("Weluxo", site.siteName);
  const url = siteUrlFor(site, "/how-it-works");
  return {
    title: replaceBrand(defaultContent.seo.title),
    description: replaceBrand(defaultContent.seo.description),
    alternates: { canonical: url },
    openGraph: {
      title: replaceBrand(defaultContent.seo.ogTitle),
      description: replaceBrand(defaultContent.seo.ogDescription),
      url,
      siteName: site.siteName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: replaceBrand(defaultContent.seo.ogTitle),
      description: replaceBrand(defaultContent.seo.ogDescription),
    },
  };
}

async function StructuredData() {
  const site = await getSiteSettingsServer();
  const siteUrl = siteUrlFor(site);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: site.siteName,
        url: siteUrl,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: site.siteName,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "How It Works", item: `${siteUrl}/how-it-works` },
        ],
      },
    ],
  };

  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} />;
}

export default function HowItWorksPage() {
  return (
    <>
      <StructuredData />
      <HowItWorksSection />
    </>
  );
}
