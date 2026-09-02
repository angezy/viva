import { getSiteSettingsServer, siteUrlFor } from "../lib/siteSettingsServer";

export default async function LegalStructuredData({ content, slug }) {
  const site = await getSiteSettingsServer();
  const siteUrl = siteUrlFor(site);
  const title = content?.hero?.title || `${site.siteName} Policy`;
  const description = content?.seo?.description || content?.hero?.intro || `${site.siteName} customer information.`;
  const faqItems = Array.isArray(content?.faq?.items) ? content.faq.items : [];
  const pageUrl = siteUrlFor(site, `/${slug}`);
  const organizationId = `${siteUrl}/#organization`;
  const websiteId = `${siteUrl}/#website`;
  const graph = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: site.siteName,
      url: siteUrl,
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      isPartOf: { "@id": websiteId },
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
    "@id": websiteId,
    url: siteUrl,
    name: site.siteName,
    publisher: { "@id": organizationId },
  });

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }} />;
}
