import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyToken } from "../lib/auth";
import TablesExplorer from "./TablesExplorer";
import { getSitePageMetadata } from "../lib/siteSettingsServer";

export async function generateMetadata() {
  return getSitePageMetadata({ title: "Database Tables", path: "/tables", robots: { index: false, follow: false } });
}

export default async function TablesPage() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || String(user.role || "").toLowerCase() !== "admin") redirect("/signin/admin");
  return <TablesExplorer />;
}
