import { NextResponse } from "next/server";

const ALLOWED_FRAME_ANCESTORS = "'self' https://nickwebproject.com https://www.nickwebproject.com";

function contentSecurityPolicy(nonce) {
  const development = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""} https://cdn.tiny.cloud https://js.stripe.com`,
    // MUI/Emotion, component sx props, and TinyMCE emit runtime style elements
    // and attributes. Keep style compatibility separate from the stricter,
    // nonce-protected executable-script policy above.
    "style-src 'self' 'unsafe-inline' https://cdn.tiny.cloud",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://cdn.tiny.cloud https://fonts.gstatic.com",
    "connect-src 'self' https://api.stripe.com https://cdn.tiny.cloud",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `frame-ancestors ${ALLOWED_FRAME_ANCESTORS}`,
    "form-action 'self'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
    "report-uri /api/security/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

export function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", policy);
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/security/csp-report"');
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
