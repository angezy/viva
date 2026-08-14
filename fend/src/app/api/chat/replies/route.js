import { proxyRequest } from "../../../lib/backendProxy";

export const runtime = "nodejs";

export async function GET(request) {
  return proxyRequest(request, ["api", "chat", "replies"]);
}
