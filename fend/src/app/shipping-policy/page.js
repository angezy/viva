import defaultContent from "../../../data/shipping-policy.json";
import LegalPageSection from "../components/LegalPageSection";
import LegalStructuredData from "../components/LegalStructuredData";
import { getLegalContent, getLegalMetadata } from "../lib/legalContent";

const slug = "shipping-policy";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return await getLegalMetadata(await getLegalContent(slug, defaultContent), slug);
}

export default async function ShippingPolicyPage() {
  const content = await getLegalContent(slug, defaultContent);
  return <><LegalStructuredData content={content} slug={slug} /><LegalPageSection pageSlug={slug} initialContent={content} /></>;
}
