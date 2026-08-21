import { getSiteSettingsServer, siteUrlFor } from "../lib/siteSettingsServer";

export default async function HelpCenterStructuredData({ content }) {
  const site = await getSiteSettingsServer();
  const siteUrl = siteUrlFor(site);
  const faqItems = Array.isArray(content?.faq?.items) ? content.faq.items : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: site.siteName,
        url: siteUrl,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: content?.contactSupport?.email || site.supportEmail,
          availableLanguage: ["English"],
        },
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/help-center#webpage`,
        url: `${siteUrl}/help-center`,
        name: content?.seo?.title || `Help | ${site.siteName} Customer Support`,
        description: content?.seo?.description || `${site.siteName} customer support and help.`,
        isPartOf: { "@id": `${siteUrl}/#website` },
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
          { "@type": "ListItem", position: 2, name: "Help", item: `${siteUrl}/help-center` },
        ],
      },
      ...(faqItems.length
        ? [{
            "@type": "FAQPage",
            "@id": `${siteUrl}/help-center#faq`,
            mainEntity: faqItems.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }]
        : []),
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
