import SupportTicketForm from "../../components/support/SupportTicketForm";
import { getSitePageMetadata } from "../../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Create a Support Ticket", path: "/support/new-ticket", robots: { index: false, follow: true } });
}

export default function NewTicketPage() {
  return <SupportTicketForm />;
}
