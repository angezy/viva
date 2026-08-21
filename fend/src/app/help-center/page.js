import HelpCenterSection from "../components/HelpCenterSection";
import HelpCenterStructuredData from "../components/HelpCenterStructuredData";
import { getHelpCenterContent, getHelpCenterMetadata } from "../lib/helpCenterContent";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return await getHelpCenterMetadata(await getHelpCenterContent());
}

export default async function HelpCenterPage() {
  const content = await getHelpCenterContent();
  return (
    <>
      <HelpCenterStructuredData content={content} />
      <HelpCenterSection initialContent={content} />
    </>
  );
}
