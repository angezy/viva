import { redirect } from "next/navigation";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Help", description: "Find help with products, orders, shipping, returns, and support.", path: "/help" });
}

export default function HelpAliasPage() {
  redirect("/help-center");
}
