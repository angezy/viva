import { getSiteSettingsServer, siteUrlFor } from "../lib/siteSettingsServer";

export default async function LegalStructuredData({ content, slug }) {
  const site = await getSiteSettingsServer();
  const siteUrl = siteUrlFor(site);
  const title = content?.hero?.title || `${site.siteName} Policy`;
  const description = content?.seo?.description || content?.hero?.intro || `${site.siteName} customer information.`;
  const faqItems = Array.isArray(content?.faq?.items) ? content.faq.items : [];
  const pageUrl = `https://weluxo.com/${slug}`;
  const graph = [
    {
      "@type": "Organization",
      "@id": "https://weluxo.com/#organization",
      name: site.siteName,
      url: "https://weluxo.com",
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      isPartOf: { "@id": "https://weluxo.com/#website" },
    },
  ];

  if (faqItems.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  graph.push({
    "@type": "WebSite",
    "@id": "https://weluxo.com/#website",
    url: "https://weluxo.com",
    name: site.siteName,
    publisher: { "@id": "https://weluxo.com/#organization" },
  });

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }} />;
}
