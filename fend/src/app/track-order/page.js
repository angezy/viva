import { redirect } from "next/navigation";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Track Your Order", description: "Track your order and view delivery updates.", path: "/track-order" });
}

export default function TrackOrderPage() {
  redirect("/account/tracking");
}
