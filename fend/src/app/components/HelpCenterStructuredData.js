export default function HelpCenterStructuredData({ content }) {
  const siteUrl = "https://weluxo.com";
  const faqItems = Array.isArray(content?.faq?.items) ? content.faq.items : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Weluxo",
        url: siteUrl,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: content?.contactSupport?.email || "support@weluxo.com",
          availableLanguage: ["English"],
        },
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/help-center#webpage`,
        url: `${siteUrl}/help-center`,
        name: content?.seo?.title || "Help | Weluxo Customer Support",
        description: content?.seo?.description || "Weluxo customer support and help.",
        isPartOf: { "@id": `${siteUrl}/#website` },
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
