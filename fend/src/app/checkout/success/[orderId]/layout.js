export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return {
    title: `Order Confirmed | Weluxo`,
    description: "Your Weluxo order has been successfully confirmed. Track your shipment and receive updates.",
    alternates: { canonical: `/checkout/success/${encodeURIComponent(orderId)}` },
  };
}

export default function SuccessOrderLayout({ children }) {
  return children;
}
