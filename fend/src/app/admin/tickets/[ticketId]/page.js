import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminTicketDetailPage({ params }) {
  const { ticketId } = await params;
  redirect(`/dashboard/tikects/${ticketId}`);
}
