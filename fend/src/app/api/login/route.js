import { proxyRequest } from "../../lib/backendProxy";

// Keep this explicit route so login cookies are returned from the frontend's
// origin, where both browser requests and server components can use them.
export async function POST(request) {
  return proxyRequest(request, ["api", "login"]);
}
