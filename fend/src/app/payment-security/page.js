import InfoPage from "../components/InfoPage";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Payment Security", description: "Learn how our store protects payment and checkout information.", path: "/payment-security" });
}

export default function PaymentSecurityPage() {
  return <InfoPage eyebrow="Security" title="Payment security" description="Your checkout should be clear, secure, and easy to understand." sections={[
    { title: "Provider-ready checkout", body: "Weluxo sends a payment method and order amount to the payment-provider integration point. Raw card numbers, expiry dates, and CVV values are not stored by Weluxo." },
    { title: "Payment status", body: "Orders show whether payment is pending or confirmed. A live payment provider must be connected before the site accepts real card credentials or marks a payment as paid." },
    { title: "Account protection", body: "Customer orders and payment-related order details are available only through an authenticated customer session. Never share your password or one-time codes." },
  ]} />;
}
