import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "../../lib/auth";

export default async function AdminLayout({ children }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || String(user.role || "").toLowerCase() !== "admin") redirect("/signin/admin");
  return children;
}
