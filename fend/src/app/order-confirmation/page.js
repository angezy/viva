import InfoPage from "../components/InfoPage";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Order Confirmation", description: "Find your order confirmation, tracking, and invoice links.", path: "/order-confirmation" });
}

export default function OrderConfirmationPage() {
  return <InfoPage eyebrow="Orders" title="Order confirmation" description="After checkout, your confirmation page includes your order number, total, delivery information, tracking, and invoice links." sections={[
    { title: "Already placed an order?", body: "Open your account orders to view recent purchases, or use the tracking page with your order number." },
    { title: "Need your invoice?", body: "Use the invoice link on the order confirmation page. You must be signed in to view order details." },
  ]} />;
}
