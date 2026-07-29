const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "user-agent",
  "x-forwarded-for",
];

const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-length",
  "content-type",
  "etag",
  "last-modified",
  "location",
];

function backendBaseUrl() {
  const value = process.env.BACKEND_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

/**
 * Proxies a same-origin frontend request to the backend. BACKEND_URL is
 * deliberately server-only: it is never exposed to, or used by, the browser.
 */
export async function proxyRequest(request, upstreamPath) {
  const baseUrl = backendBaseUrl();
  if (!baseUrl) {
    return Response.json(
      { error: "Backend is not configured. Set BACKEND_URL on the frontend server." },
      { status: 503 }
    );
  }

  const requestUrl = new URL(request.url);
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("x-forwarded-host", request.headers.get("host") || requestUrl.host);
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const init = {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
    };
    if (hasBody) {
      init.body = request.body;
      init.duplex = "half";
    }

    const upstream = await fetch(`${baseUrl}/${upstreamPath.join("/")}${requestUrl.search}`, init);

    const responseHeaders = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) {
      cookies.forEach((cookie) => responseHeaders.append("set-cookie", cookie));
    } else {
      const cookie = upstream.headers.get("set-cookie");
      if (cookie) responseHeaders.set("set-cookie", cookie);
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("Backend proxy request failed:", error);
    return Response.json({ error: "Backend service is unavailable." }, { status: 502 });
  }
}
