import { redirect } from "next/navigation";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Track Your Order", description: "Track your order and view delivery updates.", path: "/tracking" });
}

export default function TrackingPage() {
  redirect("/account/tracking");
}
