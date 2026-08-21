import { getSitePageMetadata } from "../../../lib/siteSettingsServer";

export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return getSitePageMetadata({ title: "Payment Failed", description: "Your payment could not be completed. Retry securely or choose another payment method.", path: `/checkout/failed/${encodeURIComponent(orderId)}` });
}

export default function FailedOrderLayout({ children }) { return children; }
