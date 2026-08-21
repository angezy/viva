import { proxyRequest } from "../../../lib/backendProxy";

export async function GET(request) {
  return proxyRequest(request, ["api", "auth", "google"]);
}
