import { promises as fs } from "fs";
import path from "path";

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

export function getLegalMetadata(content, slug) {
  const seo = content?.seo || {};
  const title = seo.title || content?.hero?.title || "Weluxo Policy";
  const description = seo.description || content?.hero?.intro || "Weluxo customer information.";
  return {
    title,
    description,
    alternates: { canonical: `https://weluxo.com/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://weluxo.com/${slug}`,
      siteName: "Weluxo",
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}
