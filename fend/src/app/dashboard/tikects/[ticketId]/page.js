import AdminTicketView from "../../../components/support/AdminTicketView";

export const dynamic = "force-dynamic";

export default async function DashboardTicketDetailPage({ params }) {
  const { ticketId } = await params;
  return <AdminTicketView ticketId={ticketId} />;
}
