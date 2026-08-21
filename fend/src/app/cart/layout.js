import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Shopping Cart", description: "Review your shopping cart and complete secure checkout with worldwide shipping.", path: "/cart" });
}

export default function CartLayout({ children }) {
  return children;
}
