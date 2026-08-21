import { promises as fs } from "fs";
import path from "path";
import defaultContent from "../../../data/help-center.json";
import { getSiteSettingsServer, siteUrlFor } from "./siteSettingsServer";

export async function getHelpCenterContent() {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "help-center.json"), "utf8"));
  } catch {
    return defaultContent;
  }
}

export async function getHelpCenterMetadata(content) {
  const site = await getSiteSettingsServer();
  const seo = content?.seo || {};
  const title = seo.title || `Help | ${site.siteName} Customer Support`;
  const description = seo.description || `Get help with ${site.siteName} orders, shipping, returns, refunds, product support, and customer service.`;
  const url = siteUrlFor(site, "/help-center");
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      url,
      siteName: site.siteName,
      type: "website",
    },
    twitter: { card: "summary", title: seo.ogTitle || title, description: seo.ogDescription || description },
  };
}
