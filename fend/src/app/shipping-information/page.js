import { redirect } from "next/navigation";

export const metadata = { title: "Shipping Information | Weluxo", description: "Weluxo shipping times, countries, tracking, and delivery information." };

export default function ShippingInformationPage() {
  redirect("/shipping-policy");
}
