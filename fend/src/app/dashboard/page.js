import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, verifyToken } from "../../lib/auth";

export default async function DashboardPage() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  redirect(String(user?.role || user?.accountRole || "").toLowerCase() === "admin" ? "/dashboard/orders" : "/dashboard/Overview");
}
