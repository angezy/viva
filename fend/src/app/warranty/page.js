import { redirect } from "next/navigation";

export const metadata = { title: "Warranty Support | Weluxo", description: "Find Weluxo warranty information and product support." };

export default function WarrantyPage() {
  redirect("/help-center");
}
