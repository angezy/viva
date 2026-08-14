import { promises as fs } from "fs";
import path from "path";
import defaultContent from "../../../data/faq.json";

export async function getFaqContent() {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "faq.json"), "utf8"));
  } catch {
    return defaultContent;
  }
}

export function getFaqMetadata(content) {
  const seo = content?.seo || {};
  const title = seo.title || content?.hero?.title || "Weluxo FAQ";
  const description = seo.description || content?.hero?.intro || "Find answers about shopping with Weluxo.";
  return {
    title,
    description,
    alternates: { canonical: "https://weluxo.com/faq" },
    openGraph: {
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      url: "https://weluxo.com/faq",
      siteName: "Weluxo",
      type: "website",
    },
    twitter: { card: "summary", title: seo.ogTitle || title, description: seo.ogDescription || description },
  };
}
