# Weluxo Database Architecture

Generated 2026-08-10T18:26:21.247Z. This package contains structure and source-code mapping only; no data rows or secrets are included.

> Deployment state: migration prepared but not applied. Live execution was intentionally withheld because the available safety gate did not permit transactional DDL validation without fresh explicit approval.

All cards are populated by `GET /api/admin/overview` and rendered in `/dashboard/Overview`. Cards preserve active date/currency/country filters in their drill-down links.

| Card | Formula | Source tables | Source columns | API endpoint | Drill-down | Filters |
|---|---|---|---|---|---|---|
| Revenue Today / Period / Month | SUM(Orders.TotalAmount - Orders.RefundedAmount) for non-cancelled paid/refunded orders | Commerce.Orders | TotalAmount, RefundedAmount, PaymentStatus, OrderStatus, CreatedAt, Currency | /api/admin/overview | /dashboard/orders | date, currency, country, supplier, product, category, customer, order status |
| Orders Today / Period / Month | COUNT(Orders.Id) | Commerce.Orders | Id, CreatedAt, Currency and filter columns | /api/admin/overview | /dashboard/orders | date, currency, country, supplier, product, category, customer, order status |
| Average Order Value | AVG(TotalAmount - RefundedAmount) for revenue-eligible orders | Commerce.Orders | TotalAmount, RefundedAmount, PaymentStatus, OrderStatus | /api/admin/overview | /dashboard/orders | all overview filters |
| Paid / Pending / Cancelled Orders | COUNT filtered by PaymentStatus or OrderStatus | Commerce.Orders | PaymentStatus, OrderStatus | /api/admin/overview | /dashboard/orders | all overview filters plus status |
| Refund Amount | SUM(Refunds.Amount) by refund creation date | ERP.Refunds | Amount, Currency, CreatedAt | /api/admin/overview | /dashboard/finance?view=refunds | date, currency |
| Gross Sales / COGS / Gross Profit | Eligible paid/refunded order items only; refunds reduce net sales and gross profit; COGS is UnitCost × Quantity; difference | Commerce.OrderItems, Commerce.Orders, ERP.Refunds | TotalAmount, UnitCost, Quantity, OrderId, Amount, CreatedAt | /api/admin/overview | /dashboard/finance | all order filters plus date/currency refund filters |
| Operating Expenses / Net Profit | SUM(Expenses.TotalAmount); net sales minus COGS minus operating expenses | ERP.Expenses, Commerce.OrderItems, Commerce.Orders, ERP.Refunds | TotalAmount, ExpenseDate, Currency, OrderId, Amount, CreatedAt | /api/admin/overview | /dashboard/finance | date, currency |
| Cash Position | SUM paid incoming Payments - paid outgoing Payments through period end | ERP.Payments | Direction, Amount, Status, ProcessedAt, CreatedAt, Currency | /api/admin/overview | /dashboard/finance | period end, currency |
| Accounts Receivable / Payable | SUM open Invoice/SupplierBill BalanceAmount | ERP.Invoices, ERP.SupplierBills | BalanceAmount, Status, Currency, SupplierId | /api/admin/overview | /dashboard/finance | currency, supplier |
| Tax Collected / Payable | SUM Orders.TaxAmount; SUM TaxTransactions.TaxAmount | Commerce.Orders, ERP.TaxTransactions | TaxAmount, CreatedAt, Currency | /api/admin/overview | /dashboard/finance | date, currency and order filters |
| Product Status / Stock | COUNT products by Status; COUNT active variants at/below stock threshold | Commerce.Products, Commerce.ProductVariants | Status, AvailableQuantity, LowStockThreshold | /api/admin/overview | /dashboard/products | product/category |
| Top Products | SUM quantity and revenue grouped by product, top five by revenue | Commerce.OrderItems, Commerce.Products, Commerce.Orders | ProductId, Quantity, TotalAmount, Name, SKU | /api/admin/overview | /dashboard/products | all order filters |
| Fulfillment Status | Count filtered orders by effective fulfillment status, using shipment rows only as a fallback; count exception orders once | Commerce.Orders, Commerce.Shipments, Commerce.TrackingEvents | PaymentStatus, FulfillmentStatus, OrderStatus, Status | /api/admin/overview | /dashboard/orders | all order filters plus status |
| Supplier Operations | COUNT active suppliers, pending/delayed orders, failed syncs and unprofitable cost mappings | Commerce.Suppliers, Commerce.SupplierOrders, Commerce.SupplierSyncLogs, Commerce.SupplierProducts, Commerce.ProductVariants | Status, SupplierCost, SellingPrice, CreatedAt | /api/admin/overview | /dashboard/suppliers | date, currency, supplier |
| Customer Metrics | COUNT customers and grouped order activity; lifetime value derived from orders | CRM.Customers, Commerce.Orders, CRM.Tickets | CreatedAt, CustomerId, TotalAmount, RefundedAmount, Status | /api/admin/overview | /dashboard/user | date and customer/order filters |
| Support Metrics | COUNT open/urgent/unassigned tickets and AVG resolution duration | CRM.Tickets | Status, Priority, AssignedUserId, CreatedAt, ResolvedAt | /api/admin/overview | /dashboard/tikects | date and ticket filters |
| Campaign Metrics / ROI | SUM attributed revenue, COUNT distinct orders, (revenue-budget)/budget | CRM.Campaigns, CRM.CampaignEvents | Status, BudgetAmount, RevenueAmount, OrderId, EventAt | /api/admin/overview | /dashboard/marketing | date, currency |
| Loyalty Metrics | COUNT accounts and SUM earn/redeem points grouped by tier | CRM.LoyaltyAccounts, CRM.LoyaltyTransactions, CRM.LoyaltyTiers | Points, Type, TierId, Name, CreatedAt | /api/admin/overview | /dashboard/loyalty | date, tier, transaction type |

## Permissions and data minimization

Both endpoints require an administrator JWT. Drill-down responses omit internal UUID display, customer email/phone/address, authentication fields, secrets, full payment details, IP addresses, and user agents. Finance, CRM, and supplier data therefore remain behind the current Admin role gate; finer Finance/CRM/Procurement roles can be added when the authentication model supports them.

## Consistency rule

Overview and drill-down pages use the same canonical tables and forward the same filter query parameters. Production releases must preserve this shared filtering behavior.
