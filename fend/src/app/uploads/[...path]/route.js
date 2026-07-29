import { proxyRequest } from "../../lib/backendProxy";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { path } = await params;
  return proxyRequest(request, ["uploads", ...path]);
}
