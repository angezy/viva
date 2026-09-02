# Weluxo Database Architecture

Generated 2026-08-10T18:26:21.247Z. This package contains structure and source-code mapping only; no data rows or secrets are included.

> Deployment state: migration prepared but not applied. Live execution was intentionally withheld because the available safety gate did not permit transactional DDL validation without fresh explicit approval.

## Architecture

- Commerce: 24 tables for catalog, orders, checkout, shipping, and supplier network.
- ERP: 18 tables for legal entities, ledger, AR/AP, payments, banking, expenses, and tax.
- CRM: 16 tables for customers, marketing, support, and loyalty.
- Operational: 1 migration-history table.

## Design decisions

- Existing objects are preserved; migration is additive and idempotent.
- Primary identifiers are UNIQUEIDENTIFIER with NEWSEQUENTIALID defaults; human references remain separate.
- Financial values use DECIMAL(19,4), rates use DECIMAL(19,8), currencies CHAR(3), and countries CHAR(2).
- Customer lifetime metrics are derived from Commerce.Orders instead of duplicated in CRM.Customers.
- Supplier integrations are represented generically, not as platform-level special cases.
- Posted journal entries are protected by triggers and corrected through reversal entries.
- Overview access requires an authenticated administrator and excludes passwords, secrets, tokens, raw PII, and payment-card data.

## Planned structure totals

- Tables: 59
- Columns: 635
- Foreign-key relationships: 101
- Explicit indexes: 71

## Application deliverables

- GET /api/admin/overview: secured real-time KPI aggregation.
- GET /api/admin/records/:area: secured drill-down rows for orders, finance, suppliers, marketing, and loyalty.
- /dashboard/Overview: live filtered Overview; /dashboard redirects there.
- Drill-down pages: orders, finance, suppliers, marketing, loyalty, plus existing products, users, and support pages.

## Required deployment checks

1. Back up the target database.
2. Run the migration in a non-production clone and reconcile legacy row counts.
3. Apply to Weluxo only after explicit authorization.
4. Run order/payment/refund/journal/invoice/supplier reconciliation.
5. Compare each dashboard card with the identically filtered detail endpoint.
