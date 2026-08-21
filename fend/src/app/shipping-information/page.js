import { redirect } from "next/navigation";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Shipping Information", description: "Shipping times, countries, tracking, and delivery information.", path: "/shipping-information" });
}

export default function ShippingInformationPage() {
  redirect("/shipping-policy");
}
