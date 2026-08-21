import { promises as fs } from "fs";
import path from "path";
import { getSiteSettingsServer, siteUrlFor } from "./siteSettingsServer";

const LEGAL_FILES = {
  "privacy-policy": "privacy-policy.json",
  "terms-conditions": "terms-conditions.json",
  "shipping-policy": "shipping-policy.json",
  "return-refund-policy": "return-refund-policy.json",
};

export async function getLegalContent(slug, fallback) {
  const filename = LEGAL_FILES[slug];
  if (!filename) return fallback;
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", filename), "utf8"));
  } catch {
    return fallback;
  }
}

export async function getLegalMetadata(content, slug) {
  const site = await getSiteSettingsServer();
  const seo = content?.seo || {};
  const title = seo.title || content?.hero?.title || `${site.siteName} Policy`;
  const description = seo.description || content?.hero?.intro || `${site.siteName} customer information.`;
  const url = siteUrlFor(site, `/${slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: site.siteName,
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}
