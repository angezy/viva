import defaultContent from "../../../data/how-it-works.json";
import HowItWorksSection from "../components/HowItWorksSection";

const siteUrl = "https://weluxo.com";

export const metadata = {
  title: defaultContent.seo.title,
  description: defaultContent.seo.description,
  alternates: { canonical: `${siteUrl}/how-it-works` },
  openGraph: {
    title: defaultContent.seo.ogTitle,
    description: defaultContent.seo.ogDescription,
    url: `${siteUrl}/how-it-works`,
    siteName: "Weluxo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultContent.seo.ogTitle,
    description: defaultContent.seo.ogDescription,
  },
};

function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Weluxo",
        url: siteUrl,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Weluxo",
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

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}

export default function HowItWorksPage() {
  return (
    <>
      <StructuredData />
      <HowItWorksSection />
    </>
  );
}
