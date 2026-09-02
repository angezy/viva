# Reusable store installation and authorization

This document is the installation contract for a new store. The application uses the configured MSSQL database as its only data store; it does not restore, clone, or copy a production database.

## 1. Audit summary

The repository contains:

- `bend/`: Express 4, Apollo/GraphQL (disabled by default), MSSQL, bcrypt, JWT, cookie sessions, upload handling, checkout, support, supplier integrations, and dashboard APIs.
- `fend/`: Next.js dashboard and storefront. `/api/[...path]` proxies browser API calls to the backend without exposing `BACKEND_URL`.
- `scripts/create_database.sql`: the legacy-compatible base schema.
- `database/migrations/001–021`: additive canonical Commerce, CRM, ERP, Integration, Security, RBAC, and customer email automation migrations.
- `database/seeds/seed-system.sql`: production-safe structural/reference seed.

The legacy base tables are `dbo.Products_tbl`, `dbo.CjImportedProducts_tbl`, `dbo.Comments`, `dbo.footer_tbl`, `dbo.head_tbl`, `dbo.header_tbl`, `dbo.Orders_tbl`, `dbo.ProductAddress_tbl`, `dbo.ProductImages_tbl`, `dbo.ProductVideos_tbl`, and `dbo.User_tbl`. Its views are `dbo.homePage_view` and `dbo.MostChosenProducts`. The canonical migrations add catalog, categories, variants, customers, orders, order items, addresses, payments, refunds, shipments, supplier records, CRM/support, checkout, carts, upload quarantine, rate limits, webhook ledgers, security events, and compatibility views.

Primary keys, foreign keys, unique constraints, indexes, defaults, and check constraints remain defined by the existing foundation/migrations. The repository's exported SQL Server metadata reports no user stored procedures or triggers. The old `bend/TMp/clonedb.sql` is not referenced by bootstrap or application startup and must not be used for installation.

Authentication is bcrypt password verification plus HS256 JWTs recorded in `Security.AuthSessions`. Existing `admin` and `user` claims are accepted for compatibility; runtime policy normalizes them to `admin` and `customer`. New sessions use `owner`, `admin`, or `customer`.

## 2. Roles and permissions

| Role | Permissions |
| --- | --- |
| `owner` | All current permissions and future permissions by default. This is the only role allowed to manage store configuration, staff, roles, products, finances, payments, refunds, integrations, content, and security-sensitive operations. |
| `admin` | `dashboard.view`, `orders.read`, `orders.update`, `tickets.read`, `tickets.reply`, `tickets.update`, `users.read`. It is an operational employee role. |
| `customer` | No staff/dashboard permissions. Legacy `user` maps to this role. |

The permission catalog is stored in `Security.Permissions` and role mappings in `Security.RolePermissions`. Backend middleware in `bend/utils/rbac.js` is authoritative; frontend visibility is only a usability feature.

## 3. Dashboard route matrix

| Frontend path | Permission | Admin |
| --- | --- | --- |
| `/dashboard` | `dashboard.view` | Redirects to `/dashboard/orders` |
| `/dashboard/orders` and descendants | `orders.read` | Allowed |
| `/dashboard/tikects` and descendants | `tickets.read` | Allowed |
| `/dashboard/user` and descendants | `users.read` | Allowed; customer/staff mutations are owner-only |
| `/dashboard/Overview` | `analytics.read` | 403 access-denied state |
| `/dashboard/products` | `products.read` | 403 access-denied state |
| `/dashboard/finance` | `finance.read` | 403 access-denied state |
| `/dashboard/suppliers` | `suppliers.read` | 403 access-denied state |
| `/dashboard/integrations`, `/dashboard/api-products`, `/dashboard/cj-sandbox` | `integrations.manage` | 403 access-denied state |
| `/dashboard/Settings`, `/dashboard/pageEditor`, `/dashboard/blogManager`, `/dashboard/marketing`, `/dashboard/coupons`, `/dashboard/loyalty`, `/dashboard/reviews`, and other owner areas | matching manage/read permission | 403 access-denied state |

Owner sees the full menu. Admin sees only Dashboard, Orders, Users, and Support Tickets. A direct URL does not grant access.

## 4. Backend/API matrix

| API family | Required permission |
| --- | --- |
| `GET /api/admin/overview` | `analytics.read` |
| `GET /api/admin/records/orders`, `GET /api/admin/orders/:id` | `orders.read` |
| `GET /api/admin/records/finance` | `finance.read` |
| `GET /api/admin/records/suppliers` | `suppliers.read` |
| `GET /api/admin/records/marketing` | `marketing.read` |
| `GET /api/admin/records/loyalty` | `loyalty.read` |
| `GET /api/dashboard/orders` | `orders.read` |
| `GET /api/dashboard/users` | `users.read`; employee sessions receive customer rows only |
| `PATCH/DELETE /api/dashboard/users/:id`, `POST /api/register/admin` | `staff.manage` (owner only) |
| `GET/POST/PATCH /api/support/admin/tickets*` | `tickets.read`, `tickets.reply`, or `tickets.update` |
| `POST /api/support/tickets/:id/messages` | Customer ownership or `tickets.reply` |
| `GET/POST/PATCH /api/dashboard/coupons*` | `coupons.manage` |
| `/api/products*` | `products.read` for reads; `products.manage` for mutations |
| `/api/cj/*` | `integrations.manage` |
| `/api/dashboard/integrations*` | `integrations.manage` |
| `/api/dashboard/settings*` | `settings.manage` |
| `/api/dashboard/profile`, `/api/dashboard/notifications*` | `profile.read` or `notifications.manage` (owner only) |
| `GET /api/dashboard/stats` | `analytics.read` (owner only) |
| `/api/dashboard/checkouts/:id/refund-inventory` | `refunds.manage` |
| `/api/admin/reviews*` | `reviews.manage` |

Unauthenticated requests receive `401`. An authenticated staff user without the required permission receives `403`. Order details intentionally omit payments, invoices, and refunds for an operational admin session.

## 5. Fresh installation

1. Create an empty MSSQL database and a deployment identity. Do not point the command at an existing production database unless performing the documented migration path.
2. Copy `.env.example` to `.env` or configure `bend/.env`. Set database values, `JWT_SECRET`, `SESSION_FINGERPRINT_SECRET`, `RATE_LIMIT_KEY_SECRET`, and `SECURITY_EVENT_KEY_SECRET` to long random values.
3. Set the controlled-run gates only for the migration job:

```env
ALLOW_SCHEMA_MIGRATIONS=true
MIGRATION_IDENTITY_CONFIRMED=true
INITIAL_OWNER_EMAIL=owner@example.com
INITIAL_OWNER_PASSWORD=<12-or-more-character-password>
INITIAL_OWNER_USERNAME=owner
```

4. Run:

```bash
npm run db:bootstrap
npm run owner:bootstrap
npm run start
npm run start:frontend
```

`db:bootstrap` uses `MIGRATION_DB_*` when supplied, falls back to `DB_*`, creates the legacy-compatible foundation only when the target is empty, applies migrations `001–021` in numeric order, records applied migrations, and runs only `seed-system.sql`. `owner:bootstrap` bcrypt-hashes the configured password, inserts one owner only when no owner exists, and is safe to run again. It never prints credentials and never overwrites an existing owner.

For SQLCMD/SSMS, `database/bootstrap.sql` is the equivalent ordered artifact. Run it from the repository root against the empty target database with `-d <configured-database>`.

## 6. Seed policy

Production bootstrap inserts only structural tables and minimal system defaults (`emailNotifications=true` and `darkMode=false`). It does not insert customers, staff, orders, order items, payments, addresses, tickets, chat messages, audit history, uploads, Stripe/CJ transaction records, real coupons, sessions, refresh/API tokens, or demo reviews/products. The old known-password admin fixture and Weluxo demo catalog were removed from the legacy seed entrypoint.

`database/seeds/seed-dev.sql` is deliberately empty until a developer adds clearly fake fixtures. If fixtures are added, run that file only against a separately named development/test database.

## 7. Existing installation migration

Do not promote every existing admin. First inspect the user list and decide which account is the business owner. Back up the existing database according to the operator's normal change policy, apply the migrations, then run:

```bash
ALLOW_SCHEMA_MIGRATIONS=true MIGRATION_IDENTITY_CONFIRMED=true npm run db:bootstrap
ALLOW_OWNER_MIGRATION=true MIGRATION_IDENTITY_CONFIRMED=true npm run owner:promote -- --email selected-owner@example.com
```

On PowerShell, set the variables with `$env:NAME='value'` before each command. `promote_owner.js` requires the explicit email, refuses to guess, refuses to run when an owner already exists, updates only that account, and revokes its old sessions. Verify owner sign-in before changing any other staff roles. The last owner cannot be demoted or deleted.

## 8. Verification commands

```bash
npm --prefix bend test
npm --prefix fend run lint
npm --prefix fend run build
git diff --check
```

The MSSQL integration suite is opt-in and must use a separately named test/staging/clone database with `SECURITY_TEST_DB=true` and `ALLOW_SECURITY_DB_TESTS=true`. Never point it at a production database.
