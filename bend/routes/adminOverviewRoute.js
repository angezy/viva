const express = require('express');
const sql = require('mssql');
const { getPool } = require('../utils/dbConnection');
const { requirePermission } = require('../utils/rbac');

const router = express.Router();

function normalizeRows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.recordset || [];
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const requireAdmin = requirePermission('analytics.read', 'adminUser');

function utcStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveRange(query) {
  const now = new Date();
  const today = utcStart(now);
  const range = String(query.range || 'last30').toLowerCase();
  if (range === 'today') return { key: 'today', start: today, end: addUtcDays(today, 1) };
  if (range === 'yesterday') return { key: 'yesterday', start: addUtcDays(today, -1), end: today };
  if (range === 'last7') return { key: 'last7', start: addUtcDays(today, -6), end: addUtcDays(today, 1) };
  if (range === 'thismonth') return { key: 'thisMonth', start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: addUtcDays(today, 1) };
  if (range === 'lastmonth') {
    return {
      key: 'lastMonth',
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    };
  }
  if (range === 'thisyear') return { key: 'thisYear', start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end: addUtcDays(today, 1) };
  if (range === 'custom') {
    const start = parseDateOnly(query.from);
    const to = parseDateOnly(query.to);
    if (!start || !to || start > to) throw new Error('Custom range requires valid from/to dates');
    return { key: 'custom', start, end: addUtcDays(to, 1) };
  }
  return { key: 'last30', start: addUtcDays(today, -29), end: addUtcDays(today, 1) };
}

function optionalUuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function addOverviewInputs(request, req, range) {
  const now = new Date();
  const today = utcStart(now);
  const currency = /^[A-Za-z]{3}$/.test(String(req.query.currency || '')) ? String(req.query.currency).toUpperCase() : null;
  const country = /^[A-Za-z]{2}$/.test(String(req.query.country || '')) ? String(req.query.country).toUpperCase() : null;
  const orderStatus = String(req.query.orderStatus || '').trim().slice(0, 40) || null;
  return request
    .input('StartAt', sql.DateTime2, range.start)
    .input('EndAt', sql.DateTime2, range.end)
    .input('TodayStart', sql.DateTime2, today)
    .input('TomorrowStart', sql.DateTime2, addUtcDays(today, 1))
    .input('MonthStart', sql.DateTime2, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
    .input('Currency', sql.Char(3), currency)
    .input('CountryCode', sql.Char(2), country)
    .input('OrderStatus', sql.NVarChar(40), orderStatus)
    .input('SupplierId', sql.UniqueIdentifier, optionalUuid(req.query.supplier))
    .input('ProductId', sql.UniqueIdentifier, optionalUuid(req.query.product))
    .input('CategoryId', sql.UniqueIdentifier, optionalUuid(req.query.category))
    .input('CustomerId', sql.UniqueIdentifier, optionalUuid(req.query.customer));
}

// Filters that do not include the selected date range. This lets the same
// small query calculate period, today, and month metrics without correlated
// scalar subqueries repeatedly re-reading Commerce.Orders.
const orderDimensionFilter = `
  (@Currency IS NULL OR o.[Currency] = @Currency)
  AND (@OrderStatus IS NULL OR o.[OrderStatus] = @OrderStatus)
  AND (@CustomerId IS NULL OR o.[CustomerId] = @CustomerId)
  AND (@CountryCode IS NULL OR EXISTS (
    SELECT 1 FROM [Commerce].[OrderAddresses] oa
    WHERE oa.[OrderId] = o.[Id] AND oa.[AddressType] = N'Shipping' AND oa.[CountryCode] = @CountryCode
  ))
  AND (@ProductId IS NULL OR EXISTS (
    SELECT 1 FROM [Commerce].[OrderItems] oi WHERE oi.[OrderId] = o.[Id] AND oi.[ProductId] = @ProductId
  ))
  AND (@CategoryId IS NULL OR EXISTS (
    SELECT 1 FROM [Commerce].[OrderItems] oi
    JOIN [Commerce].[ProductCategories] pc ON pc.[ProductId] = oi.[ProductId]
    WHERE oi.[OrderId] = o.[Id] AND pc.[CategoryId] = @CategoryId
  ))
  AND (@SupplierId IS NULL OR EXISTS (
    SELECT 1 FROM [Commerce].[SupplierOrders] so WHERE so.[OrderId] = o.[Id] AND so.[SupplierId] = @SupplierId
  ))
`;

const orderFilter = `o.[CreatedAt] >= @StartAt AND o.[CreatedAt] < @EndAt AND ${orderDimensionFilter}`;

async function canonicalSchemaExists(pool) {
  const rows = normalizeRows(await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID(N'[Commerce].[Orders]', N'U') IS NOT NULL
                      AND OBJECT_ID(N'[ERP].[Payments]', N'U') IS NOT NULL
                      AND OBJECT_ID(N'[CRM].[Customers]', N'U') IS NOT NULL
                THEN 1 ELSE 0 END AS [Ready];
  `));
  return rows[0]?.Ready === 1;
}

async function runQuery(pool, req, range, label, text) {
  const request = addOverviewInputs(pool.request(), req, range);
  try {
    return normalizeRows(await request.query(text));
  } catch (error) {
    error.overviewQuery = label;
    throw error;
  }
}

async function buildOptimizedOverview(pool, req, range) {
  const periodOrders = `WITH FilteredOrders AS (
    SELECT o.* FROM [Commerce].[Orders] o WHERE ${orderFilter}
  )
  SELECT
    COALESCE(SUM(CASE WHEN [OrderStatus] <> N'Cancelled' AND [PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN [TotalAmount] - [RefundedAmount] ELSE 0 END), 0) AS [RevenuePeriod],
    COUNT_BIG(*) AS [OrdersPeriod],
    COALESCE(AVG(CASE WHEN [OrderStatus] <> N'Cancelled' AND [PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') AND [TotalAmount] - [RefundedAmount] <> 0 THEN [TotalAmount] - [RefundedAmount] END), 0) AS [AverageOrderValue],
    SUM(CASE WHEN [PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [PaidOrders],
    SUM(CASE WHEN [PaymentStatus] IN (N'Pending', N'Authorized') THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [PendingOrders],
    SUM(CASE WHEN [OrderStatus] = N'Cancelled' THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [CancelledOrders],
    COALESCE(SUM(CASE WHEN [OrderStatus] <> N'Cancelled' AND [PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN [TaxAmount] ELSE 0 END), 0) AS [TaxCollected],
    SUM(CASE WHEN [CreatedAt] >= @TodayStart AND [CreatedAt] < @TomorrowStart THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [OrdersToday],
    SUM(CASE WHEN [CreatedAt] >= @MonthStart AND [CreatedAt] < @TomorrowStart THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [OrdersThisMonth],
    COALESCE(SUM(CASE WHEN [CreatedAt] >= @TodayStart AND [CreatedAt] < @TomorrowStart AND [OrderStatus] <> N'Cancelled' AND [PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN [TotalAmount] - [RefundedAmount] ELSE 0 END), 0) AS [RevenueToday],
    COALESCE(SUM(CASE WHEN [CreatedAt] >= @MonthStart AND [CreatedAt] < @TomorrowStart AND [OrderStatus] <> N'Cancelled' AND [PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN [TotalAmount] - [RefundedAmount] ELSE 0 END), 0) AS [RevenueThisMonth],
    SUM(CASE WHEN [PaymentStatus] IN (N'Pending', N'Authorized') THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [AwaitingPayment],
    SUM(CASE WHEN [FulfillmentStatus] = N'Unfulfilled' THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [AwaitingFulfillment],
    SUM(CASE WHEN [OrderStatus] = N'Processing' THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [ProcessingOrders]
  FROM FilteredOrders;`;

  const itemMetrics = `WITH FilteredOrders AS (
    SELECT o.[Id], o.[OrderStatus], o.[PaymentStatus]
    FROM [Commerce].[Orders] o WHERE ${orderFilter}
  )
  SELECT COALESCE(SUM(CASE WHEN o.[OrderStatus] <> N'Cancelled'
        AND o.[PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded')
        THEN oi.[TotalAmount] ELSE 0 END), 0) AS [GrossSales],
         COALESCE(SUM(CASE WHEN o.[OrderStatus] <> N'Cancelled'
        AND o.[PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded')
        THEN COALESCE(oi.[UnitCost], pv.[CostPrice], 0) * oi.[Quantity] ELSE 0 END), 0) AS [COGS]
  FROM [Commerce].[OrderItems] oi
  LEFT JOIN [Commerce].[ProductVariants] pv ON pv.[Id] = oi.[VariantId]
  JOIN FilteredOrders o ON o.[Id] = oi.[OrderId];`;

  const financeMetrics = `
    SELECT
      (SELECT COALESCE(SUM(r.[Amount]), 0)
       FROM [ERP].[Refunds] r
       JOIN [Commerce].[Orders] o ON o.[Id] = r.[OrderId]
       WHERE r.[CreatedAt] >= @StartAt AND r.[CreatedAt] < @EndAt
         AND (@Currency IS NULL OR r.[Currency] = @Currency)
         AND ${orderDimensionFilter}) AS [RefundAmount],
      (SELECT COALESCE(SUM([TotalAmount]), 0) FROM [ERP].[Expenses] WHERE [ExpenseDate] >= CONVERT(DATE, @StartAt) AND [ExpenseDate] < CONVERT(DATE, @EndAt) AND (@Currency IS NULL OR [Currency] = @Currency)) AS [OperatingExpenses],
      (SELECT COALESCE(SUM(CASE WHEN [Direction] = N'Incoming' THEN [Amount] ELSE -[Amount] END), 0) FROM [ERP].[Payments] WHERE [Status] = N'Paid' AND COALESCE([ProcessedAt], [CreatedAt]) < @EndAt AND (@Currency IS NULL OR [Currency] = @Currency)) AS [CashPosition],
      (SELECT COALESCE(SUM([BalanceAmount]), 0) FROM [ERP].[Invoices] WHERE [Status] NOT IN (N'Paid', N'Void') AND (@Currency IS NULL OR [Currency] = @Currency)) AS [AccountsReceivable],
      (SELECT COALESCE(SUM([BalanceAmount]), 0) FROM [ERP].[SupplierBills] WHERE [Status] NOT IN (N'Paid', N'Void') AND (@Currency IS NULL OR [Currency] = @Currency) AND (@SupplierId IS NULL OR [SupplierId] = @SupplierId)) AS [AccountsPayable],
      (SELECT COALESCE(SUM([TaxAmount]), 0) FROM [ERP].[TaxTransactions] WHERE [CreatedAt] >= @StartAt AND [CreatedAt] < @EndAt AND (@Currency IS NULL OR [Currency] = @Currency)) AS [TaxPayable];`;

  const productMetrics = `
    SELECT
      (SELECT COUNT_BIG(*) FROM [Commerce].[Products] WHERE [Status] = N'Active') AS [ActiveProducts],
      (SELECT COUNT_BIG(*) FROM [Commerce].[Products] WHERE [Status] = N'Draft') AS [DraftProducts],
      (SELECT COUNT_BIG(*) FROM [Commerce].[ProductVariants] WHERE [Status] = N'Active' AND [AvailableQuantity] > 0 AND [AvailableQuantity] <= [LowStockThreshold]) AS [LowStockProducts],
      (SELECT COUNT_BIG(*) FROM [Commerce].[ProductVariants] WHERE [Status] = N'Active' AND [AvailableQuantity] <= 0) AS [OutOfStockProducts],
      (SELECT COALESCE(SUM([CostPrice] * [AvailableQuantity]), 0) FROM [Commerce].[ProductVariants] WHERE [Status] = N'Active') AS [InventoryCost],
      (SELECT COALESCE(SUM([SellingPrice] * [AvailableQuantity]), 0) FROM [Commerce].[ProductVariants] WHERE [Status] = N'Active') AS [InventoryRetailValue],
      (SELECT COALESCE(SUM(([SellingPrice] - [CostPrice]) * [AvailableQuantity]), 0) FROM [Commerce].[ProductVariants] WHERE [Status] = N'Active') AS [InventoryProfitPotential];`;

  const fulfillmentMetrics = `WITH FilteredOrders AS (
    SELECT o.[Id], o.[OrderStatus], o.[FulfillmentStatus]
    FROM [Commerce].[Orders] o WHERE ${orderFilter}
  ), EffectiveFulfillment AS (
    SELECT o.[Id], CASE
      WHEN o.[OrderStatus] = N'Cancelled' THEN N'Cancelled'
      WHEN o.[OrderStatus] = N'Delivered' OR o.[FulfillmentStatus] = N'Delivered'
        OR EXISTS (SELECT 1 FROM [Commerce].[Shipments] s WHERE s.[OrderId] = o.[Id] AND s.[Status] = N'Delivered')
        THEN N'Delivered'
      WHEN o.[OrderStatus] IN (N'Shipped', N'In Transit', N'Out for Delivery')
        OR o.[FulfillmentStatus] IN (N'Shipped', N'In Transit', N'Out for Delivery')
        OR EXISTS (SELECT 1 FROM [Commerce].[Shipments] s WHERE s.[OrderId] = o.[Id] AND s.[Status] IN (N'Shipped', N'In Transit', N'Out for Delivery'))
        THEN N'Shipped'
      ELSE o.[FulfillmentStatus]
    END AS [FulfillmentStatus]
    FROM FilteredOrders o
  )
  SELECT
    COALESCE((SELECT COUNT_BIG(*) FROM EffectiveFulfillment WHERE [FulfillmentStatus] = N'Shipped'), 0) AS [ShippedOrders],
    COALESCE((SELECT COUNT_BIG(*) FROM EffectiveFulfillment WHERE [FulfillmentStatus] = N'Delivered'), 0) AS [DeliveredOrders],
    COALESCE((SELECT COUNT_BIG(DISTINCT o.[Id])
      FROM [Commerce].[TrackingEvents] te
      JOIN [Commerce].[Shipments] s ON s.[Id] = te.[ShipmentId]
      JOIN FilteredOrders o ON o.[Id] = s.[OrderId]
      WHERE te.[Status] IN (N'Exception', N'Failed', N'Returned')), 0) AS [ShippingExceptions];`;

  const supplierMetrics = `SELECT
    (SELECT COUNT_BIG(*) FROM [Commerce].[Suppliers] WHERE [Status] = N'Active' AND (@SupplierId IS NULL OR [Id] = @SupplierId)) AS [ActiveSuppliers],
    (SELECT COUNT_BIG(*) FROM [Commerce].[SupplierOrders] WHERE [CreatedAt] >= @StartAt AND [CreatedAt] < @EndAt AND [Status] IN (N'Pending', N'Ordered') AND (@SupplierId IS NULL OR [SupplierId] = @SupplierId)) AS [SupplierOrdersPending],
    (SELECT COUNT_BIG(*) FROM [Commerce].[SupplierOrders] WHERE [CreatedAt] >= @StartAt AND [CreatedAt] < @EndAt AND [Status] = N'Delayed' AND (@SupplierId IS NULL OR [SupplierId] = @SupplierId)) AS [SupplierOrdersDelayed],
    (SELECT COUNT_BIG(*) FROM [Commerce].[SupplierSyncLogs] WHERE [StartedAt] >= @StartAt AND [StartedAt] < @EndAt AND [Status] = N'Failed' AND (@SupplierId IS NULL OR [SupplierId] = @SupplierId)) AS [SupplierSyncFailures],
    (SELECT COUNT_BIG(*) FROM [Commerce].[SupplierProducts] sp JOIN [Commerce].[ProductVariants] pv ON pv.[Id] = sp.[VariantId]
      WHERE sp.[SyncStatus] = N'Active' AND sp.[SupplierCost] >= pv.[SellingPrice] AND (@Currency IS NULL OR sp.[Currency] = @Currency) AND (@SupplierId IS NULL OR sp.[SupplierId] = @SupplierId)) AS [SupplierCostWarnings];`;

  const customerMetrics = `SELECT
    (SELECT COUNT_BIG(*) FROM [CRM].[Customers] WHERE [DeletedAt] IS NULL AND [IsActive] = 1) AS [TotalCustomers],
    (SELECT COUNT_BIG(*) FROM [CRM].[Customers] WHERE [CreatedAt] >= @TodayStart AND [CreatedAt] < @TomorrowStart) AS [NewCustomersToday],
    (SELECT COUNT_BIG(*) FROM [CRM].[Customers] WHERE [CreatedAt] >= @MonthStart AND [CreatedAt] < @TomorrowStart) AS [NewCustomersThisMonth],
    (SELECT COUNT_BIG(*) FROM (SELECT o.[CustomerId] FROM [Commerce].[Orders] o WHERE ${orderFilter} AND o.[CustomerId] IS NOT NULL GROUP BY o.[CustomerId] HAVING COUNT_BIG(*) > 1) x) AS [ReturningCustomers],
    (SELECT COUNT_BIG(DISTINCT [CustomerId]) FROM [CRM].[Tickets] WHERE [Status] NOT IN (N'Resolved', N'Closed') AND [CustomerId] IS NOT NULL) AS [CustomersWithOpenTickets];`;

  const supportMetrics = `SELECT
    (SELECT COUNT_BIG(*) FROM [CRM].[Tickets] WHERE [Status] NOT IN (N'Resolved', N'Closed')) AS [OpenTickets],
    (SELECT COUNT_BIG(*) FROM [CRM].[Tickets] WHERE [Status] NOT IN (N'Resolved', N'Closed') AND [Priority] IN (N'Urgent', N'Critical')) AS [UrgentTickets],
    (SELECT COUNT_BIG(*) FROM [CRM].[Tickets] WHERE [Status] NOT IN (N'Resolved', N'Closed') AND [AssignedUserId] IS NULL) AS [UnassignedTickets],
    (SELECT COALESCE(AVG(CONVERT(DECIMAL(19,4), DATEDIFF(MINUTE, [CreatedAt], [ResolvedAt])) / 60), 0) FROM [CRM].[Tickets] WHERE [ResolvedAt] >= @StartAt AND [ResolvedAt] < @EndAt) AS [AverageResolutionHours];`;

  const marketingMetrics = `SELECT
    (SELECT COUNT_BIG(*) FROM [CRM].[Campaigns] WHERE [Status] = N'Active' AND ([StartAt] IS NULL OR [StartAt] < @EndAt) AND ([EndAt] IS NULL OR [EndAt] >= @StartAt)) AS [ActiveCampaigns],
    (SELECT COALESCE(SUM([RevenueAmount]), 0) FROM [CRM].[CampaignEvents] WHERE [EventAt] >= @StartAt AND [EventAt] < @EndAt AND (@Currency IS NULL OR [Currency] = @Currency)) AS [CampaignRevenue],
    (SELECT COUNT_BIG(DISTINCT [OrderId]) FROM [CRM].[CampaignEvents] WHERE [EventAt] >= @StartAt AND [EventAt] < @EndAt AND [OrderId] IS NOT NULL) AS [CampaignOrders],
    (SELECT COALESCE(SUM([BudgetAmount]), 0) FROM [CRM].[Campaigns] WHERE [Status] = N'Active' AND (@Currency IS NULL OR [Currency] = @Currency)) AS [CampaignBudget];`;

  const loyaltyMetrics = `SELECT
    (SELECT COUNT_BIG(*) FROM [CRM].[LoyaltyAccounts]) AS [ActiveLoyaltyMembers],
    (SELECT COALESCE(SUM(CASE WHEN [Type] IN (N'Earn', N'Adjustment') AND [Points] > 0 THEN [Points] ELSE 0 END), 0) FROM [CRM].[LoyaltyTransactions] WHERE [CreatedAt] >= @StartAt AND [CreatedAt] < @EndAt) AS [PointsIssued],
    (SELECT COALESCE(SUM(CASE WHEN [Type] = N'Redeem' THEN ABS([Points]) ELSE 0 END), 0) FROM [CRM].[LoyaltyTransactions] WHERE [CreatedAt] >= @StartAt AND [CreatedAt] < @EndAt) AS [PointsRedeemed];`;

  const dailySalesQuery = `
    SELECT CONVERT(char(10), CONVERT(date, o.[CreatedAt]), 23) AS [Day],
      COALESCE(SUM(CASE WHEN o.[OrderStatus] <> N'Cancelled' AND o.[PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded')
        THEN o.[TotalAmount] - COALESCE(o.[RefundedAmount], 0) ELSE 0 END), 0) AS [Revenue],
      COUNT_BIG(*) AS [Orders],
      SUM(CASE WHEN o.[PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [PaidOrders],
      SUM(CASE WHEN o.[OrderStatus] = N'Cancelled' THEN CONVERT(BIGINT, 1) ELSE CONVERT(BIGINT, 0) END) AS [CancelledOrders]
    FROM [Commerce].[Orders] o
    WHERE ${orderFilter}
    GROUP BY CONVERT(char(10), CONVERT(date, o.[CreatedAt]), 23)
    ORDER BY [Day];`;

  const topProductsQuery = `SELECT TOP (5) p.[Id], p.[Name], p.[SKU], SUM(oi.[Quantity]) AS [Units], SUM(oi.[TotalAmount]) AS [Revenue]
    FROM [Commerce].[OrderItems] oi JOIN [Commerce].[Products] p ON p.[Id] = oi.[ProductId] JOIN [Commerce].[Orders] o ON o.[Id] = oi.[OrderId]
    WHERE ${orderFilter} GROUP BY p.[Id], p.[Name], p.[SKU] ORDER BY SUM(oi.[TotalAmount]) DESC, SUM(oi.[Quantity]) DESC;`;

  const topCustomersQuery = `SELECT TOP (5) c.[Id], c.[CustomerNumber], COALESCE(NULLIF(c.[FullName], N''), c.[CustomerNumber]) AS [DisplayName], COUNT_BIG(o.[Id]) AS [Orders], SUM(o.[TotalAmount] - o.[RefundedAmount]) AS [LifetimeValue]
    FROM [CRM].[Customers] c JOIN [Commerce].[Orders] o ON o.[CustomerId] = c.[Id]
    WHERE ${orderFilter} GROUP BY c.[Id], c.[CustomerNumber], c.[FullName] ORDER BY SUM(o.[TotalAmount] - o.[RefundedAmount]) DESC;`;

  const results = await Promise.all([
    runQuery(pool, req, range, 'orders', periodOrders),
    runQuery(pool, req, range, 'items', itemMetrics),
    runQuery(pool, req, range, 'finance', financeMetrics),
    runQuery(pool, req, range, 'products', productMetrics),
    runQuery(pool, req, range, 'fulfillment', fulfillmentMetrics),
    runQuery(pool, req, range, 'suppliers', supplierMetrics),
    runQuery(pool, req, range, 'customers', customerMetrics),
    runQuery(pool, req, range, 'support', supportMetrics),
    runQuery(pool, req, range, 'marketing', marketingMetrics),
    runQuery(pool, req, range, 'loyalty', loyaltyMetrics),
    runQuery(pool, req, range, 'dailySales', dailySalesQuery),
    runQuery(pool, req, range, 'topProducts', topProductsQuery),
    runQuery(pool, req, range, 'topCustomers', topCustomersQuery),
    pool.request().query(`SELECT TOP (5) [Id], [TicketNumber], [Subject], [Priority], [Status], [UpdatedAt] FROM [CRM].[Tickets] ORDER BY [UpdatedAt] DESC;`),
    pool.request().query(`SELECT COALESCE(t.[Name], N'Unassigned') AS [Tier], COUNT_BIG(*) AS [Customers] FROM [CRM].[LoyaltyAccounts] a LEFT JOIN [CRM].[LoyaltyTiers] t ON t.[Id] = a.[TierId] GROUP BY t.[Name] ORDER BY COUNT_BIG(*) DESC;`)
  ]);

  const [orders, items, finance, products, fulfillment, suppliers, customers, support, marketing, loyalty, dailySales, topProducts, topCustomers, ticketResult, tierResult] = results;
  const row = orders[0] || {};
  const itemRow = items[0] || {};
  const financeRow = finance[0] || {};
  const productRow = products[0] || {};
  const fulfillmentRow = fulfillment[0] || {};
  const supplierRow = suppliers[0] || {};
  const customerRow = customers[0] || {};
  const supportRow = support[0] || {};
  const marketingRow = marketing[0] || {};
  const loyaltyRow = loyalty[0] || {};
  const grossSales = asNumber(itemRow.GrossSales);
  const cogs = asNumber(itemRow.COGS);
  const refundAmount = asNumber(financeRow.RefundAmount);
  const operatingExpenses = asNumber(financeRow.OperatingExpenses);
  const campaignRevenue = asNumber(marketingRow.CampaignRevenue);
  const campaignBudget = asNumber(marketingRow.CampaignBudget);
  const netSales = grossSales - refundAmount;
  const grossProfit = netSales - cogs;

  return {
    generatedAt: new Date().toISOString(),
    range: { key: range.key, start: range.start.toISOString(), endExclusive: range.end.toISOString() },
    series: {
      salesByDay: dailySales.map(day => ({
        date: new Date(day.Day).toISOString().slice(0, 10),
        revenue: asNumber(day.Revenue),
        orders: asNumber(day.Orders),
        paidOrders: asNumber(day.PaidOrders),
        cancelledOrders: asNumber(day.CancelledOrders)
      }))
    },
    filters: {
      currency: req.query.currency || null, country: req.query.country || null,
      supplier: optionalUuid(req.query.supplier), product: optionalUuid(req.query.product),
      category: optionalUuid(req.query.category), customer: optionalUuid(req.query.customer), orderStatus: req.query.orderStatus || null
    },
    sales: {
      revenuePeriod: asNumber(row.RevenuePeriod), revenueToday: asNumber(row.RevenueToday), revenueThisMonth: asNumber(row.RevenueThisMonth),
      ordersPeriod: asNumber(row.OrdersPeriod), ordersToday: asNumber(row.OrdersToday), ordersThisMonth: asNumber(row.OrdersThisMonth),
      averageOrderValue: asNumber(row.AverageOrderValue), paidOrders: asNumber(row.PaidOrders), pendingOrders: asNumber(row.PendingOrders),
      cancelledOrders: asNumber(row.CancelledOrders), refundAmount
    },
    finance: {
      grossSales, netSales, cogs, grossProfit,
      grossMarginPercent: netSales > 0 ? (grossProfit / netSales) * 100 : 0,
      operatingExpenses, netProfit: grossProfit - operatingExpenses,
      cashPosition: asNumber(financeRow.CashPosition), accountsReceivable: asNumber(financeRow.AccountsReceivable), accountsPayable: asNumber(financeRow.AccountsPayable),
      taxCollected: asNumber(row.TaxCollected), taxPayable: asNumber(financeRow.TaxPayable)
    },
    products: {
      activeProducts: asNumber(productRow.ActiveProducts), draftProducts: asNumber(productRow.DraftProducts), lowStockProducts: asNumber(productRow.LowStockProducts),
      outOfStockProducts: asNumber(productRow.OutOfStockProducts),
      inventoryCost: asNumber(productRow.InventoryCost),
      inventoryRetailValue: asNumber(productRow.InventoryRetailValue),
      inventoryProfitPotential: asNumber(productRow.InventoryProfitPotential),
      topProducts: topProducts.map(p => ({ id: p.Id, name: p.Name, sku: p.SKU, units: asNumber(p.Units), revenue: asNumber(p.Revenue) }))
    },
    fulfillment: {
      awaitingPayment: asNumber(row.AwaitingPayment), awaitingFulfillment: asNumber(row.AwaitingFulfillment), processing: asNumber(row.ProcessingOrders),
      shipped: asNumber(fulfillmentRow.ShippedOrders), delivered: asNumber(fulfillmentRow.DeliveredOrders), shippingExceptions: asNumber(fulfillmentRow.ShippingExceptions)
    },
    suppliers: {
      activeSuppliers: asNumber(supplierRow.ActiveSuppliers), ordersPending: asNumber(supplierRow.SupplierOrdersPending), ordersDelayed: asNumber(supplierRow.SupplierOrdersDelayed),
      syncFailures: asNumber(supplierRow.SupplierSyncFailures), costWarnings: asNumber(supplierRow.SupplierCostWarnings)
    },
    customers: {
      totalCustomers: asNumber(customerRow.TotalCustomers), newToday: asNumber(customerRow.NewCustomersToday), newThisMonth: asNumber(customerRow.NewCustomersThisMonth),
      returningCustomers: asNumber(customerRow.ReturningCustomers), customersWithOpenTickets: asNumber(customerRow.CustomersWithOpenTickets),
      topCustomers: topCustomers.map(c => ({ id: c.Id, customerNumber: c.CustomerNumber, displayName: c.DisplayName, orders: asNumber(c.Orders), lifetimeValue: asNumber(c.LifetimeValue) }))
    },
    support: {
      openTickets: asNumber(supportRow.OpenTickets), urgentTickets: asNumber(supportRow.UrgentTickets), unassignedTickets: asNumber(supportRow.UnassignedTickets),
      averageResolutionHours: asNumber(supportRow.AverageResolutionHours), recentTickets: normalizeRows(ticketResult).map(t => ({ id: t.Id, ticketNumber: t.TicketNumber, subject: t.Subject, priority: t.Priority, status: t.Status, updatedAt: t.UpdatedAt }))
    },
    marketing: {
      activeCampaigns: asNumber(marketingRow.ActiveCampaigns), revenue: campaignRevenue, orders: asNumber(marketingRow.CampaignOrders), budget: campaignBudget,
      roiPercent: campaignBudget > 0 ? ((campaignRevenue - campaignBudget) / campaignBudget) * 100 : null
    },
    loyalty: {
      activeMembers: asNumber(loyaltyRow.ActiveLoyaltyMembers), pointsIssued: asNumber(loyaltyRow.PointsIssued), pointsRedeemed: asNumber(loyaltyRow.PointsRedeemed),
      customersByTier: normalizeRows(tierResult).map(t => ({ tier: t.Tier, customers: asNumber(t.Customers) }))
    }
  };
}

router.get('/api/admin/overview', requireAdmin, async (req, res) => {
  let range;
  try {
    range = resolveRange(req.query || {});
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const pool = await getPool();
    if (!(await canonicalSchemaExists(pool))) {
      return res.status(503).json({ code: 'CANONICAL_SCHEMA_NOT_READY', error: 'Weluxo canonical database migration has not been applied' });
    }
    return res.json(await buildOptimizedOverview(pool, req, range));
  } catch (error) {
    console.error('GET /api/admin/overview failed', { message: error.message, code: error.code, number: error.number, query: error.overviewQuery });
    if (error.code === 'ETIMEOUT' || error.number === 'ETIMEOUT') {
      return res.status(504).json({ code: 'OVERVIEW_QUERY_TIMEOUT', error: 'Overview metrics took too long to calculate. Please retry.' });
    }
    if (error.number === 208) {
      return res.status(503).json({ code: 'CANONICAL_SCHEMA_NOT_READY', error: 'Required Weluxo database objects are not available' });
    }
    return res.status(500).json({ error: 'Unable to calculate overview metrics' });
  }
});

module.exports = router;
