import SupportTicketList from "../../components/support/SupportTicketList";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Support Tickets | Weluxo", robots: { index: false, follow: false } };

export default function AccountSupportPage() {
  return <SupportTicketList />;
}
