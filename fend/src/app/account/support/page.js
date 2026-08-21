import SupportTicketList from "../../components/support/SupportTicketList";
import { getSitePageMetadata } from "../../lib/siteSettingsServer";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return getSitePageMetadata({ title: "My Support Tickets", path: "/account/support", robots: { index: false, follow: false } });
}

export default function AccountSupportPage() {
  return <SupportTicketList />;
}
