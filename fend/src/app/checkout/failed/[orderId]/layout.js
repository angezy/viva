export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return { title: "Payment Failed | Weluxo", description: "Your Weluxo payment could not be completed. Retry securely or choose another payment method.", alternates: { canonical: `/checkout/failed/${encodeURIComponent(orderId)}` } };
}

export default function FailedOrderLayout({ children }) { return children; }
