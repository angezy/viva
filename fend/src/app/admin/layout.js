import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyToken } from "../../lib/auth";

export default async function AdminLayout({ children }) {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || !["owner", "admin"].includes(String(user.role || "").toLowerCase())) redirect("/signin/admin");
  return children;
}
