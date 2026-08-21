import { getSitePageMetadata } from "../../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Secure Checkout | Complete Your Order", description: "Complete your order with secure customer and delivery information.", path: "/checkout/information" });
}

export default function CheckoutInformationLayout({ children }) {
  return children;
}
