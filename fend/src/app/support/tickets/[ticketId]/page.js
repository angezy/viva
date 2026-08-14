import SupportTicketConversation from "../../../components/support/SupportTicketConversation";

export const dynamic = "force-dynamic";

export default async function TicketConversationPage({ params }) {
  const { ticketId } = await params;
  return <SupportTicketConversation ticketId={ticketId} />;
}
