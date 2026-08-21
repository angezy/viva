import { redirect } from "next/navigation";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Warranty Support", description: "Find warranty information and product support.", path: "/warranty" });
}

export default function WarrantyPage() {
  redirect("/help-center");
}
