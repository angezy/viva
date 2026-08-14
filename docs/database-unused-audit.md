# Weluxo Database Architecture

Generated 2026-08-10T18:26:21.247Z. This package contains structure and source-code mapping only; no data rows or secrets are included.

> Deployment state: migration prepared but not applied. Live execution was intentionally withheld because the available safety gate did not permit transactional DDL validation without fresh explicit approval.

## Existing/legacy disposition

| Object | Status | Evidence-based action |
|---|---|---|
| dbo.DashboardSettings | KEEP | Existing application settings table; retained and outside business-domain migration. |
| dbo.HomeContent_tbl | KEEP | Existing content-management table; retained and outside business-domain migration. |
| dbo.Notifications | KEEP | Existing application notification table; retained. |
| dbo.User_tbl | MIGRATE | Map customer-role rows to CRM.Customers; keep compatibility object/legacy table until all code consumers move. |
| dbo.Products_tbl | MIGRATE | Map catalog rows to Commerce.Products/ProductVariants; keep compatibility until storefront consumers move. |
| dbo.CjImportedProducts_tbl | MIGRATE | Map CJ as Commerce.Suppliers plus Commerce.SupplierProducts. |
| dbo.Orders_tbl | MIGRATE | Map order headers/items into Commerce.Orders and Commerce.OrderItems. |
| dbo.ProductAddress_tbl / ProductImages_tbl / ProductVideos_tbl | REVIEW | Legacy product ancillary tables require row-level mapping after canonical product IDs exist. |
| dbo.tickets / ticket_messages / ticket_events | MIGRATE | Map support history to CRM.Tickets, CRM.TicketMessages, CRM.TicketEvents. |
| dbo.checkout_attempts / OrderTrackingEvents_tbl | MIGRATE | Map to Commerce.CheckoutAttempts and Commerce.TrackingEvents after legacy key verification. |
| dbo.MostChosenProducts | DEPRECATE | Derived concept; replace with live OrderItems aggregation after consumer migration. |
| dbo.Comments / footer_tbl / head_tbl / header_tbl | REVIEW | Content/review concepts are outside this three-domain migration and must not be deleted automatically. |

## Automated findings

- The live metadata snapshot found only dbo.DashboardSettings, dbo.HomeContent_tbl, and dbo.Notifications in the configured Weluxo database; repository SQL references substantially more legacy objects. This mismatch requires environment/connection verification before production migration.
- Legacy tables generally have no declared foreign keys in the captured database metadata; relationships are implied by naming and application queries. Marked REVIEW/MIGRATE, never auto-deleted.
- The old /dashboard/Overview and /dashboard contained hard-coded KPI arrays and simulated loading. They were replaced with /api/admin/overview data; targeted lint and production build pass.
- Newly planned business columns have consumers documented in database-data-usage.md; internal IDs/audit/security fields intentionally remain absent from Overview.
- Compatibility views are created only when the equivalent legacy table is absent, avoiding duplicate object names.
- SAFE_TO_REMOVE_AFTER_APPROVAL: none. Row reconciliation and a full production usage trace are required before any legacy removal.

## Remaining review items

- Confirm the configured database is the intended production Weluxo instance.
- Validate legacy column variants and row counts in a restored/non-production clone.
- Migrate remaining backend/storefront repositories from dbo compatibility objects to canonical schemas.
- Verify existing product/user/support pages honor every query-string filter used by dashboard links.
