import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
export const ADMIN_COOKIE_NAME = 'viva_admin_token';
export const CUSTOMER_COOKIE_NAME = 'viva_customer_token';

export function signToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h', algorithm: 'HS256', ...opts });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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
