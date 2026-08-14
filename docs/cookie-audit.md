# Weluxo Cookie and Browser Storage Audit

Audit date: 2026-08-13  
Application: Weluxo Next.js frontend and Express backend

## Scope and conclusion

The application uses a server-issued JWT cookie for authentication and a server-issued guest identifier for cart and checkout continuity. Cart contents remain server-side in the current backend session maps; product and payment data are not stored in cookies.

No analytics, advertising, social-pixel, affiliate, CAPTCHA, CDN, or external chat SDK was found in the inspected frontend, backend, dependencies, environment files, layouts, or middleware. Stripe and PayPal are mentioned as future/payment-method UI options, but no SDK or browser cookie integration is present.

The implementation adds only the consent preference cookie required for the current application. Locale, currency, and market cookies are intentionally not added because the current storefront does not persist those as user preferences.

## Cookies discovered before implementation

| Cookie | Category | Purpose | First/Third Party | Created By | Lifetime | HttpOnly | Secure | SameSite | Consent Required | Status |
|---|---|---|---|---|---|---:|---:|---|---:|---|
| `viva_token` | Necessary / authentication | JWT used by protected account, dashboard, admin, support, review, order, and cart endpoints | First-party | `bend/routes/homeroute.js` login handler | 1 hour | Yes | Production only | Lax | No | Retained; attributes made explicit |
| `viva_guest_id` | Necessary / cart and checkout continuity | Opaque guest identity used to associate a guest cart and checkout attempt with backend session state | First-party | `bend/routes/homeroute.js` checkout identity middleware | 30 days | Yes | Production only | Lax | No | Retained; attributes made explicit |

## Cookies added

| Cookie | Category | Purpose | First/Third Party | Created By | Lifetime | HttpOnly | Secure | SameSite | Consent Required | Status |
|---|---|---|---|---|---|---:|---:|---|---:|---|
| `weluxo_consent` | Necessary / consent preference | Compact JSON consent state for necessary, preferences, analytics, and marketing categories | First-party | `CookieConsentBanner` through centralized cookie utilities | 180 days | No | HTTPS only | Lax | No | Added; `necessary` is always true |

The consent cookie is intentionally client-readable because the consent UI must display and update the user's choices. It never contains identity, authentication, payment, or personal profile data.

## Browser storage findings

| Storage | Key(s) | Purpose | Risk / decision |
|---|---|---|---|
| `localStorage` | `weluxoKeepSignedIn` | Stores only the signup checkbox preference; it does not store credentials | Retained as non-sensitive UI state; not moved to a cookie |
| `localStorage` | `registerForm` | Draft registration form continuity | Contains user-entered form data and is cleared after successful registration; retained for compatibility, but should be minimized in a future form redesign |
| `localStorage` | `signinEmail` | Remembers the last sign-in email | Non-secret convenience value; retained, with a future option to remove it for privacy-sensitive deployments |
| `localStorage` | Checkout state key in `checkoutState.js` | Preserves checkout form progress between checkout steps | Contains checkout form continuity data; retained because it is page-flow state and moving it to cookies would be less appropriate |
| `localStorage` | Recent-product history in `recentProducts.js` | Recently viewed product recommendations | Non-sensitive browsing preference; retained in local storage rather than increasing cookie size and request overhead |
| `sessionStorage` | `weluxo_exit_offer_seen` | Prevents repeating the cart exit offer during one browser tab session | Retained as temporary UI state; not appropriate as a persistent cookie |

No password, raw payment data, JWT, backend secret, or full cart payload was found in browser storage. The JWT is not written to local storage; authentication is cookie-based.

## Third-party cookie and SDK detection

The audit found no active integration for Google Analytics, Google Tag Manager, Google Ads, Meta Pixel, TikTok Pixel, Microsoft Clarity, reCAPTCHA, Cloudflare Turnstile, YouTube embeds, affiliate tracking, or referral tracking. No third-party cookie is intentionally created by the application.

The checkout success page contains optional hooks for `window.gtag`, `window.fbq`, and `window.ttq`, but no corresponding scripts are installed or loaded by this repository. Those hooks are now guarded by analytics or marketing consent respectively, so they remain inert unless an approved integration is added later.

PayPal and Google Pay appear as checkout method labels, and Stripe/PayPal are referenced in informational copy, but no payment SDK is loaded by the frontend. Payment provider cookies, if introduced later, must be documented and gated according to the provider's requirements.

## Security concerns identified and addressed

- Authentication remains in an HttpOnly cookie and is not migrated to local storage.
- Authentication no longer accepts JWTs from request bodies; browser authentication uses the HttpOnly cookie, while explicit bearer headers remain available for controlled API clients.
- Authentication and guest cookies explicitly set `Path=/`, `SameSite=Lax`, `HttpOnly=true`, and `Secure` in production.
- Logout uses matching cookie attributes when clearing the authentication cookie.
- The login response no longer needs to expose the JWT to browser JavaScript; clients rely on the HttpOnly cookie.
- No optional analytics or marketing scripts are initialized because none are present.
- Cookie utilities centralize client-safe cookie parsing and consent handling; server cookie access remains separate.

## Cookies intentionally not added

- `weluxo_refresh`: no refresh-token architecture exists; the current JWT lifetime is one hour.
- `weluxo_cart_id`: the existing `viva_guest_id` already serves this purpose and is coupled to the backend cart maps.
- `weluxo_locale`, `weluxo_currency`, `weluxo_market`: no active storefront preference state requires persistence.
- Analytics or marketing cookies: no corresponding integrations exist.

## Cookies removed

None. Existing authentication and guest-cart cookies were retained because they are required by the current architecture.

## Future recommendations

1. Move guest cart contents from process memory to durable database-backed cart tables before horizontal scaling or server restarts.
2. Consider replacing the one-hour JWT with a short-lived access token plus a rotated refresh-token cookie only if persistent sessions become a requirement.
3. Minimize or remove saved registration drafts and remembered sign-in email in privacy-sensitive deployments.
4. Re-audit consent behavior whenever an analytics, advertising, chat, CAPTCHA, affiliate, or payment-provider SDK is added.
