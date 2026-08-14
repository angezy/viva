import { promises as fs } from "fs";
import path from "path";
import defaultContent from "../../../data/help-center.json";

export async function getHelpCenterContent() {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "help-center.json"), "utf8"));
  } catch {
    return defaultContent;
  }
}

export function getHelpCenterMetadata(content) {
  const seo = content?.seo || {};
  const title = seo.title || "Help | Weluxo Customer Support";
  const description = seo.description || "Get help with Weluxo orders, shipping, returns, refunds, product support, and customer service.";
  return {
    title,
    description,
    alternates: { canonical: "https://weluxo.com/help-center" },
    openGraph: {
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      url: "https://weluxo.com/help-center",
      siteName: "Weluxo",
      type: "website",
    },
    twitter: { card: "summary", title: seo.ogTitle || title, description: seo.ogDescription || description },
  };
}
