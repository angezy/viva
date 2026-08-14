import { redirect } from "next/navigation";

export const metadata = { title: "Help | Weluxo", description: "Find help with Weluxo products, orders, shipping, returns, and support." };

export default function HelpAliasPage() {
  redirect("/help-center");
}
