import defaultContent from "../../../data/return-refund-policy.json";
import LegalPageSection from "../components/LegalPageSection";
import LegalStructuredData from "../components/LegalStructuredData";
import { getLegalContent, getLegalMetadata } from "../lib/legalContent";

const slug = "return-refund-policy";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return await getLegalMetadata(await getLegalContent(slug, defaultContent), slug);
}

export default async function ReturnRefundPolicyPage() {
  const content = await getLegalContent(slug, defaultContent);
  return <><LegalStructuredData content={content} slug={slug} /><LegalPageSection pageSlug={slug} initialContent={content} /></>;
}
