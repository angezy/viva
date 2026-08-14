# Weluxo Database Architecture

Generated 2026-08-10T18:26:21.247Z. This package contains structure and source-code mapping only; no data rows or secrets are included.

> Deployment state: migration prepared but not applied. Live execution was intentionally withheld because the available safety gate did not permit transactional DDL validation without fresh explicit approval.

## Change summary

| Category | Result |
|---|---|
| Existing tables kept | DashboardSettings, HomeContent_tbl, Notifications, and all unresolved legacy objects |
| Existing tables migrated | Transactional mappings prepared for User_tbl, Products_tbl, CjImportedProducts_tbl, Orders_tbl, tickets, ticket_messages, and ticket_events |
| Existing tables deprecated | MostChosenProducts is a derived-view candidate; no object is deleted |
| New tables prepared | 59 total (24 Commerce, 18 ERP, 16 CRM, 1 dbo) |
| New columns prepared | 635 |
| Explicit indexes prepared | 71 |
| Foreign keys prepared | 101 parsed relationships |
| Constraints | PK, unique, check, FK, defaults, journal balance and posted-entry protections |
| API endpoints | GET /api/admin/overview; GET /api/admin/records/:area |
| Admin pages | Overview, Orders, Finance, Suppliers, Marketing, Loyalty; sidebar updated |
| Dashboard cards | 18 documented KPI groups covering all required cards |

## Validation performed

- Backend JavaScript syntax checks: passed.
- Targeted frontend ESLint: passed.
- Next.js optimized production build: passed (60+ routes generated).
- Static migration scan: no DROP TABLE, TRUNCATE TABLE, DELETE FROM, FLOAT, MONEY, or SMALLMONEY statements; one explicit transaction with TRY/CATCH rollback behavior.
- Live SQL dry-run: not performed; safety gate rejected DDL execution even with forced rollback.
- Live data consistency: pending deployment to a non-production clone or explicit authorization for the target database.

## Deployment report status

No database object was created, altered, deleted, or populated during this documentation/application phase. Migration application and post-migration reconciliation remain pending.
