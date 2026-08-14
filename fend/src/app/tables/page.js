import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "../lib/auth";
import TablesExplorer from "./TablesExplorer";

export const metadata = {
  title: "Database Tables | Weluxo",
  robots: { index: false, follow: false },
};

export default async function TablesPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || String(user.role || "").toLowerCase() !== "admin") redirect("/signin/admin");
  return <TablesExplorer />;
}
