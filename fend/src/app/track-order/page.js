import { redirect } from "next/navigation";

export const metadata = { title: "Track Your Order | Weluxo", description: "Track your Weluxo order and view delivery updates." };

export default function TrackOrderPage() {
  redirect("/account/tracking");
}
