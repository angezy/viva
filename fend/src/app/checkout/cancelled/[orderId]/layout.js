export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return { title: "Checkout Cancelled | Weluxo", description: "Your Weluxo checkout was cancelled. Your cart is still available when you are ready.", alternates: { canonical: `/checkout/cancelled/${encodeURIComponent(orderId)}` } };
}

export default function CancelledOrderLayout({ children }) { return children; }
