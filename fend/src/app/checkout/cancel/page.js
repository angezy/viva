import { redirect } from "next/navigation";

export default function LegacyCheckoutCancel() {
  redirect("/checkout/cancelled/legacy");
}
