import { getSitePageMetadata } from "../../../lib/siteSettingsServer";

export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return {
    ...(await getSitePageMetadata({ title: "Order Confirmed", description: "Your order has been successfully confirmed. Track your shipment and receive updates.", path: `/checkout/success/${encodeURIComponent(orderId)}` })),
  };
}

export default function SuccessOrderLayout({ children }) {
  return children;
}
