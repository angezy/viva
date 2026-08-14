const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'database', 'migrations', '001_weluxo_platform_upgrade.sql');
const docsDir = path.join(root, 'docs');
const sqlText = fs.readFileSync(migrationPath, 'utf8');

function splitTopLevel(text) {
  const parts = [];
  let start = 0, depth = 0, quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "'" && text[i - 1] !== "\\") quoted = !quoted;
    if (!quoted && text[i] === '(') depth += 1;
    if (!quoted && text[i] === ')') depth -= 1;
    if (!quoted && depth === 0 && text[i] === ',') { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts.map(value => value.trim()).filter(Boolean);
}

function extractTables(text) {
  const tables = [];
  const pattern = /CREATE TABLE\s+\[([^\]]+)\]\.\[([^\]]+)\]\s*\(/gi;
  let match;
  while ((match = pattern.exec(text))) {
    let depth = 1, quoted = false, cursor = pattern.lastIndex;
    for (; cursor < text.length && depth > 0; cursor += 1) {
      const char = text[cursor];
      if (char === "'" && text[cursor - 1] !== "\\") quoted = !quoted;
      if (!quoted && char === '(') depth += 1;
      if (!quoted && char === ')') depth -= 1;
    }
    const body = text.slice(pattern.lastIndex, cursor - 1);
    const columns = splitTopLevel(body).filter(part => /^\[[^\]]+\]\s+/.test(part)).map(part => {
      const column = part.match(/^\[([^\]]+)\]\s+([A-Z][A-Z0-9]*(?:\s*\([^)]*\))?)([\s\S]*)$/i);
      if (!column) return null;
      const remainder = column[3];
      const defaultMatch = remainder.match(/\bDEFAULT\s+((?:\([^)]*\)|[^,\s]+))/i);
      return {
        name: column[1], dataType: column[2].replace(/\s+/g, ' ').trim(), nullable: !/\bNOT NULL\b/i.test(remainder),
        default: defaultMatch ? defaultMatch[1] : null, identity: /\bIDENTITY\b/i.test(remainder), computed: /^\s+AS\b/i.test(remainder),
        primaryKey: /\bPRIMARY KEY\b/i.test(remainder), unique: /\bUNIQUE\b/i.test(remainder)
      };
    }).filter(Boolean);
    tables.push({ schema: match[1], name: match[2], columns, body });
    pattern.lastIndex = cursor;
  }
  return tables;
}

const purposeByName = {
  Products: 'Canonical sellable product catalog.', ProductVariants: 'SKU-level pricing, cost, weight, and availability.', Categories: 'Hierarchical storefront product classification.',
  ProductCategories: 'Product-to-category membership.', ProductImages: 'Ordered product and variant imagery.', ProductVideos: 'Ordered product and variant video media.',
  ProductAttributes: 'Reusable product attribute definitions.', ProductAttributeValues: 'Typed attribute values assigned to products or variants.',
  Orders: 'Canonical customer order header and financial totals.', OrderItems: 'Immutable product, price, tax, cost, and supplier snapshots per order.',
  OrderStatusHistory: 'Auditable order status transitions.', OrderAddresses: 'Billing and shipping snapshots captured with an order.', Carts: 'Active and historical shopping carts.',
  CartItems: 'Products and quantities held in a cart.', CheckoutAttempts: 'Checkout/payment-attempt progress and failure diagnostics.', ShippingMethods: 'Available shipping services and prices.',
  Shipments: 'Order fulfillment packages and tracking identity.', ShipmentItems: 'Order-item quantities allocated to shipments.', TrackingEvents: 'Carrier shipment event timeline.',
  Suppliers: 'Supplier master records including CJdropshipping as one integration.', SupplierProducts: 'Supplier-to-catalog mappings, cost, inventory, and sync status.',
  SupplierOrders: 'Purchase/fulfillment orders sent to suppliers.', SupplierOrderItems: 'Supplier-order cost and quantity lines.', SupplierSyncLogs: 'Operational supplier synchronization outcomes.',
  Companies: 'Legal entities used by accounting.', FiscalYears: 'Accounting year boundaries and status.', FiscalPeriods: 'Accounting periods and close state.', Accounts: 'Company chart of accounts.',
  CostCenters: 'Hierarchical management-accounting dimensions.', JournalEntries: 'General-ledger transaction headers.', JournalLines: 'Balanced debit and credit postings.',
  Invoices: 'Customer accounts-receivable documents.', InvoiceItems: 'Invoice detail lines.', SupplierBills: 'Supplier accounts-payable documents.', Payments: 'Incoming and outgoing payment movements.',
  Refunds: 'Refunds linked to payments and orders.', BankAccounts: 'Masked company bank-account metadata.', BankTransactions: 'Imported bank movements and reconciliation state.',
  ExpenseCategories: 'Expense classification mapped to ledger accounts.', Expenses: 'Operating expense records.', TaxRates: 'Jurisdictional tax definitions.', TaxTransactions: 'Tax amounts sourced from business documents.',
  Customers: 'Canonical customer identity and CRM status.', CustomerAddresses: 'Reusable customer addresses.', CustomerPreferences: 'Language, currency, and channel consent preferences.',
  CustomerNotes: 'Internal CRM notes.', CustomerTags: 'Reusable customer labels.', CustomerTagAssignments: 'Customer-to-tag membership.', CustomerSegments: 'Rule-based or static customer segments.',
  CustomerSegmentMembers: 'Materialized segment membership.', Campaigns: 'Marketing campaign configuration and budget.', CampaignEvents: 'Campaign interactions and attributed orders/revenue.',
  Tickets: 'Customer support cases.', TicketMessages: 'Public and internal ticket conversation.', TicketEvents: 'Auditable ticket state changes.', LoyaltyTiers: 'Loyalty qualification tiers and benefits.',
  LoyaltyAccounts: 'Per-customer loyalty balance.', LoyaltyTransactions: 'Immutable loyalty point ledger.', WeluxoMigrationHistory: 'Idempotent migration application audit.'
};

function areaFor(table) {
  if (table.schema === 'ERP') return 'Finance admin, accounting reports, secured admin API';
  if (table.schema === 'CRM') return 'CRM/support/marketing admin, related API and dashboard metrics';
  if (table.schema === 'Commerce') return 'Storefront or commerce admin, commerce API and dashboard metrics';
  return 'Migration runner and database operations';
}

function columnPurpose(table, column) {
  const name = column.name;
  if (name === 'Id') return `Internal stable identifier for ${table.name}.`;
  if (/Id$/.test(name)) return `Relationship/reference used by ${table.name} processing.`;
  if (/CreatedAt|UpdatedAt|PostedAt|ProcessedAt|ResolvedAt|ClosedAt|StartedAt|FinishedAt|EventAt|At$/.test(name)) return 'Workflow timing, filtering, ordering, and audit history.';
  if (/Amount|Price|Cost|Balance|Revenue|Budget|Tax|Discount|Subtotal|Total/.test(name)) return 'Financial calculation, reconciliation, reporting, or dashboard aggregation.';
  if (/Status/.test(name)) return 'Workflow state, filtering, and operational reporting.';
  if (/Currency/.test(name)) return 'Currency context for amounts and currency filtering.';
  if (/Country/.test(name)) return 'Country/jurisdiction context for address, tax, or filtering.';
  if (/Number|Code|SKU|Slug|External/.test(name)) return 'Business lookup, integration mapping, or human-readable reference.';
  if (/Password|Token|Secret|IPAddress|UserAgent|RuleJson|BenefitsJson/.test(name)) return 'Internal security, automation, or diagnostic processing; never exposed on Overview.';
  return `Business attribute used by ${purposeByName[table.name] || table.name}.`;
}

function getIndexes(text) {
  return [...text.matchAll(/CREATE\s+(UNIQUE\s+)?(CLUSTERED\s+|NONCLUSTERED\s+)?INDEX\s+\[([^\]]+)\]\s+ON\s+\[([^\]]+)\]\.\[([^\]]+)\]\s*\(([^)]*)\)(?:\s+INCLUDE\s*\(([^)]*)\))?/gi)].map(m => ({
    name: m[3], schema: m[4], table: m[5], unique: Boolean(m[1]), type: (m[2] || 'NONCLUSTERED').trim().toUpperCase(),
    columns: [...m[6].matchAll(/\[([^\]]+)\]/g)].map(x => x[1]), includedColumns: [...(m[7] || '').matchAll(/\[([^\]]+)\]/g)].map(x => x[1])
  }));
}

function getForeignKeys(text, tables) {
  const relationships = [];
  for (const table of tables) {
    for (const match of table.body.matchAll(/(?:CONSTRAINT\s+\[([^\]]+)\]\s+)?FOREIGN KEY\s*\(\[([^\]]+)\]\)\s+REFERENCES\s+\[([^\]]+)\]\.\[([^\]]+)\]\s*\(\[([^\]]+)\]\)/gi)) {
      relationships.push({ name: match[1] || null, fromSchema: table.schema, fromTable: table.name, fromColumn: match[2], toSchema: match[3], toTable: match[4], toColumn: match[5] });
    }
  }
  for (const match of text.matchAll(/ALTER TABLE\s+\[([^\]]+)\]\.\[([^\]]+)\][\s\S]{0,300}?CONSTRAINT\s+\[([^\]]+)\][\s\S]{0,120}?FOREIGN KEY\s*\(\[([^\]]+)\]\)\s+REFERENCES\s+\[([^\]]+)\]\.\[([^\]]+)\]\s*\(\[([^\]]+)\]\)/gi)) {
    relationships.push({ name: match[3], fromSchema: match[1], fromTable: match[2], fromColumn: match[4], toSchema: match[5], toTable: match[6], toColumn: match[7] });
  }
  return relationships.filter((item, index, all) => index === all.findIndex(other => `${other.fromSchema}.${other.fromTable}.${other.fromColumn}.${other.toTable}` === `${item.fromSchema}.${item.fromTable}.${item.fromColumn}.${item.toTable}`));
}

const tables = extractTables(sqlText);
const indexes = getIndexes(sqlText);
const relationships = getForeignKeys(sqlText, tables);
for (const table of tables) {
  table.purpose = purposeByName[table.name] || `${table.schema} business data.`;
  table.consumers = areaFor(table);
  table.indexes = indexes.filter(index => index.schema === table.schema && index.table === table.name);
  table.foreignKeys = relationships.filter(fk => fk.fromSchema === table.schema && fk.fromTable === table.name);
  table.columns = table.columns.map(column => ({ ...column, purpose: columnPurpose(table, column), internalOnly: /(^Id$|Id$|Password|Token|Secret|IPAddress|UserAgent|RuleJson|BenefitsJson)/.test(column.name) }));
  delete table.body;
}

const dashboardCards = [
  ['Revenue Today / Period / Month', 'SUM(Orders.TotalAmount - Orders.RefundedAmount) for non-cancelled paid/refunded orders', 'Commerce.Orders', 'TotalAmount, RefundedAmount, PaymentStatus, OrderStatus, CreatedAt, Currency', '/api/admin/overview', '/dashboard/orders', 'date, currency, country, supplier, product, category, customer, order status'],
  ['Orders Today / Period / Month', 'COUNT(Orders.Id)', 'Commerce.Orders', 'Id, CreatedAt, Currency and filter columns', '/api/admin/overview', '/dashboard/orders', 'date, currency, country, supplier, product, category, customer, order status'],
  ['Average Order Value', 'AVG(TotalAmount - RefundedAmount) for revenue-eligible orders', 'Commerce.Orders', 'TotalAmount, RefundedAmount, PaymentStatus, OrderStatus', '/api/admin/overview', '/dashboard/orders', 'all overview filters'],
  ['Paid / Pending / Cancelled Orders', 'COUNT filtered by PaymentStatus or OrderStatus', 'Commerce.Orders', 'PaymentStatus, OrderStatus', '/api/admin/overview', '/dashboard/orders', 'all overview filters plus status'],
  ['Refund Amount', 'SUM(Refunds.Amount) by refund creation date', 'ERP.Refunds', 'Amount, Currency, CreatedAt', '/api/admin/overview', '/dashboard/finance?view=refunds', 'date, currency'],
  ['Gross Sales / COGS / Gross Profit', 'SUM(OrderItems.TotalAmount); SUM(UnitCost × Quantity); difference', 'Commerce.OrderItems, Commerce.Orders', 'TotalAmount, UnitCost, Quantity, OrderId', '/api/admin/overview', '/dashboard/finance', 'all order filters'],
  ['Operating Expenses / Net Profit', 'SUM(Expenses.TotalAmount); gross profit minus expenses', 'ERP.Expenses, Commerce.OrderItems', 'TotalAmount, ExpenseDate, Currency', '/api/admin/overview', '/dashboard/finance', 'date, currency'],
  ['Cash Position', 'SUM paid incoming Payments - paid outgoing Payments through period end', 'ERP.Payments', 'Direction, Amount, Status, ProcessedAt, CreatedAt, Currency', '/api/admin/overview', '/dashboard/finance', 'period end, currency'],
  ['Accounts Receivable / Payable', 'SUM open Invoice/SupplierBill BalanceAmount', 'ERP.Invoices, ERP.SupplierBills', 'BalanceAmount, Status, Currency, SupplierId', '/api/admin/overview', '/dashboard/finance', 'currency, supplier'],
  ['Tax Collected / Payable', 'SUM Orders.TaxAmount; SUM TaxTransactions.TaxAmount', 'Commerce.Orders, ERP.TaxTransactions', 'TaxAmount, CreatedAt, Currency', '/api/admin/overview', '/dashboard/finance', 'date, currency and order filters'],
  ['Product Status / Stock', 'COUNT products by Status; COUNT active variants at/below stock threshold', 'Commerce.Products, Commerce.ProductVariants', 'Status, AvailableQuantity, LowStockThreshold', '/api/admin/overview', '/dashboard/products', 'product/category'],
  ['Top Products', 'SUM quantity and revenue grouped by product, top five by revenue', 'Commerce.OrderItems, Commerce.Products, Commerce.Orders', 'ProductId, Quantity, TotalAmount, Name, SKU', '/api/admin/overview', '/dashboard/products', 'all order filters'],
  ['Fulfillment Status', 'COUNT orders/shipments/events by workflow status', 'Commerce.Orders, Commerce.Shipments, Commerce.TrackingEvents', 'PaymentStatus, FulfillmentStatus, OrderStatus, Status', '/api/admin/overview', '/dashboard/orders', 'all order filters plus status'],
  ['Supplier Operations', 'COUNT active suppliers, pending/delayed orders, failed syncs and unprofitable cost mappings', 'Commerce.Suppliers, Commerce.SupplierOrders, Commerce.SupplierSyncLogs, Commerce.SupplierProducts, Commerce.ProductVariants', 'Status, SupplierCost, SellingPrice, CreatedAt', '/api/admin/overview', '/dashboard/suppliers', 'date, currency, supplier'],
  ['Customer Metrics', 'COUNT customers and grouped order activity; lifetime value derived from orders', 'CRM.Customers, Commerce.Orders, CRM.Tickets', 'CreatedAt, CustomerId, TotalAmount, RefundedAmount, Status', '/api/admin/overview', '/dashboard/user', 'date and customer/order filters'],
  ['Support Metrics', 'COUNT open/urgent/unassigned tickets and AVG resolution duration', 'CRM.Tickets', 'Status, Priority, AssignedUserId, CreatedAt, ResolvedAt', '/api/admin/overview', '/dashboard/tikects', 'date and ticket filters'],
  ['Campaign Metrics / ROI', 'SUM attributed revenue, COUNT distinct orders, (revenue-budget)/budget', 'CRM.Campaigns, CRM.CampaignEvents', 'Status, BudgetAmount, RevenueAmount, OrderId, EventAt', '/api/admin/overview', '/dashboard/marketing', 'date, currency'],
  ['Loyalty Metrics', 'COUNT accounts and SUM earn/redeem points grouped by tier', 'CRM.LoyaltyAccounts, CRM.LoyaltyTransactions, CRM.LoyaltyTiers', 'Points, Type, TierId, Name, CreatedAt', '/api/admin/overview', '/dashboard/loyalty', 'date, tier, transaction type']
];

const legacy = [
  ['dbo.DashboardSettings', 'KEEP', 'Existing application settings table; retained and outside business-domain migration.'],
  ['dbo.HomeContent_tbl', 'KEEP', 'Existing content-management table; retained and outside business-domain migration.'],
  ['dbo.Notifications', 'KEEP', 'Existing application notification table; retained.'],
  ['dbo.User_tbl', 'MIGRATE', 'Map customer-role rows to CRM.Customers; keep compatibility object/legacy table until all code consumers move.'],
  ['dbo.Products_tbl', 'MIGRATE', 'Map catalog rows to Commerce.Products/ProductVariants; keep compatibility until storefront consumers move.'],
  ['dbo.CjImportedProducts_tbl', 'MIGRATE', 'Map CJ as Commerce.Suppliers plus Commerce.SupplierProducts.'],
  ['dbo.Orders_tbl', 'MIGRATE', 'Map order headers/items into Commerce.Orders and Commerce.OrderItems.'],
  ['dbo.ProductAddress_tbl / ProductImages_tbl / ProductVideos_tbl', 'REVIEW', 'Legacy product ancillary tables require row-level mapping after canonical product IDs exist.'],
  ['dbo.tickets / ticket_messages / ticket_events', 'MIGRATE', 'Map support history to CRM.Tickets, CRM.TicketMessages, CRM.TicketEvents.'],
  ['dbo.checkout_attempts / OrderTrackingEvents_tbl', 'MIGRATE', 'Map to Commerce.CheckoutAttempts and Commerce.TrackingEvents after legacy key verification.'],
  ['dbo.MostChosenProducts', 'DEPRECATE', 'Derived concept; replace with live OrderItems aggregation after consumer migration.'],
  ['dbo.Comments / footer_tbl / head_tbl / header_tbl', 'REVIEW', 'Content/review concepts are outside this three-domain migration and must not be deleted automatically.']
];

const header = `# Weluxo Database Architecture\n\nGenerated ${new Date().toISOString()}. This package contains structure and source-code mapping only; no data rows or secrets are included.\n\n> Deployment state: migration prepared but not applied. Live execution was intentionally withheld because the available safety gate did not permit transactional DDL validation without fresh explicit approval.\n`;

fs.mkdirSync(docsDir, { recursive: true });

const domainCounts = tables.reduce((map, table) => ({ ...map, [table.schema]: (map[table.schema] || 0) + 1 }), {});
fs.writeFileSync(path.join(docsDir, 'weluxo-database-final.md'), `${header}\n## Architecture\n\n- Commerce: ${domainCounts.Commerce || 0} tables for catalog, orders, checkout, shipping, and supplier network.\n- ERP: ${domainCounts.ERP || 0} tables for legal entities, ledger, AR/AP, payments, banking, expenses, and tax.\n- CRM: ${domainCounts.CRM || 0} tables for customers, marketing, support, and loyalty.\n- Operational: ${domainCounts.dbo || 0} migration-history table.\n\n## Design decisions\n\n- Existing objects are preserved; migration is additive and idempotent.\n- Primary identifiers are UNIQUEIDENTIFIER with NEWSEQUENTIALID defaults; human references remain separate.\n- Financial values use DECIMAL(19,4), rates use DECIMAL(19,8), currencies CHAR(3), and countries CHAR(2).\n- Customer lifetime metrics are derived from Commerce.Orders instead of duplicated in CRM.Customers.\n- CJdropshipping is represented as a supplier integration, not a platform-level special case.\n- Posted journal entries are protected by triggers and corrected through reversal entries.\n- Overview access requires an authenticated administrator and excludes passwords, secrets, tokens, raw PII, and payment-card data.\n\n## Planned structure totals\n\n- Tables: ${tables.length}\n- Columns: ${tables.reduce((sum, table) => sum + table.columns.length, 0)}\n- Foreign-key relationships: ${relationships.length}\n- Explicit indexes: ${indexes.length}\n\n## Application deliverables\n\n- GET /api/admin/overview: secured real-time KPI aggregation.\n- GET /api/admin/records/:area: secured drill-down rows for orders, finance, suppliers, marketing, and loyalty.\n- /dashboard/Overview: live filtered Overview; /dashboard redirects there.\n- Drill-down pages: orders, finance, suppliers, marketing, loyalty, plus existing products, users, and support pages.\n\n## Required deployment checks\n\n1. Back up the target database.\n2. Run the migration in a non-production clone and reconcile legacy row counts.\n3. Apply to Weluxo only after explicit authorization.\n4. Run order/payment/refund/journal/invoice/supplier reconciliation.\n5. Compare each dashboard card with the identically filtered detail endpoint.\n`);

let usage = `${header}\n## Table-level usage map\n\n| Table | Business purpose | Write source | Read consumers | Admin/dashboard/report/API |\n|---|---|---|---|---|\n`;
for (const table of tables) usage += `| ${table.schema}.${table.name} | ${table.purpose} | ${table.schema === 'dbo' ? 'Migration runner' : `${table.schema} services and legacy migration`} | ${table.consumers} | Admin detail pages; dashboard where listed; secured APIs; ${table.schema === 'ERP' ? 'financial reports' : 'operational reporting'} |\n`;
usage += `\n## Column-level usage map\n\nEvery planned column is listed below. “Internal” fields are consumed by relationships, security, audit, automation, or calculations and are not exposed merely to satisfy UI traceability.\n`;
for (const table of tables) {
  usage += `\n### ${table.schema}.${table.name}\n\n| Column | Type | Purpose/source | Consumer | Internal only |\n|---|---|---|---|---|\n`;
  for (const column of table.columns) usage += `| ${column.name} | ${column.dataType}${column.nullable ? ' NULL' : ' NOT NULL'} | ${column.purpose} Source: ${table.schema} write service or migration. | ${table.consumers} | ${column.internalOnly ? 'Yes' : 'No'} |\n`;
}
fs.writeFileSync(path.join(docsDir, 'database-data-usage.md'), usage);

let audit = `${header}\n## Existing/legacy disposition\n\n| Object | Status | Evidence-based action |\n|---|---|---|\n`;
legacy.forEach(row => { audit += `| ${row.join(' | ')} |\n`; });
audit += `\n## Automated findings\n\n- The live metadata snapshot found only dbo.DashboardSettings, dbo.HomeContent_tbl, and dbo.Notifications in the configured Weluxo database; repository SQL references substantially more legacy objects. This mismatch requires environment/connection verification before production migration.\n- Legacy tables generally have no declared foreign keys in the captured database metadata; relationships are implied by naming and application queries. Marked REVIEW/MIGRATE, never auto-deleted.\n- The old /dashboard/Overview and /dashboard contained hard-coded KPI arrays and simulated loading. They were replaced with /api/admin/overview data; targeted lint and production build pass.\n- Newly planned business columns have consumers documented in database-data-usage.md; internal IDs/audit/security fields intentionally remain absent from Overview.\n- Compatibility views are created only when the equivalent legacy table is absent, avoiding duplicate object names.\n- SAFE_TO_REMOVE_AFTER_APPROVAL: none. Row reconciliation and a full production usage trace are required before any legacy removal.\n\n## Remaining review items\n\n- Confirm the configured database is the intended production Weluxo instance.\n- Validate legacy column variants and row counts in a restored/non-production clone.\n- Migrate remaining backend/storefront repositories from dbo compatibility objects to canonical schemas.\n- Verify existing product/user/support pages honor every query-string filter used by dashboard links.\n`;
fs.writeFileSync(path.join(docsDir, 'database-unused-audit.md'), audit);

let dashboard = `${header}\nAll cards are populated by ` + '`GET /api/admin/overview`' + ` and rendered in ` + '`/dashboard/Overview`' + `. Cards preserve active date/currency/country filters in their drill-down links.\n\n| Card | Formula | Source tables | Source columns | API endpoint | Drill-down | Filters |\n|---|---|---|---|---|---|---|\n`;
dashboardCards.forEach(card => { dashboard += `| ${card.join(' | ')} |\n`; });
dashboard += `\n## Permissions and data minimization\n\nBoth endpoints require an administrator JWT. Drill-down responses omit internal UUID display, customer email/phone/address, authentication fields, secrets, full payment details, IP addresses, and user agents. Finance, CRM, and supplier data therefore remain behind the current Admin role gate; finer Finance/CRM/Procurement roles can be added when the authentication model supports them.\n\n## Consistency rule\n\nOverview and drill-down pages use the same canonical tables and forward the same filter query parameters. Before release, automated integration tests must compare API KPI totals with grouped detail queries against the deployed schema.\n`;
fs.writeFileSync(path.join(docsDir, 'dashboard-data-map.md'), dashboard);

let report = `${header}\n## Change summary\n\n| Category | Result |\n|---|---|\n| Existing tables kept | DashboardSettings, HomeContent_tbl, Notifications, and all unresolved legacy objects |\n| Existing tables migrated | Transactional mappings prepared for User_tbl, Products_tbl, CjImportedProducts_tbl, Orders_tbl, tickets, ticket_messages, and ticket_events |\n| Existing tables deprecated | MostChosenProducts is a derived-view candidate; no object is deleted |\n| New tables prepared | ${tables.length} total (${domainCounts.Commerce || 0} Commerce, ${domainCounts.ERP || 0} ERP, ${domainCounts.CRM || 0} CRM, ${domainCounts.dbo || 0} dbo) |\n| New columns prepared | ${tables.reduce((sum, table) => sum + table.columns.length, 0)} |\n| Explicit indexes prepared | ${indexes.length} |\n| Foreign keys prepared | ${relationships.length} parsed relationships |\n| Constraints | PK, unique, check, FK, defaults, journal balance and posted-entry protections |\n| API endpoints | GET /api/admin/overview; GET /api/admin/records/:area |\n| Admin pages | Overview, Orders, Finance, Suppliers, Marketing, Loyalty; sidebar updated |\n| Dashboard cards | ${dashboardCards.length} documented KPI groups covering all required cards |\n\n## Validation performed\n\n- Backend JavaScript syntax checks: passed.\n- Targeted frontend ESLint: passed.\n- Next.js optimized production build: passed (60+ routes generated).\n- Static migration scan: no DROP TABLE, TRUNCATE TABLE, DELETE FROM, FLOAT, MONEY, or SMALLMONEY statements; one explicit transaction with TRY/CATCH rollback behavior.\n- Live SQL dry-run: not performed; safety gate rejected DDL execution even with forced rollback.\n- Live data consistency: pending deployment to a non-production clone or explicit authorization for the target database.\n\n## Deployment report status\n\nNo database object was created, altered, deleted, or populated during this documentation/application phase. Migration application and post-migration reconciliation remain pending.\n`;
fs.writeFileSync(path.join(docsDir, 'migration-report.md'), report);

const output = {
  generatedAt: new Date().toISOString(), metadataOnly: true, includesDataRows: false,
  deploymentState: 'prepared_not_applied', sourceMigration: path.relative(root, migrationPath).replace(/\\/g, '/'),
  schemas: ['Commerce', 'ERP', 'CRM'], tables, indexes, relationships,
  application: { endpoints: ['/api/admin/overview', '/api/admin/records/:area'], adminPages: ['/dashboard/Overview', '/dashboard/orders', '/dashboard/finance', '/dashboard/suppliers', '/dashboard/marketing', '/dashboard/loyalty'], dashboardCards: dashboardCards.map(card => ({ name: card[0], formula: card[1], sourceTables: card[2], sourceColumns: card[3], endpoint: card[4], drillDown: card[5], filters: card[6] })) },
  legacyDisposition: legacy.map(([object, status, reason]) => ({ object, status, reason }))
};
fs.writeFileSync(path.join(root, 'Weluxo_final_structure.json'), JSON.stringify(output, null, 2));

console.log(JSON.stringify({ docs: 5, tables: tables.length, columns: tables.reduce((sum, table) => sum + table.columns.length, 0), indexes: indexes.length, relationships: relationships.length }, null, 2));
