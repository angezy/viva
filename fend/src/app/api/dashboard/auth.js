import { cookies, headers } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyToken } from "../../../lib/auth";

const ROLE_PERMISSIONS = {
  owner: null,
  admin: new Set(["dashboard.view", "orders.read", "orders.update", "tickets.read", "tickets.reply", "tickets.update", "users.read"]),
  customer: new Set(),
};

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return role === "owner" || role === "admin" ? role : "customer";
}

export function hasDashboardPermission(role, permission) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "owner" || Boolean(ROLE_PERMISSIONS[normalizedRole]?.has(permission));
}

export async function requireDashboardAdmin(permission = "dashboard.view") {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const allowedOrigins = new Set([
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
    host ? `${protocol}://${host}` : null,
  ].map((value) => String(value || "").trim().replace(/\/$/, "")).filter(Boolean));
  if (!origin || !allowedOrigins.has(origin.replace(/\/$/, ""))) {
    return Response.json({ error: "Request origin could not be verified" }, { status: 403 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const user = token ? verifyToken(token) : null;
  const role = normalizeRole(user?.role || user?.accountRole);
  if (!user || !["owner", "admin"].includes(role)) {
    return Response.json({ error: "Staff dashboard access required" }, { status: 401 });
  }
  if (!hasDashboardPermission(role, permission)) {
    return Response.json({ error: "You do not have permission to perform this action", code: "FORBIDDEN" }, { status: 403 });
  }
  const backendUrl = String(process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
  if (!backendUrl) return Response.json({ error: "Session validation is unavailable" }, { status: 503 });
  try {
    const validation = await fetch(`${backendUrl}/api/session/validate?role=admin`, {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}` },
      cache: "no-store",
    });
    if (!validation.ok) return Response.json({ error: "Admin session is invalid or revoked" }, { status: 401 });
  } catch (_error) {
    return Response.json({ error: "Session validation is unavailable" }, { status: 503 });
  }
  return null;
}
