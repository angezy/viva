import FaqPageSection from "../components/FaqPageSection";
import FaqStructuredData from "../components/FaqStructuredData";
import { getFaqContent, getFaqMetadata } from "../lib/faqContent";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return await getFaqMetadata(await getFaqContent());
}

export default async function FaqPage() {
  const content = await getFaqContent();
  return (
    <>
      <FaqStructuredData content={content} />
      <FaqPageSection initialContent={content} />
    </>
  );
}
