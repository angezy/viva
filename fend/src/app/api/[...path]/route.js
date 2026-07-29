import { proxyRequest } from "../../lib/backendProxy";

export const runtime = "nodejs";

async function handler(request, { params }) {
  const { path } = await params;
  return proxyRequest(request, ["api", ...path]);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
