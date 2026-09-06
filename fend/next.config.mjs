/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
    ];
    if (process.env.NODE_ENV === "production") securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/account/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] },
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] },
      { source: "/checkout/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }] },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
