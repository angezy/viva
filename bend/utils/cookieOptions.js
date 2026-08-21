const isProduction = process.env.NODE_ENV === "production";

// Leaving domain undefined intentionally creates host-only cookies. A domain
// can be supplied explicitly for a controlled multi-subdomain deployment.
const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
  ...(domain ? { domain } : {}),
};

function authCookieOptions() {
  return {
    ...baseCookieOptions,
    maxAge: 1000 * 60 * 60,
  };
}

function guestCookieOptions() {
  return {
    ...baseCookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  };
}

function clearCookieOptions() {
  return {
    ...baseCookieOptions,
    maxAge: 0,
  };
}

module.exports = {
  ADMIN_AUTH_COOKIE_NAME: "viva_admin_token",
  CUSTOMER_AUTH_COOKIE_NAME: "viva_customer_token",
  LEGACY_AUTH_COOKIE_NAME: "viva_token",
  GUEST_COOKIE_NAME: "viva_guest_id",
  authCookieOptions,
  guestCookieOptions,
  clearCookieOptions,
};
