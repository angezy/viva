import SupportTicketForm from "../../components/support/SupportTicketForm";

export const metadata = { title: "Create a Support Ticket | Weluxo", robots: { index: false, follow: true } };

export default function NewTicketPage() {
  return <SupportTicketForm />;
}
