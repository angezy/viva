# Weluxo Database Architecture

Generated 2026-08-10T18:26:21.247Z. This package contains structure and source-code mapping only; no data rows or secrets are included.

> Deployment state: migration prepared but not applied. Live execution was intentionally withheld because the available safety gate did not permit transactional DDL validation without fresh explicit approval.

## Table-level usage map

| Table | Business purpose | Write source | Read consumers | Admin/dashboard/report/API |
|---|---|---|---|---|
| dbo.WeluxoMigrationHistory | Idempotent migration application audit. | Migration runner | Migration runner and database operations | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.Products | Canonical sellable product catalog. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ProductVariants | SKU-level pricing, cost, weight, and availability. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.Categories | Hierarchical storefront product classification. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ProductCategories | Product-to-category membership. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ProductImages | Ordered product and variant imagery. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ProductVideos | Ordered product and variant video media. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ProductAttributes | Reusable product attribute definitions. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ProductAttributeValues | Typed attribute values assigned to products or variants. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.Customers | Canonical customer identity and CRM status. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.Orders | Canonical customer order header and financial totals. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.OrderItems | Immutable product, price, tax, cost, and supplier snapshots per order. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.OrderStatusHistory | Auditable order status transitions. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.OrderAddresses | Billing and shipping snapshots captured with an order. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.Carts | Active and historical shopping carts. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.CartItems | Products and quantities held in a cart. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.CheckoutAttempts | Checkout/payment-attempt progress and failure diagnostics. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ShippingMethods | Available shipping services and prices. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.Suppliers | Supplier master records for integrated fulfillment partners. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.Shipments | Order fulfillment packages and tracking identity. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.ShipmentItems | Order-item quantities allocated to shipments. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.TrackingEvents | Carrier shipment event timeline. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.SupplierProducts | Supplier-to-catalog mappings, cost, inventory, and sync status. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.SupplierOrders | Purchase/fulfillment orders sent to suppliers. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.SupplierOrderItems | Supplier-order cost and quantity lines. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| Commerce.SupplierSyncLogs | Operational supplier synchronization outcomes. | Commerce services and legacy migration | Storefront or commerce admin, commerce API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| ERP.Companies | Legal entities used by accounting. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.FiscalYears | Accounting year boundaries and status. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.FiscalPeriods | Accounting periods and close state. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.Accounts | Company chart of accounts. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.CostCenters | Hierarchical management-accounting dimensions. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.JournalEntries | General-ledger transaction headers. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.JournalLines | Balanced debit and credit postings. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.Invoices | Customer accounts-receivable documents. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.InvoiceItems | Invoice detail lines. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.SupplierBills | Supplier accounts-payable documents. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.Payments | Incoming and outgoing payment movements. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.Refunds | Refunds linked to payments and orders. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.BankAccounts | Masked company bank-account metadata. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.BankTransactions | Imported bank movements and reconciliation state. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.ExpenseCategories | Expense classification mapped to ledger accounts. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.Expenses | Operating expense records. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.TaxRates | Jurisdictional tax definitions. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| ERP.TaxTransactions | Tax amounts sourced from business documents. | ERP services and legacy migration | Finance admin, accounting reports, secured admin API | Admin detail pages; dashboard where listed; secured APIs; financial reports |
| CRM.CustomerAddresses | Reusable customer addresses. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CustomerPreferences | Language, currency, and channel consent preferences. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CustomerNotes | Internal CRM notes. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CustomerTags | Reusable customer labels. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CustomerTagAssignments | Customer-to-tag membership. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CustomerSegments | Rule-based or static customer segments. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CustomerSegmentMembers | Materialized segment membership. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.Campaigns | Marketing campaign configuration and budget. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.CampaignEvents | Campaign interactions and attributed orders/revenue. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.Tickets | Customer support cases. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.TicketMessages | Public and internal ticket conversation. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.TicketEvents | Auditable ticket state changes. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.LoyaltyTiers | Loyalty qualification tiers and benefits. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.LoyaltyAccounts | Per-customer loyalty balance. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |
| CRM.LoyaltyTransactions | Immutable loyalty point ledger. | CRM services and legacy migration | CRM/support/marketing admin, related API and dashboard metrics | Admin detail pages; dashboard where listed; secured APIs; operational reporting |

## Column-level usage map

Every planned column is listed below. “Internal” fields are consumed by relationships, security, audit, automation, or calculations and are not exposed merely to satisfy UI traceability.

### dbo.WeluxoMigrationHistory

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| MigrationId | NVARCHAR(120) NOT NULL | Relationship/reference used by WeluxoMigrationHistory processing. Source: dbo write service or migration. | Migration runner and database operations | Yes |
| Description | NVARCHAR(500) NOT NULL | Business attribute used by Idempotent migration application audit.. Source: dbo write service or migration. | Migration runner and database operations | No |
| AppliedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: dbo write service or migration. | Migration runner and database operations | No |

### Commerce.Products

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Products. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| LegacyProductId | INT NOT NULL | Relationship/reference used by Products processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SKU | NVARCHAR(100) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Name | NVARCHAR(255) NOT NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Slug | NVARCHAR(255) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ShortDescription | NVARCHAR(500) NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Description | NVARCHAR(MAX) NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Brand | NVARCHAR(100) NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ProductType | NVARCHAR(50) NOT NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DefaultVariantId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Products processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| IsFeatured | BIT NOT NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsTrending | BIT NOT NULL | Business attribute used by Canonical sellable product catalog.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PublishedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ProductVariants

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ProductVariants. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductVariants processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SKU | NVARCHAR(100) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Barcode | NVARCHAR(100) NULL | Business attribute used by SKU-level pricing, cost, weight, and availability.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| VariantName | NVARCHAR(255) NOT NULL | Business attribute used by SKU-level pricing, cost, weight, and availability.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Weight | DECIMAL(19,4) NULL | Business attribute used by SKU-level pricing, cost, weight, and availability.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| WeightUnit | NVARCHAR(20) NULL | Business attribute used by SKU-level pricing, cost, weight, and availability.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CostPrice | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CompareAtPrice | DECIMAL(19,4) NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SellingPrice | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| AvailableQuantity | DECIMAL(19,4) NOT NULL | Business attribute used by SKU-level pricing, cost, weight, and availability.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| LowStockThreshold | DECIMAL(19,4) NOT NULL | Business attribute used by SKU-level pricing, cost, weight, and availability.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.Categories

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Categories. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ParentId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Categories processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Hierarchical storefront product classification.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Slug | NVARCHAR(255) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Description | NVARCHAR(MAX) NULL | Business attribute used by Hierarchical storefront product classification.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SortOrder | INT NOT NULL | Business attribute used by Hierarchical storefront product classification.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsActive | BIT NOT NULL | Business attribute used by Hierarchical storefront product classification.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ProductCategories

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductCategories processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CategoryId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductCategories processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| IsPrimary | BIT NOT NULL | Business attribute used by Product-to-category membership.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SortOrder | INT NOT NULL | Business attribute used by Product-to-category membership.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ProductImages

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ProductImages. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductImages processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| VariantId | UNIQUEIDENTIFIER NULL | Relationship/reference used by ProductImages processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Url | NVARCHAR(1000) NOT NULL | Business attribute used by Ordered product and variant imagery.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| AltText | NVARCHAR(500) NOT NULL | Business attribute used by Ordered product and variant imagery.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Title | NVARCHAR(255) NULL | Business attribute used by Ordered product and variant imagery.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SortOrder | INT NOT NULL | Business attribute used by Ordered product and variant imagery.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsPrimary | BIT NOT NULL | Business attribute used by Ordered product and variant imagery.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ProductVideos

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ProductVideos. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductVideos processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| VariantId | UNIQUEIDENTIFIER NULL | Relationship/reference used by ProductVideos processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Url | NVARCHAR(1000) NOT NULL | Business attribute used by Ordered product and variant video media.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ThumbnailUrl | NVARCHAR(1000) NULL | Business attribute used by Ordered product and variant video media.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Title | NVARCHAR(255) NULL | Business attribute used by Ordered product and variant video media.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SortOrder | INT NOT NULL | Business attribute used by Ordered product and variant video media.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ProductAttributes

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ProductAttributes. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Reusable product attribute definitions.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Code | NVARCHAR(100) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DataType | NVARCHAR(30) NOT NULL | Business attribute used by Reusable product attribute definitions.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsFilterable | BIT NOT NULL | Business attribute used by Reusable product attribute definitions.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsSearchable | BIT NOT NULL | Business attribute used by Reusable product attribute definitions.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsActive | BIT NOT NULL | Business attribute used by Reusable product attribute definitions.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ProductAttributeValues

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ProductAttributeValues. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductAttributeValues processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| VariantId | UNIQUEIDENTIFIER NULL | Relationship/reference used by ProductAttributeValues processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| AttributeId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ProductAttributeValues processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ValueText | NVARCHAR(MAX) NULL | Business attribute used by Typed attribute values assigned to products or variants.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ValueNumber | DECIMAL(19,8) NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ValueBoolean | BIT NULL | Business attribute used by Typed attribute values assigned to products or variants.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ValueDate | DATETIME2(3) NULL | Business attribute used by Typed attribute values assigned to products or variants.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### CRM.Customers

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Customers. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| LegacyUserId | INT NOT NULL | Relationship/reference used by Customers processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerNumber | NVARCHAR(40) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Username | NVARCHAR(100) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Email | NVARCHAR(255) NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Phone | NVARCHAR(40) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| FirstName | NVARCHAR(120) NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| LastName | NVARCHAR(120) NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| FullName | NVARCHAR(250) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CustomerType | NVARCHAR(30) NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Role | NVARCHAR(50) NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PreferredLanguage | NVARCHAR(10) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PreferredCurrency | CHAR(3) NULL | Currency context for amounts and currency filtering. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| MarketingConsent | BIT NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| EmailVerified | BIT NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| FirstOrderAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| LastOrderAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PasswordHash | NVARCHAR(255) NULL | Internal security, automation, or diagnostic processing; never exposed on Overview. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| AvatarUrl | NVARCHAR(1000) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Bio | NVARCHAR(MAX) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Country | NVARCHAR(100) NULL | Country/jurisdiction context for address, tax, or filtering. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| State | NVARCHAR(100) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| City | NVARCHAR(100) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Zip | NVARCHAR(30) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Address | NVARCHAR(500) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| SignupIP | NVARCHAR(45) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| LastLoginIP | NVARCHAR(45) NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| LastLoginAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| IsActive | BIT NOT NULL | Business attribute used by Canonical customer identity and CRM status.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| DeletedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### Commerce.Orders

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Orders. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| LegacyOrderId | NVARCHAR(64) NULL | Relationship/reference used by Orders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Orders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| OrderStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PaymentStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| FulfillmentStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SubtotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DiscountAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ShippingAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| RefundedAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CustomerEmail | NVARCHAR(255) NOT NULL | Business attribute used by Canonical customer order header and financial totals.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CustomerPhone | NVARCHAR(40) NULL | Business attribute used by Canonical customer order header and financial totals.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| BillingAddressId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Orders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ShippingAddressId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Orders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SalesChannel | NVARCHAR(50) NOT NULL | Business attribute used by Canonical customer order header and financial totals.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Source | NVARCHAR(100) NULL | Business attribute used by Canonical customer order header and financial totals.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PlacedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PaidAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CompletedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CancelledAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.OrderItems

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for OrderItems. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by OrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NULL | Relationship/reference used by OrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| VariantId | UNIQUEIDENTIFIER NULL | Relationship/reference used by OrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SKU | NVARCHAR(100) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ProductName | NVARCHAR(255) NOT NULL | Business attribute used by Immutable product, price, tax, cost, and supplier snapshots per order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| VariantName | NVARCHAR(255) NULL | Business attribute used by Immutable product, price, tax, cost, and supplier snapshots per order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Quantity | DECIMAL(19,4) NOT NULL | Business attribute used by Immutable product, price, tax, cost, and supplier snapshots per order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UnitPrice | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DiscountAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UnitCost | DECIMAL(19,4) NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SupplierId | UNIQUEIDENTIFIER NULL | Relationship/reference used by OrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.OrderStatusHistory

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for OrderStatusHistory. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by OrderStatusHistory processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| PreviousStatus | NVARCHAR(40) NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| NewStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Reason | NVARCHAR(1000) NULL | Business attribute used by Auditable order status transitions.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ChangedByUserId | UNIQUEIDENTIFIER NULL | Relationship/reference used by OrderStatusHistory processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.OrderAddresses

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for OrderAddresses. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by OrderAddresses processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| AddressType | NVARCHAR(20) NOT NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| FirstName | NVARCHAR(120) NOT NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| LastName | NVARCHAR(120) NOT NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Company | NVARCHAR(200) NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Phone | NVARCHAR(40) NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| AddressLine1 | NVARCHAR(255) NOT NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| AddressLine2 | NVARCHAR(255) NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| City | NVARCHAR(120) NOT NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| StateProvince | NVARCHAR(120) NULL | Business attribute used by Billing and shipping snapshots captured with an order.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PostalCode | NVARCHAR(30) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CountryCode | CHAR(2) NOT NULL | Country/jurisdiction context for address, tax, or filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.Carts

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Carts. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Carts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SessionId | NVARCHAR(128) NULL | Relationship/reference used by Carts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SubtotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DiscountAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| EstimatedTaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| EstimatedShippingAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| EstimatedTotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ExpiresAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.CartItems

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CartItems. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CartId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CartItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CartItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| VariantId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CartItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Quantity | DECIMAL(19,4) NOT NULL | Business attribute used by Products and quantities held in a cart.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UnitPrice | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.CheckoutAttempts

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CheckoutAttempts. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CartId | UNIQUEIDENTIFIER NULL | Relationship/reference used by CheckoutAttempts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by CheckoutAttempts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Email | NVARCHAR(255) NOT NULL | Business attribute used by Checkout/payment-attempt progress and failure diagnostics.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Amount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CheckoutStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PaymentProvider | NVARCHAR(50) NULL | Business attribute used by Checkout/payment-attempt progress and failure diagnostics.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| PaymentAttemptId | NVARCHAR(255) NULL | Relationship/reference used by CheckoutAttempts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| FailureCode | NVARCHAR(100) NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| FailureMessage | NVARCHAR(1000) NULL | Business attribute used by Checkout/payment-attempt progress and failure diagnostics.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IPAddress | NVARCHAR(45) NULL | Internal security, automation, or diagnostic processing; never exposed on Overview. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| UserAgent | NVARCHAR(1000) NULL | Internal security, automation, or diagnostic processing; never exposed on Overview. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| StartedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CompletedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ShippingMethods

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ShippingMethods. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Code | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Available shipping services and prices.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Carrier | NVARCHAR(120) NOT NULL | Business attribute used by Available shipping services and prices.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ServiceLevel | NVARCHAR(120) NULL | Business attribute used by Available shipping services and prices.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| BasePrice | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| EstimatedMinDays | INT NULL | Business attribute used by Available shipping services and prices.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| EstimatedMaxDays | INT NULL | Business attribute used by Available shipping services and prices.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| IsActive | BIT NOT NULL | Business attribute used by Available shipping services and prices.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.Suppliers

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Suppliers. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Code | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by supplier master records. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SupplierType | NVARCHAR(50) NOT NULL | Business attribute used by supplier master records. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Website | NVARCHAR(1000) NULL | Business attribute used by supplier master records. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Email | NVARCHAR(255) NULL | Business attribute used by supplier master records. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Phone | NVARCHAR(40) NULL | Business attribute used by supplier master records. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DefaultCurrency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CountryCode | CHAR(2) NULL | Country/jurisdiction context for address, tax, or filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.Shipments

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Shipments. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Shipments processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ShipmentNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SupplierId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Shipments processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Carrier | NVARCHAR(120) NOT NULL | Business attribute used by Order fulfillment packages and tracking identity.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Service | NVARCHAR(120) NULL | Business attribute used by Order fulfillment packages and tracking identity.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TrackingNumber | NVARCHAR(255) NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TrackingUrl | NVARCHAR(1000) NULL | Business attribute used by Order fulfillment packages and tracking identity.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ShippedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| DeliveredAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ShippingCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.ShipmentItems

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ShipmentItems. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ShipmentId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ShipmentItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderItemId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ShipmentItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Quantity | DECIMAL(19,4) NOT NULL | Business attribute used by Order-item quantities allocated to shipments.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.TrackingEvents

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for TrackingEvents. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ShipmentId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by TrackingEvents processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| EventCode | NVARCHAR(100) NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(80) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Description | NVARCHAR(1000) NULL | Business attribute used by Carrier shipment event timeline.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Location | NVARCHAR(255) NULL | Business attribute used by Carrier shipment event timeline.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| EventAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.SupplierProducts

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for SupplierProducts. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SupplierId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierProducts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ProductId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierProducts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| VariantId | UNIQUEIDENTIFIER NULL | Relationship/reference used by SupplierProducts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ExternalProductId | NVARCHAR(255) NOT NULL | Relationship/reference used by SupplierProducts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| ExternalVariantId | NVARCHAR(255) NULL | Relationship/reference used by SupplierProducts processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SupplierSKU | NVARCHAR(255) NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SupplierCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| AvailableQuantity | DECIMAL(19,4) NULL | Business attribute used by Supplier-to-catalog mappings, cost, inventory, and sync status.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| LeadTimeDays | INT NULL | Business attribute used by Supplier-to-catalog mappings, cost, inventory, and sync status.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| SyncStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| LastSyncedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.SupplierOrders

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for SupplierOrders. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SupplierId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierOrders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierOrders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| PurchaseOrderNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ExternalOrderId | NVARCHAR(255) NULL | Relationship/reference used by SupplierOrders processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Status | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ProductCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ShippingCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TotalCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| OrderedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ConfirmedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ShippedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.SupplierOrderItems

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for SupplierOrderItems. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SupplierOrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierOrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| OrderItemId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierOrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SupplierProductId | UNIQUEIDENTIFIER NULL | Relationship/reference used by SupplierOrderItems processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| Quantity | DECIMAL(19,4) NOT NULL | Business attribute used by Supplier-order cost and quantity lines.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| UnitCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| TotalCost | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### Commerce.SupplierSyncLogs

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for SupplierSyncLogs. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SupplierId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierSyncLogs processing. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | Yes |
| SyncType | NVARCHAR(50) NOT NULL | Business attribute used by Operational supplier synchronization outcomes.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| Status | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| RecordsProcessed | INT NOT NULL | Business attribute used by Operational supplier synchronization outcomes.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| RecordsSucceeded | INT NOT NULL | Business attribute used by Operational supplier synchronization outcomes.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| RecordsFailed | INT NOT NULL | Business attribute used by Operational supplier synchronization outcomes.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| ErrorSummary | NVARCHAR(MAX) NULL | Business attribute used by Operational supplier synchronization outcomes.. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| StartedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |
| FinishedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: Commerce write service or migration. | Storefront or commerce admin, commerce API and dashboard metrics | No |

### ERP.Companies

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Companies. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Code | NVARCHAR(30) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| LegalName | NVARCHAR(255) NOT NULL | Business attribute used by Legal entities used by accounting.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| DisplayName | NVARCHAR(255) NOT NULL | Business attribute used by Legal entities used by accounting.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CountryCode | CHAR(2) NOT NULL | Country/jurisdiction context for address, tax, or filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| BaseCurrency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxRegistrationNumber | NVARCHAR(100) NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.FiscalYears

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for FiscalYears. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by FiscalYears processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Name | NVARCHAR(100) NOT NULL | Business attribute used by Accounting year boundaries and status.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| StartDate | DATE NOT NULL | Business attribute used by Accounting year boundaries and status.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| EndDate | DATE NOT NULL | Business attribute used by Accounting year boundaries and status.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.FiscalPeriods

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for FiscalPeriods. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| FiscalYearId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by FiscalPeriods processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| PeriodNumber | INT NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Name | NVARCHAR(100) NOT NULL | Business attribute used by Accounting periods and close state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| StartDate | DATE NOT NULL | Business attribute used by Accounting periods and close state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| EndDate | DATE NOT NULL | Business attribute used by Accounting periods and close state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ClosedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.Accounts

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Accounts. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Accounts processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| ParentAccountId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Accounts processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| AccountCode | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| AccountName | NVARCHAR(255) NOT NULL | Business attribute used by Company chart of accounts.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| AccountType | NVARCHAR(30) NOT NULL | Business attribute used by Company chart of accounts.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| NormalBalance | NVARCHAR(10) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| IsPostingAccount | BIT NOT NULL | Business attribute used by Company chart of accounts.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| IsActive | BIT NOT NULL | Business attribute used by Company chart of accounts.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.CostCenters

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CostCenters. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CostCenters processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Code | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Hierarchical management-accounting dimensions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ParentId | UNIQUEIDENTIFIER NULL | Relationship/reference used by CostCenters processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| IsActive | BIT NOT NULL | Business attribute used by Hierarchical management-accounting dimensions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.JournalEntries

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for JournalEntries. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by JournalEntries processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| FiscalPeriodId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by JournalEntries processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| JournalNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| JournalType | NVARCHAR(40) NOT NULL | Business attribute used by General-ledger transaction headers.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TransactionDate | DATE NOT NULL | Business attribute used by General-ledger transaction headers.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PostingDate | DATE NOT NULL | Business attribute used by General-ledger transaction headers.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Description | NVARCHAR(1000) NOT NULL | Business attribute used by General-ledger transaction headers.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ReferenceType | NVARCHAR(100) NULL | Business attribute used by General-ledger transaction headers.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ReferenceId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalEntries processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Status | NVARCHAR(20) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ExchangeRate | DECIMAL(19,8) NOT NULL | Business attribute used by General-ledger transaction headers.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedByUserId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by JournalEntries processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| PostedByUserId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalEntries processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| ReversalOfJournalEntryId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalEntries processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PostedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.JournalLines

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for JournalLines. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| JournalEntryId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by JournalLines processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| AccountId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by JournalLines processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Description | NVARCHAR(1000) NULL | Business attribute used by Balanced debit and credit postings.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| DebitAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreditAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TransactionCurrency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TransactionAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| BaseCurrency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| BaseAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalLines processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| SupplierId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalLines processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalLines processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CostCenterId | UNIQUEIDENTIFIER NULL | Relationship/reference used by JournalLines processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.Invoices

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Invoices. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Invoices processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Invoices processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Invoices processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| InvoiceNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| IssueDate | DATE NOT NULL | Business attribute used by Customer accounts-receivable documents.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| DueDate | DATE NULL | Business attribute used by Customer accounts-receivable documents.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| SubtotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| DiscountAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PaidAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| BalanceAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.InvoiceItems

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for InvoiceItems. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| InvoiceId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by InvoiceItems processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| OrderItemId | UNIQUEIDENTIFIER NULL | Relationship/reference used by InvoiceItems processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Description | NVARCHAR(1000) NOT NULL | Business attribute used by Invoice detail lines.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Quantity | DECIMAL(19,4) NOT NULL | Business attribute used by Invoice detail lines.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UnitPrice | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.SupplierBills

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for SupplierBills. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierBills processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| SupplierId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by SupplierBills processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| SupplierOrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by SupplierBills processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| BillNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| SupplierInvoiceNumber | NVARCHAR(100) NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| IssueDate | DATE NOT NULL | Business attribute used by Supplier accounts-payable documents.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| DueDate | DATE NULL | Business attribute used by Supplier accounts-payable documents.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| SubtotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PaidAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| BalanceAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.Payments

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Payments. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Payments processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Payments processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| InvoiceId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Payments processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| SupplierBillId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Payments processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Direction | NVARCHAR(10) NOT NULL | Business attribute used by Incoming and outgoing payment movements.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PaymentProvider | NVARCHAR(80) NOT NULL | Business attribute used by Incoming and outgoing payment movements.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PaymentMethod | NVARCHAR(80) NOT NULL | Business attribute used by Incoming and outgoing payment movements.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ExternalTransactionId | NVARCHAR(255) NULL | Relationship/reference used by Payments processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Amount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ExchangeRate | DECIMAL(19,8) NOT NULL | Business attribute used by Incoming and outgoing payment movements.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ProcessedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.Refunds

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Refunds. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| PaymentId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Refunds processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| OrderId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Refunds processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| RefundNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ExternalRefundId | NVARCHAR(255) NULL | Relationship/reference used by Refunds processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Amount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Reason | NVARCHAR(1000) NULL | Business attribute used by Refunds linked to payments and orders.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Status | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ProcessedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.BankAccounts

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for BankAccounts. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by BankAccounts processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| AccountName | NVARCHAR(200) NOT NULL | Business attribute used by Masked company bank-account metadata.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| BankName | NVARCHAR(200) NOT NULL | Business attribute used by Masked company bank-account metadata.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| AccountType | NVARCHAR(50) NOT NULL | Business attribute used by Masked company bank-account metadata.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| MaskedAccountNumber | NVARCHAR(50) NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ExternalAccountReference | NVARCHAR(255) NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| IsActive | BIT NOT NULL | Business attribute used by Masked company bank-account metadata.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.BankTransactions

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for BankTransactions. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| BankAccountId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by BankTransactions processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| TransactionDate | DATE NOT NULL | Business attribute used by Imported bank movements and reconciliation state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ValueDate | DATE NULL | Business attribute used by Imported bank movements and reconciliation state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Type | NVARCHAR(40) NOT NULL | Business attribute used by Imported bank movements and reconciliation state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Description | NVARCHAR(1000) NULL | Business attribute used by Imported bank movements and reconciliation state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Reference | NVARCHAR(255) NULL | Business attribute used by Imported bank movements and reconciliation state.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Amount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ReconciliationStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.ExpenseCategories

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for ExpenseCategories. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ExpenseCategories processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| ParentId | UNIQUEIDENTIFIER NULL | Relationship/reference used by ExpenseCategories processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Expense classification mapped to ledger accounts.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| AccountId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by ExpenseCategories processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| IsActive | BIT NOT NULL | Business attribute used by Expense classification mapped to ledger accounts.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.Expenses

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Expenses. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Expenses processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| ExpenseCategoryId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Expenses processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| SupplierId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Expenses processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| ExpenseNumber | NVARCHAR(50) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Description | NVARCHAR(1000) NOT NULL | Business attribute used by Operating expense records.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ExpenseDate | DATE NOT NULL | Business attribute used by Operating expense records.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Amount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TotalAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| PaymentStatus | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Reference | NVARCHAR(255) NULL | Business attribute used by Operating expense records.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ReceiptUrl | NVARCHAR(1000) NULL | Business attribute used by Operating expense records.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedByUserId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by Expenses processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.TaxRates

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for TaxRates. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by TaxRates processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CountryCode | CHAR(2) NOT NULL | Country/jurisdiction context for address, tax, or filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| StateProvince | NVARCHAR(120) NULL | Business attribute used by Jurisdictional tax definitions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxCode | NVARCHAR(50) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxName | NVARCHAR(200) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxType | NVARCHAR(50) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Rate | DECIMAL(19,8) NOT NULL | Business attribute used by Jurisdictional tax definitions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ValidFrom | DATE NOT NULL | Business attribute used by Jurisdictional tax definitions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| ValidTo | DATE NULL | Business attribute used by Jurisdictional tax definitions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| IsActive | BIT NOT NULL | Business attribute used by Jurisdictional tax definitions.. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### ERP.TaxTransactions

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for TaxTransactions. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| CompanyId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by TaxTransactions processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by TaxTransactions processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| InvoiceId | UNIQUEIDENTIFIER NULL | Relationship/reference used by TaxTransactions processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| SupplierBillId | UNIQUEIDENTIFIER NULL | Relationship/reference used by TaxTransactions processing. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | Yes |
| TaxCode | NVARCHAR(50) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxableAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| TaxAmount | DECIMAL(19,4) NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| Currency | CHAR(3) NOT NULL | Currency context for amounts and currency filtering. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: ERP write service or migration. | Finance admin, accounting reports, secured admin API | No |

### CRM.CustomerAddresses

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CustomerAddresses. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerAddresses processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| AddressType | NVARCHAR(30) NOT NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| FirstName | NVARCHAR(120) NOT NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| LastName | NVARCHAR(120) NOT NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Company | NVARCHAR(200) NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Phone | NVARCHAR(40) NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| AddressLine1 | NVARCHAR(255) NOT NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| AddressLine2 | NVARCHAR(255) NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| City | NVARCHAR(120) NOT NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| StateProvince | NVARCHAR(120) NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PostalCode | NVARCHAR(30) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CountryCode | CHAR(2) NOT NULL | Country/jurisdiction context for address, tax, or filtering. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| IsDefault | BIT NOT NULL | Business attribute used by Reusable customer addresses.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CustomerPreferences

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CustomerPreferences. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerPreferences processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| PreferredLanguage | NVARCHAR(10) NULL | Business attribute used by Language, currency, and channel consent preferences.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PreferredCurrency | CHAR(3) NULL | Currency context for amounts and currency filtering. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| EmailMarketing | BIT NOT NULL | Business attribute used by Language, currency, and channel consent preferences.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| SMSMarketing | BIT NOT NULL | Business attribute used by Language, currency, and channel consent preferences.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PushMarketing | BIT NOT NULL | Business attribute used by Language, currency, and channel consent preferences.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CustomerNotes

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CustomerNotes. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerNotes processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CreatedByUserId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerNotes processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Note | NVARCHAR(MAX) NOT NULL | Business attribute used by Internal CRM notes.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CustomerTags

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CustomerTags. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Name | NVARCHAR(100) NOT NULL | Business attribute used by Reusable customer labels.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Description | NVARCHAR(500) NULL | Business attribute used by Reusable customer labels.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CustomerTagAssignments

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerTagAssignments processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| TagId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerTagAssignments processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CustomerSegments

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CustomerSegments. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Rule-based or static customer segments.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Description | NVARCHAR(1000) NULL | Business attribute used by Rule-based or static customer segments.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| SegmentType | NVARCHAR(30) NOT NULL | Business attribute used by Rule-based or static customer segments.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| RuleJson | NVARCHAR(MAX) NULL | Internal security, automation, or diagnostic processing; never exposed on Overview. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| IsActive | BIT NOT NULL | Business attribute used by Rule-based or static customer segments.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CustomerSegmentMembers

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| SegmentId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerSegmentMembers processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CustomerSegmentMembers processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| AddedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.Campaigns

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Campaigns. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Name | NVARCHAR(200) NOT NULL | Business attribute used by Marketing campaign configuration and budget.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Channel | NVARCHAR(50) NOT NULL | Business attribute used by Marketing campaign configuration and budget.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Status | NVARCHAR(30) NOT NULL | Workflow state, filtering, and operational reporting. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| StartAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| EndAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| BudgetAmount | DECIMAL(19,4) NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Currency | CHAR(3) NULL | Currency context for amounts and currency filtering. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.CampaignEvents

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for CampaignEvents. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CampaignId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by CampaignEvents processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by CampaignEvents processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by CampaignEvents processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| EventType | NVARCHAR(50) NOT NULL | Business attribute used by Campaign interactions and attributed orders/revenue.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| EventAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| RevenueAmount | DECIMAL(19,4) NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Currency | CHAR(3) NULL | Currency context for amounts and currency filtering. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.Tickets

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for Tickets. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| LegacyTicketId | INT NOT NULL | Relationship/reference used by Tickets processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| TicketNumber | NVARCHAR(40) NOT NULL | Business lookup, integration mapping, or human-readable reference. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Tickets processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Tickets processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Subject | NVARCHAR(240) NOT NULL | Business attribute used by Customer support cases.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Category | NVARCHAR(60) NOT NULL | Business attribute used by Customer support cases.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Priority | NVARCHAR(20) NOT NULL | Business attribute used by Customer support cases.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Status | NVARCHAR(40) NOT NULL | Workflow state, filtering, and operational reporting. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| AssignedUserId | UNIQUEIDENTIFIER NULL | Relationship/reference used by Tickets processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerNameSnapshot | NVARCHAR(200) NULL | Business attribute used by Customer support cases.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CustomerEmailSnapshot | NVARCHAR(255) NULL | Business attribute used by Customer support cases.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| TagsJson | NVARCHAR(MAX) NULL | Business attribute used by Customer support cases.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| ResolvedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| ClosedAt | DATETIME2(3) NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.TicketMessages

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for TicketMessages. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| TicketId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by TicketMessages processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| SenderType | NVARCHAR(20) NOT NULL | Business attribute used by Public and internal ticket conversation.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| SenderUserId | UNIQUEIDENTIFIER NULL | Relationship/reference used by TicketMessages processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| SenderCustomerId | UNIQUEIDENTIFIER NULL | Relationship/reference used by TicketMessages processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Message | NVARCHAR(MAX) NOT NULL | Business attribute used by Public and internal ticket conversation.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| MessageHtml | NVARCHAR(MAX) NULL | Business attribute used by Public and internal ticket conversation.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| AttachmentsJson | NVARCHAR(MAX) NULL | Business attribute used by Public and internal ticket conversation.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| IsInternal | BIT NOT NULL | Business attribute used by Public and internal ticket conversation.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.TicketEvents

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for TicketEvents. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| TicketId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by TicketEvents processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| EventType | NVARCHAR(80) NOT NULL | Business attribute used by Auditable ticket state changes.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PreviousValue | NVARCHAR(MAX) NULL | Business attribute used by Auditable ticket state changes.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| NewValue | NVARCHAR(MAX) NULL | Business attribute used by Auditable ticket state changes.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| PerformedByUserId | UNIQUEIDENTIFIER NULL | Relationship/reference used by TicketEvents processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.LoyaltyTiers

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for LoyaltyTiers. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Name | NVARCHAR(100) NOT NULL | Business attribute used by Loyalty qualification tiers and benefits.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| MinimumLifetimeValue | DECIMAL(19,4) NULL | Business attribute used by Loyalty qualification tiers and benefits.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| MinimumPoints | INT NULL | Business attribute used by Loyalty qualification tiers and benefits.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| BenefitsJson | NVARCHAR(MAX) NULL | Internal security, automation, or diagnostic processing; never exposed on Overview. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| SortOrder | INT NOT NULL | Business attribute used by Loyalty qualification tiers and benefits.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| IsActive | BIT NOT NULL | Business attribute used by Loyalty qualification tiers and benefits.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.LoyaltyAccounts

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for LoyaltyAccounts. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CustomerId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by LoyaltyAccounts processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| PointsBalance | INT NOT NULL | Financial calculation, reconciliation, reporting, or dashboard aggregation. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| LifetimePointsEarned | INT NOT NULL | Business attribute used by Per-customer loyalty balance.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| TierId | UNIQUEIDENTIFIER NULL | Relationship/reference used by LoyaltyAccounts processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| UpdatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |

### CRM.LoyaltyTransactions

| Column | Type | Purpose/source | Consumer | Internal only |
|---|---|---|---|---|
| Id | UNIQUEIDENTIFIER NOT NULL | Internal stable identifier for LoyaltyTransactions. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| LoyaltyAccountId | UNIQUEIDENTIFIER NOT NULL | Relationship/reference used by LoyaltyTransactions processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Type | NVARCHAR(20) NOT NULL | Business attribute used by Immutable loyalty point ledger.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| Points | INT NOT NULL | Business attribute used by Immutable loyalty point ledger.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| OrderId | UNIQUEIDENTIFIER NULL | Relationship/reference used by LoyaltyTransactions processing. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | Yes |
| Description | NVARCHAR(500) NULL | Business attribute used by Immutable loyalty point ledger.. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
| CreatedAt | DATETIME2(3) NOT NULL | Workflow timing, filtering, ordering, and audit history. Source: CRM write service or migration. | CRM/support/marketing admin, related API and dashboard metrics | No |
