import { redirect } from "next/navigation";

export default async function LegacyCheckoutSuccess({ searchParams }) {
  const query = await searchParams;
  const orderId = query?.orderId;
  redirect(orderId ? `/checkout/success/${encodeURIComponent(orderId)}` : "/order-confirmation");
}
