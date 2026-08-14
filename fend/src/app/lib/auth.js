import jwt from "jsonwebtoken";

export const COOKIE_NAME = "viva_token";
const JWT_SECRET = process.env.JWT_SECRET;

export function getAuthCookieOptions(maxAge = 60 * 60) {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

// Lightweight token verifier for server components (dashboard layout)
export function verifyToken(token) {
  if (!token || !JWT_SECRET) {
    console.log('[auth] verifyToken missing token or JWT_SECRET:', { hasToken: !!token, hasSecret: !!JWT_SECRET })
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return null;
  }
}
