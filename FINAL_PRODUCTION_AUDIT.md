# Final Production Audit

Date: 2026-08-24  
Repository: viva  
Auditor: senior-engineering production-readiness review

## Verdict

**NOT READY FOR PRODUCTION**

No confirmed P0 issue was found in the inspected source, and the local static/security suite is strong. Release approval is still blocked by unverified database behavior, an inconsistent payment-authority contract, an unsuccessful local backend startup smoke check, and unverified production integrations/configuration. These are release gates for a commerce application; they cannot be closed safely without an isolated database and explicitly approved non-production provider environments.

No production database, payment provider, webhook, Telegram, email, OAuth, or other external service was called during this review.

## Scope and repository map

The repository contains:

- bend: Express backend, MSSQL access, REST routes, Stripe hosted Checkout, cookie/JWT sessions, uploads, Telegram/SendPulse/Google/CJ integrations, and optional GraphQL.
- fend: Next.js 16.3.2 App Router frontend, same-origin backend proxy, account/checkout/support/admin surfaces, SEO metadata, and dashboard.
- database: canonical MSSQL schema/migrations, including security and durable checkout migrations 008 through 012.
- scripts and docs: migration helpers, seed/architecture helpers, security reports, and deployment runbooks.

The worktree was already substantially dirty before this review, including changes under bend, fend, database, docs, and tracked node_modules content. Existing changes were preserved; no reset, checkout, broad cleanup, or unrelated rewrite was performed.

## Commands and results

| Check | Result |
|---|---|
| git status --short --branch | Dirty worktree on master tracking origin/master; preserved |
| npm test --prefix bend | PASS; 14 passed, 0 failed, 6 skipped |
| npm run lint --prefix fend | PASS; exit 0 |
| npm run build --prefix fend | PASS; Next 16.3.2; TypeScript passed; 25/25 static pages generated |
| npm audit --audit-level=high --json | PASS after targeted remediation; 0 vulnerabilities |
| npm audit --audit-level=high --json --prefix bend | PASS; 0 vulnerabilities |
| npm audit --audit-level=high --json --prefix fend | PASS; 0 vulnerabilities |
| npm install concurrently@9.2.4 --save-dev --package-lock-only --ignore-scripts | PASS; root dependency remediation only |
| npm start --prefix bend | BLOCKED for smoke testing; process produced no startup output and did not open the expected local port 5000, then was stopped |
| Database integration tests | BLOCKED; six tests skipped by their explicit safety guard |
| Database migration apply/verify | NOT RUN; no isolated named test/staging/clone database was authorized |
| Payment, webhook, email, OAuth, Telegram, scanner, and CJ calls | NOT RUN |

The six skipped database tests cover migration presence, durable session revocation, concurrent cart mutation, stock=1 reservation contention, duplicate webhook ledger behavior, and customer A/B ownership/injection baselines. The skip guard requires SECURITY_TEST_DB=true and ALLOW_SECURITY_DB_TESTS=true against an explicitly named test/staging/clone database.

## Safe fixes applied

Only verified, narrowly scoped fixes were made:

- fend/src/app/components/support/SupportTicketConversation.js
  - Sanitizes both loaded and newly returned support-message HTML through the existing CMS policy before rendering.
  - Escapes text-only fallback content.
- fend/src/app/components/support/AdminTicketView.js
  - Applies the same sanitization to admin-visible support messages.
- fend/src/app/dashboard/products/page.js
  - Removes the hardcoded Wireless Headphones, Smart Watch, and Portable Speaker fallback catalog.
  - API failure now produces an empty/error state instead of allowing admin edits/deletes against demo data.
  - Adds accessible labels to edit/delete icon buttons.
- fend/src/app/components/CookieConsentBanner.js
  - Corrects the necessary-cookie label contrast on the white settings panel.
- package.json and package-lock.json
  - Updates root dev dependency concurrently from the vulnerable resolved 9.2.3 line to patched 9.2.4.
  - No application runtime dependency was changed.

## Findings

### P0 — Critical

None confirmed from static inspection and the runnable test suite.

### P1 — High

#### P1-001 — Payment authority is internally inconsistent

Evidence:

- bend/routes/homeroute.js, POST /api/payment/confirm, retrieves the Stripe Checkout Session server-side and calls markDurableCheckoutPaid when Stripe reports payment_status=paid.
- The same route records payment_confirmed before the webhook is necessarily processed.
- bend/routes/homeroute.js, POST /api/orders/create, rejects unless the durable checkout has payment_status=Paid and reports that webhook confirmation is required.
- bend/routes/stripeWebhookRoute.js also marks the durable checkout Paid and consumes reservations from signed, idempotently-ledgered Stripe events.

This means the code has two apparent authorities: a browser-return/server-to-Stripe confirmation path and a signed webhook path. The provider lookup is server-side and performs owner, amount, currency, and durable-checkout checks, but the code’s own response text and comments state that webhook confirmation is required. The intended authority must be made explicit and covered by integration tests for delayed, duplicate, reordered, failed, refunded, and asynchronous payments.

Status: unresolved; requires payment design approval and an isolated Stripe test-mode plus database test environment. No payment code was changed during this audit.

#### P1-002 — Database concurrency, ownership, and migration readiness are unverified

The six database-backed tests were skipped. No MSSQL migration was applied or verified against a disposable named clone. Therefore this review cannot claim that:

- migration 011 security objects and migration 012 checkout-return objects exist in the target schema;
- session revocation is durable under the real schema;
- two simultaneous stock=1 reservations produce one winner;
- concurrent cart mutations serialize correctly;
- duplicate webhook events produce one ledger row;
- cross-customer ownership and injection-shaped identifiers preserve baselines.

Status: release blocker. Run the guarded suite against a disposable restored clone, record the database identity, apply/verify migrations there, and retain the results.

#### P1-003 — Backend production-like startup smoke test did not complete

The local backend start command did not emit startup output or bind the expected local port 5000 during the controlled attempt. It was stopped without issuing API requests. This leaves route registration, environment loading, DB initialization, and startup dependency behavior unverified.

Status: release blocker until reproduced and diagnosed in an approved non-production environment. Do not use production credentials to debug this.

### P2 — Medium

#### P2-001 — Forward-only migration process has no tested rollback automation

The newer migration runner requires explicit migration identity and, for production, backup/restore confirmation. The repository does not provide a matching down-migration set or automated rollback scripts for migrations 008–012. The older scripts/run_weluxo_migration.js is a separate legacy helper with insecure-looking connection defaults (encrypt false and trustServerCertificate true) and should not be used for production deployment.

Required control: use the guarded bend migration runner, take and verify a restorable backup or clone, apply one migration batch at a time, run schema/consistency checks, and document a restore plan before production.

#### P2-002 — CMS-controlled links and rich content need a complete policy audit

The existing sanitizeCmsHtml policy protects support/blog HTML, and the fixed support renderers now use it consistently. Other admin-controlled content and href fields remain a broad review area. Validate URL schemes, prevent open redirects, and ensure every rich-text sink uses the same allowlist. This is especially important for footer, header, legal, help, and dashboard-managed content.

#### P2-003 — Hardcoded canonical domain in structured data

fend/src/app/components/LegalStructuredData.js contains a hardcoded https://weluxo.com origin while site settings and deployment base URLs are configurable elsewhere. This can produce incorrect structured-data URLs in staging, previews, or a differently configured production domain. Make the canonical origin a validated deployment setting and test generated JSON-LD.

#### P2-004 — Production integrations and malware scanning were not exercised

The source includes guarded configuration for Stripe, ClamAV, SendPulse, Google OAuth, Telegram, and CJ. Static tests cover fail-closed scanner behavior and webhook signature logic, but no live non-production integration checks were run. Verify timeout, retry, outage, idempotency, secret rotation, and observability behavior with test credentials and test endpoints.

#### P2-005 — No browser-level accessibility, checkout, or cross-browser smoke suite was run

Next build and ESLint pass, but no browser session was authorized/available for end-to-end account, checkout return, support upload, cookie-consent, admin, or mobile keyboard testing. Add a non-production browser suite covering focus order, labels, contrast, error recovery, CSRF/session expiry, and payment return states.

### P3 — Low

- fend/data/items.json contains sample-looking legacy data and should be removed or clearly marked if it is not an intentional fixture.
- Legacy checkout/client artifacts remain in the tree even though the backend legacy checkout endpoint is explicitly disabled; remove or quarantine after confirming no supported consumer needs them.
- README and older migration/documentation helpers should be reconciled with the current Next.js/security-migration architecture.

## Security review checklist

| Area | Assessment |
|---|---|
| Authentication/session | Strong static controls: HS256 JWT validation, jti/session records, revocation/expiry checks, fingerprint and role checks; DB durability not integration-tested |
| Cookies/CSRF/CORS | HttpOnly cookie options, production Secure behavior, same-site policy, exact-origin checks, and CSRF controls present; live browser verification pending |
| Headers/CSP | CSP nonce path and security headers present; tests pass |
| Authorization/IDOR | Ownership predicates and admin origin checks present; DB-backed tests skipped |
| SQL/injection | Parameterized request patterns and bounded integer checks present; live schema/concurrency unverified |
| Payments | Hosted Stripe Checkout, signed webhook verification, replay ledger, amount/currency/owner checks present; authority contract requires resolution |
| Inventory/order integrity | Durable checkout/reservations and order claim gates present; concurrency tests skipped |
| Uploads | Whitelist, size/type checks, EICAR rejection, digesting, and fail-closed scanner behavior covered statically |
| Rate limiting | DB-backed limiter and key hashing controls present; deployment/load behavior unverified |
| Telemetry | Security-event metadata redaction tests pass; alert routing/retention not verified |
| Secrets | No secret values were printed or copied into the report; production secret rotation/storage not verified |
| SEO | robots/sitemap/metadata routes exist; canonical structured-data origin issue remains |
| Accessibility/performance | Build/lint pass; no browser accessibility or production performance budget run |
| Deployment | Guarded migration runner and production app-role DDL denies exist; startup, backup/restore, health, and rollback drills pending |

## Database and migration status

Migrations 008 through 012 and production_app_role.sql were inspected. The application role denies DDL, HTTP request code contains no active DDL according to the passing test, and the newer runner has explicit migration safety gates. No migration was applied by this audit, and no production schema was touched.

Rollback status: forward-only in the repository; no tested down migrations. The safe rollback is restore/clone-based until a migration-specific rollback plan is authored and rehearsed.

## Environment configuration reviewed

Only variable names were recorded; no values were printed:

Database and runtime:
DB_SERVER, DB_USER, DB_PASSWORD, DB_DATABASE, PORT, NODE_ENV, DB_POOL_MAX, DB_POOL_MIN, DB_POOL_IDLE_TIMEOUT_MS, DB_CONNECTION_TIMEOUT_MS, DB_REQUEST_TIMEOUT_MS, DB_ENCRYPT, DB_TRUST_SERVER_CERTIFICATE

Security and origin:
JWT_SECRET, CHAT_SESSION_SECRET, RATE_LIMIT_KEY_SECRET, SESSION_FINGERPRINT_SECRET, SECURITY_EVENT_KEY_SECRET, COOKIE_DOMAIN, FRONTEND_URL, CORS_ORIGINS, TRUST_PROXY_CIDRS, JSON_BODY_LIMIT, CSP_REPORT_ONLY

Migrations and test gates:
ALLOW_SCHEMA_MIGRATIONS, MIGRATION_IDENTITY_CONFIRMED, BACKUP_RESTORE_CONFIRMED, SECURITY_TEST_DB, ALLOW_SECURITY_DB_TESTS

Payments:
PAYMENT_PROVIDER, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CHECKOUT_CURRENCY, MAX_CART_QUANTITY, APP_BASE_URL

Uploads/scanning:
CLAMAV_MODE, CLAMAV_HOST, CLAMAV_PORT, CLAMAV_TIMEOUT_MS

External integrations:
SENDPULSE_CLIENT_ID, SENDPULSE_CLIENT_SECRET, SENDPULSE_ADDRESS_BOOK_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_WEBHOOK_URL, CJ_API_KEY, CJ_EMAIL, CJ_ACCESS_TOKEN, CJ_BASE_URL

Frontend/features:
BACKEND_URL, SITE_URL, GRAPHQL_ENABLED, CHAT_ENABLED, CHAT_SESSION_COOKIE, CHAT_SESSION_TTL_SECONDS

Password reset and related controls were also present in the templates; their exact names should be taken from the deployment template during release preparation rather than copied from runtime values.

## Release checklist

- [x] Backend unit/static security suite has no failures.
- [x] Frontend ESLint passes.
- [x] Frontend production build passes.
- [x] Root, backend, and frontend high-severity dependency audits are clean after the targeted concurrently update.
- [x] No secret values were printed.
- [x] No production database or external provider was called.
- [ ] Resolve and test one authoritative payment state transition.
- [ ] Apply and verify migrations against a disposable named database clone.
- [ ] Run all six skipped database/concurrency/ownership tests.
- [ ] Diagnose backend startup and complete authenticated/non-authenticated smoke tests.
- [ ] Verify Stripe, ClamAV, SendPulse, Google OAuth, Telegram, and CJ in non-production.
- [ ] Rehearse backup/restore and the forward-only migration rollback procedure.
- [ ] Run browser accessibility, checkout, upload, mobile, and session-expiry smoke tests.
- [ ] Validate configurable canonical URL and CMS URL/HTML policy.
- [ ] Obtain an explicit release approval after all P1 items are closed.

## Safest next action

Provision or restore a disposable, explicitly named MSSQL test clone and run the guarded migration verification plus all six skipped database tests with test-only credentials. In parallel, obtain payment-design approval on whether signed webhook processing or server-to-provider confirmation is the authoritative paid transition. Do not point these checks at production and do not enable schema migration flags in production until the backup/restore drill is complete.
