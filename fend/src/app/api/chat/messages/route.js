import { proxyRequest } from "../../../lib/backendProxy";

export const runtime = "nodejs";

export async function GET(request) {
  return proxyRequest(request, ["api", "chat", "messages"]);
}

export async function POST(request) {
  return proxyRequest(request, ["api", "chat", "messages"]);
}
