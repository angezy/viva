import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'viva_token';

export function signToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h', ...opts });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export function cookieOptions() {
  return getAuthCookieOptions(60 * 60 * 8);
}

export function getAuthCookieOptions(maxAge = 60 * 60) {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export { COOKIE_NAME };
