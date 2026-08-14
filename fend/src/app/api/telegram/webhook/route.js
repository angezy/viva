import { proxyRequest } from "../../../lib/backendProxy";

export const runtime = "nodejs";

export async function POST(request) {
  return proxyRequest(request, ["api", "telegram", "webhook"]);
}
