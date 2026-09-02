# Weluxo Security Completion Report

Date: 2026-08-23  
Scope: all items in `Weluxo Remaining Security Work`

## Executive result

All repository changes that can be completed safely without access to Weluxo's database clone, Stripe test account, malware-scanner service, and deployed edge have been implemented. The application is not declared production-ready yet: the live database concurrency/IDOR suite, legacy-file migration, ClamAV integration check, and external edge tests must run in the authorized staging environment before checkout deployment.

No known P0 code issue remains. Backend unit/static tests pass, frontend lint is clean with the deferred React compiler rules re-enabled, the Next production build passes, and both npm audits report zero vulnerabilities.

## Completed controls

### Durable schema and least privilege

- Added migration `011_security_completion.sql` for revocable sessions, durable carts, upload quarantine metadata, security events, explicit refund inventory decisions, and compatibility-safe storefront tables.
- Removed active route-path `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` behavior. Runtime checks now fail with a migration-required error.
- Added a guarded, ordered migration runner using a separate `MIGRATION_DB_*` identity.
- Added `database/production_app_role.sql` to grant application DML while explicitly denying DDL/control permissions.

### Sessions and authorization

- JWTs now carry random JTIs backed by `Security.AuthSessions`; every protected backend request checks current durable session state.
- Logout, password change/reset, email change, role/restriction changes, account disable, and deletion revoke sessions.
- Frontend admin authorization validates the backend session store instead of trusting a locally valid copied JWT.
- Ownership predicates and parameter binding cover customer addresses, orders/tracking, tickets/messages/attachments, saved products, and checkouts.

### Commerce integrity

- Customer and guest carts, coupon state, and saved guest items now use serialized database transactions in `Commerce.DurableCartStates`.
- Production process-memory cart/payment/order authority was removed. Development now has an explicit compatibility fallback when migration 011 is absent so an existing local database does not take the app offline; production still fails closed.
- Legacy checkout is disabled. Order creation requires a paid durable checkout; the browser redirect alone cannot create an order.
- Stripe signatures, timestamps, event IDs, payload hashes, durable event idempotency, amount/currency verification, reservation consume/release, and order claims are enforced.
- Refunds create a review-required record. An authenticated admin must choose an idempotent `Restocked` or `NoRestock` decision; restocking is refused for unsupported fulfillment states.

### Uploads and malware controls

- Support uploads land in private quarantine, pass signature checks and malware scanning, then move to private support storage.
- Production fails closed if ClamAV is absent or unavailable. Scan verdict, hash, owner, ticket, and storage metadata are durable.
- Downloads require an active customer/admin session, ticket ownership, a clean/migrated verdict, and a safe generated filename.
- Legacy public files are no longer served merely because they exist: `/uploads` now permits only database-referenced public site assets.
- Added guarded legacy-support migration and orphan-reconciliation scripts. Both default to dry-run and avoid logging filenames.

### Browser, edge, and telemetry controls

- Next uses a per-response CSP nonce. Executable script no longer allows `unsafe-inline`; CSP report-only rollout is available and violations are stored as secret-safe events.
- MUI/Emotion/TinyMCE runtime styles still require style `unsafe-inline`; this is not executable-script permission.
- Exact origins, trusted proxy CIDRs, HSTS, no-store API responses, bounded bodies, CSRF origin checks, and database-backed rate limiting are enforced in application code.
- Structured audit events cover sessions, admin mutations, rate-limit failures/blocks, Stripe invalid/replayed/failed events, CSP reports, and refund inventory decisions.

### Dependencies and frontend quality

- `mssql` is 12.7.0 and Multer is 2.2.0.
- Express remains on the maintained 4.x line (4.22.2 installed) because the installed Apollo adapter is explicitly `@as-integrations/express4`; an Express 5 move is intentionally a separate compatibility migration.
- Internal navigation and eligible image lint findings were fixed.
- `react-hooks/set-state-in-effect`, `react-hooks/refs`, and `react-hooks/purity` are re-enabled; lint passes with zero findings.

## Verification evidence

| Check | Result |
|---|---|
| Backend JavaScript syntax (`node --check`) | Pass |
| Backend Node test suite | 14 pass, 0 fail, 6 environment-gated DB tests skipped |
| Frontend ESLint | Pass, 0 errors/warnings |
| Next.js 16.3.2 production build | Pass, 25 static-generation units and all routes compiled |
| Backend npm audit | 0 vulnerabilities |
| Frontend npm audit | 0 vulnerabilities |
| Migration runner plan | Pass; migrations 001-011 ordered |
| Active route-path DDL static assertion | Pass |

The six skipped tests are not waived. They require `SECURITY_TEST_DB=true` and `ALLOW_SECURITY_DB_TESTS=true`, and refuse to run unless `DB_DATABASE` contains `test`, `staging`, `security`, or `clone`. They cover schema presence, immediate session revocation, durable-cart serialization, stock=1 contention, webhook uniqueness, and Customer A/B plus injection-shaped identifiers.

## Required deployment gates

1. Restore a recent database backup into a named staging/clone database.
2. Run the ordered migrations with the deployment-only identity, then run the database integration suite.
3. Seed and run the full Stripe duplicate/delayed/out-of-order fixture matrix; inspect event ledger, checkout, reservation, and order baselines.
4. Run the support attachment migration dry-run, review counts, apply it, test anonymous/A/B access, then run orphan cleanup dry-run.
5. Verify the configured ClamAV worker with isolated EICAR and malformed document/archive fixtures.
6. Deploy CSP in report-only mode first, verify Stripe/TinyMCE flows, then enforce.
7. Test Cloudflare/load-balancer origin restriction, exact proxy CIDRs, hostile Host/Origin and spoofed forwarded headers, TLS redirect/HSTS, and authenticated cache bypass from outside the origin network.
8. Connect `Integration.SecurityEvents` thresholds to the production SIEM/on-call service and set retention/access policy.

Until gates 1-7 pass, secure checkout deployment remains blocked. These actions require infrastructure/account authority and were not simulated or falsely marked as passed in this local workspace.
