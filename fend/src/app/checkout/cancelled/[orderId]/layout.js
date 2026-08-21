import { getSitePageMetadata } from "../../../lib/siteSettingsServer";

export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return getSitePageMetadata({ title: "Checkout Cancelled", description: "Your checkout was cancelled. Your cart is still available when you are ready.", path: `/checkout/cancelled/${encodeURIComponent(orderId)}` });
}

export default function CancelledOrderLayout({ children }) { return children; }
