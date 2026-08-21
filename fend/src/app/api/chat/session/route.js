import { proxyRequest } from "../../../lib/backendProxy";

export const runtime = "nodejs";

export async function DELETE(request) {
  return proxyRequest(request, ["api", "chat", "session"]);
}
