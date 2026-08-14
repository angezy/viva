import AdminTicketList from "../../components/support/AdminTicketList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support Tickets | Admin", robots: { index: false, follow: false } };

export default function DashboardTicketsPage() {
  return <AdminTicketList />;
}
