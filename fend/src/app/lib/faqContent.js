import { promises as fs } from "fs";
import path from "path";
import defaultContent from "../../../data/faq.json";
import { getSiteSettingsServer, siteUrlFor } from "./siteSettingsServer";

export async function getFaqContent() {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "faq.json"), "utf8"));
  } catch {
    return defaultContent;
  }
}

export async function getFaqMetadata(content) {
  const site = await getSiteSettingsServer();
  const seo = content?.seo || {};
  const title = seo.title || content?.hero?.title || `${site.siteName} FAQ`;
  const description = seo.description || content?.hero?.intro || `Find answers about shopping with ${site.siteName}.`;
  const url = siteUrlFor(site, "/faq");
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
