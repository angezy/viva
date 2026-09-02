const express = require('express');
const sql = require('mssql');
const { getPool } = require('../utils/dbConnection');
const { requireRecordPermission, requirePermission, hasPermission } = require('../utils/rbac');

const router = express.Router();

const requireAdmin = requireRecordPermission('adminUser');
const requireOrdersRead = requirePermission('orders.read', 'adminUser');

function dateRange(query) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const add = (date, days) => { const value = new Date(date); value.setUTCDate(value.getUTCDate() + days); return value; };
  const key = String(query.range || 'last30').toLowerCase();
  if (key === 'today') return [today, add(today, 1)];
  if (key === 'yesterday') return [add(today, -1), today];
  if (key === 'last7') return [add(today, -6), add(today, 1)];
  if (key === 'thismonth') return [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), add(today, 1)];
  if (key === 'lastmonth') return [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))];
  if (key === 'thisyear') return [new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), add(today, 1)];
  if (key === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(query.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(query.to || '')) {
    return [new Date(`${query.from}T00:00:00.000Z`), add(new Date(`${query.to}T00:00:00.000Z`), 1)];
  }
  return [add(today, -29), add(today, 1)];
}

const definitions = {
  orders: {
    title: 'Orders',
    requiredObjects: ['Commerce.Orders', 'Commerce.StorefrontOrders'],
    columns: ['Order number', 'Customer', 'Order status', 'Payment', 'Fulfillment', 'Total', 'Refunded', 'Currency', 'Created'],
    query: `SELECT TOP (@Limit) o.[Id], o.[OrderNumber], o.[CustomerEmail],
        COALESCE(NULLIF(storefront.[Status], N''), o.[OrderStatus]) AS [OrderStatus],
        o.[PaymentStatus],
        COALESCE(NULLIF(storefront.[Status], N''), o.[FulfillmentStatus]) AS [FulfillmentStatus],
        o.[TotalAmount], o.[RefundedAmount], o.[Currency], o.[CreatedAt]
      FROM [Commerce].[Orders] o
      OUTER APPLY (
        SELECT TOP (1) so.[Status]
        FROM [Commerce].[StorefrontOrders] so
        WHERE so.[OrderId] = COALESCE(o.[LegacyOrderId], CONVERT(NVARCHAR(64), o.[Id]))
        ORDER BY so.[PlacedAt] DESC
      ) storefront
      WHERE o.[CreatedAt] >= @StartAt AND o.[CreatedAt] < @EndAt
      AND (@Currency IS NULL OR o.[Currency] = @Currency)
      AND (@Status IS NULL OR COALESCE(NULLIF(storefront.[Status], N''), o.[OrderStatus]) = @Status)
      AND (@PaymentStatus IS NULL OR o.[PaymentStatus] = @PaymentStatus)
      AND (@FulfillmentStatus IS NULL OR COALESCE(NULLIF(storefront.[Status], N''), o.[FulfillmentStatus]) = @FulfillmentStatus)
      ORDER BY o.[CreatedAt] DESC`
  },
  finance: {
    title: 'Finance transactions',
    requiredObjects: ['ERP.Payments'],
    columns: ['Reference', 'Direction', 'Method', 'Status', 'Amount', 'Currency', 'Processed', 'Created'],
    query: `SELECT TOP (@Limit) p.[Id], COALESCE(p.[ExternalTransactionId], CONVERT(NVARCHAR(36), p.[Id])) AS [Reference], p.[Direction], p.[PaymentMethod], p.[Status], p.[Amount], p.[Currency], p.[ProcessedAt], p.[CreatedAt]
      FROM [ERP].[Payments] p WHERE p.[CreatedAt] >= @StartAt AND p.[CreatedAt] < @EndAt
      AND (@Currency IS NULL OR p.[Currency] = @Currency) AND (@Status IS NULL OR p.[Status] = @Status)
      ORDER BY p.[CreatedAt] DESC`
  },
  suppliers: {
    title: 'Supplier orders',
    requiredObjects: ['Commerce.SupplierOrders', 'Commerce.Suppliers'],
    columns: ['Supplier', 'External order', 'Status', 'Product cost', 'Shipping cost', 'Total cost', 'Currency', 'Created'],
    query: `SELECT TOP (@Limit) so.[Id], s.[Name] AS [Supplier], so.[ExternalOrderId], so.[Status], so.[ProductCost], so.[ShippingCost], so.[TotalCost], so.[Currency], so.[CreatedAt]
      FROM [Commerce].[SupplierOrders] so JOIN [Commerce].[Suppliers] s ON s.[Id] = so.[SupplierId]
      WHERE so.[CreatedAt] >= @StartAt AND so.[CreatedAt] < @EndAt AND (@Currency IS NULL OR so.[Currency] = @Currency)
      AND (@Status IS NULL OR so.[Status] = @Status) ORDER BY so.[CreatedAt] DESC`
  },
  marketing: {
    title: 'Campaigns',
    requiredObjects: ['CRM.Campaigns'],
    columns: ['Campaign', 'Channel', 'Status', 'Start', 'End', 'Budget', 'Currency', 'Updated'],
    query: `SELECT TOP (@Limit) c.[Id], c.[Name] AS [Campaign], c.[Channel], c.[Status], c.[StartAt], c.[EndAt], c.[BudgetAmount], c.[Currency], c.[UpdatedAt]
      FROM [CRM].[Campaigns] c WHERE (@Currency IS NULL OR c.[Currency] = @Currency) AND (@Status IS NULL OR c.[Status] = @Status)
      ORDER BY c.[UpdatedAt] DESC`
  },
  loyalty: {
    title: 'Loyalty transactions',
    requiredObjects: ['CRM.LoyaltyTransactions', 'CRM.LoyaltyAccounts', 'CRM.Customers'],
    columns: ['Customer', 'Tier', 'Type', 'Points', 'Description', 'Created'],
    query: `SELECT TOP (@Limit) lt.[Id], c.[CustomerNumber] AS [Customer], COALESCE(t.[Name], N'Unassigned') AS [Tier], lt.[Type], lt.[Points], lt.[Description], lt.[CreatedAt]
      FROM [CRM].[LoyaltyTransactions] lt JOIN [CRM].[LoyaltyAccounts] la ON la.[Id] = lt.[LoyaltyAccountId]
      JOIN [CRM].[Customers] c ON c.[Id] = la.[CustomerId] LEFT JOIN [CRM].[LoyaltyTiers] t ON t.[Id] = la.[TierId]
      WHERE lt.[CreatedAt] >= @StartAt AND lt.[CreatedAt] < @EndAt
      AND (@TransactionType IS NULL OR lt.[Type] = @TransactionType) AND (@Tier IS NULL OR t.[Name] = @Tier)
      ORDER BY lt.[CreatedAt] DESC`
  }
};

async function missingObjects(pool, objectNames) {
  const values = objectNames.map((_, index) => `(@Object${index})`).join(', ');
  const request = pool.request();
  objectNames.forEach((name, index) => request.input(`Object${index}`, sql.NVarChar(260), name));
  const result = await request.query(`
    SELECT requested.[ObjectName]
    FROM (VALUES ${values}) requested([ObjectName])
    WHERE OBJECT_ID(requested.[ObjectName], N'U') IS NULL;
  `);
  return (result.recordset || result || []).map(row => row.ObjectName);
}

router.get('/api/admin/records/:area', requireAdmin, async (req, res) => {
  const definition = definitions[String(req.params.area || '').toLowerCase()];
  if (!definition) return res.status(404).json({ error: 'Unknown admin record area' });
  const [start, end] = dateRange(req.query || {});
  const text = value => String(value || '').trim().slice(0, 60) || null;
  try {
    const pool = await getPool();
    const missing = await missingObjects(pool, definition.requiredObjects);
    if (missing.length) {
      return res.status(503).json({
        code: 'CANONICAL_SCHEMA_NOT_READY',
        error: 'Weluxo canonical database migration has not been applied',
        missingObjects: missing
      });
    }
    const result = await pool.request()
      .input('Limit', sql.Int, Math.min(Math.max(Number(req.query.limit) || 100, 1), 250))
      .input('StartAt', sql.DateTime2, start).input('EndAt', sql.DateTime2, end)
      .input('Currency', sql.Char(3), /^[A-Za-z]{3}$/.test(req.query.currency || '') ? req.query.currency.toUpperCase() : null)
      .input('Status', sql.NVarChar(40), text(req.query.status || req.query.orderStatus))
      .input('PaymentStatus', sql.NVarChar(40), text(req.query.paymentStatus))
      .input('FulfillmentStatus', sql.NVarChar(40), text(req.query.fulfillmentStatus))
      .input('TransactionType', sql.NVarChar(40), text(req.query.transactionType))
      .input('Tier', sql.NVarChar(120), text(req.query.tier))
      .query(definition.query);
    res.json({ title: definition.title, columns: definition.columns, rows: result.recordset || result || [], range: { start, endExclusive: end }, limit: Math.min(Math.max(Number(req.query.limit) || 100, 1), 250) });
  } catch (error) {
    console.error(`GET /api/admin/records/${req.params.area} failed`, error);
    if (error && error.number === 208) {
      return res.status(503).json({
        code: 'CANONICAL_SCHEMA_NOT_READY',
        error: 'Required Weluxo database objects are not available'
      });
    }
    res.status(500).json({ error: 'Unable to load admin records' });
  }
});

const ORDER_DETAIL_OBJECTS = [
  'Commerce.Orders',
  'Commerce.StorefrontOrders',
  'Commerce.OrderItems',
  'Commerce.OrderAddresses',
  'Commerce.OrderStatusHistory',
  'Commerce.Shipments',
  'Commerce.ShipmentItems',
  'Commerce.TrackingEvents',
  'Commerce.SupplierOrders',
  'Commerce.Suppliers',
  'ERP.Payments',
  'ERP.Refunds',
  'ERP.Invoices',
  'CRM.Customers'
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Order details are intentionally loaded on demand so the list stays fast and
// sensitive customer/payment information is only returned after an admin opens
// a specific order.
router.get('/api/admin/orders/:orderId', requireOrdersRead, async (req, res) => {
  const orderId = String(req.params.orderId || '').trim();
  if (!UUID_PATTERN.test(orderId)) return res.status(400).json({ error: 'Invalid order id' });

  try {
    const pool = await getPool();
    const missing = await missingObjects(pool, ORDER_DETAIL_OBJECTS);
    if (missing.length) {
      return res.status(503).json({
        code: 'CANONICAL_SCHEMA_NOT_READY',
        error: 'Weluxo canonical database migration has not been applied',
        missingObjects: missing
      });
    }

    const result = await pool.request()
      .input('OrderId', sql.UniqueIdentifier, orderId)
      .query(`
        SELECT o.[Id], o.[LegacyOrderId], o.[OrderNumber], o.[CustomerId], o.[Currency],
          COALESCE(NULLIF(storefront.[Status], N''), o.[OrderStatus]) AS [OrderStatus],
          o.[PaymentStatus],
          COALESCE(NULLIF(storefront.[Status], N''), o.[FulfillmentStatus]) AS [FulfillmentStatus],
          o.[DiscountAmount], o.[ShippingAmount], o.[TaxAmount], o.[RefundedAmount],
          o.[TotalAmount], o.[CustomerEmail], o.[CustomerPhone], o.[SalesChannel], o.[Source],
          o.[PlacedAt], o.[PaidAt], o.[CompletedAt], o.[CancelledAt], o.[CreatedAt], o.[UpdatedAt],
          c.[CustomerNumber], c.[FullName], c.[FirstName], c.[LastName]
        FROM [Commerce].[Orders] o
        LEFT JOIN [CRM].[Customers] c ON c.[Id] = o.[CustomerId]
        OUTER APPLY (
          SELECT TOP (1) so.[Status]
          FROM [Commerce].[StorefrontOrders] so
          WHERE so.[OrderId] = COALESCE(o.[LegacyOrderId], CONVERT(NVARCHAR(64), o.[Id]))
          ORDER BY so.[PlacedAt] DESC
        ) storefront
        WHERE o.[Id] = @OrderId;

        SELECT [Id], [SKU], [ProductName], [VariantName], [Quantity], [UnitPrice],
          [DiscountAmount], [TaxAmount], [TotalAmount], [UnitCost]
        FROM [Commerce].[OrderItems]
        WHERE [OrderId] = @OrderId
        ORDER BY [CreatedAt], [Id];

        SELECT [Id], [AddressType], [FirstName], [LastName], [Company], [Phone],
          [AddressLine1], [AddressLine2], [City], [StateProvince], [PostalCode], [CountryCode]
        FROM [Commerce].[OrderAddresses]
        WHERE [OrderId] = @OrderId
        ORDER BY CASE WHEN [AddressType] = N'Shipping' THEN 0 ELSE 1 END;

        SELECT [Id], [PreviousStatus], [NewStatus], [Reason], [ChangedByUserId], [CreatedAt]
        FROM [Commerce].[OrderStatusHistory]
        WHERE [OrderId] = @OrderId
        ORDER BY [CreatedAt] DESC;

        SELECT [Id], [Direction], [PaymentProvider], [PaymentMethod], [ExternalTransactionId],
          [Amount], [Currency], [Status], [ProcessedAt], [CreatedAt]
        FROM [ERP].[Payments]
        WHERE [OrderId] = @OrderId
        ORDER BY [CreatedAt] DESC;

        SELECT sh.[Id], sh.[ShipmentNumber], sh.[Carrier], sh.[Service], sh.[TrackingNumber],
          sh.[TrackingUrl], sh.[Status], sh.[ShippedAt], sh.[DeliveredAt], sh.[ShippingCost],
          sh.[Currency], s.[Name] AS [Supplier]
        FROM [Commerce].[Shipments] sh
        LEFT JOIN [Commerce].[Suppliers] s ON s.[Id] = sh.[SupplierId]
        WHERE sh.[OrderId] = @OrderId
        ORDER BY sh.[CreatedAt] DESC;

        SELECT te.[Id], te.[ShipmentId], te.[EventCode], te.[Status], te.[Description],
          te.[Location], te.[EventAt]
        FROM [Commerce].[TrackingEvents] te
        INNER JOIN [Commerce].[Shipments] sh ON sh.[Id] = te.[ShipmentId]
        WHERE sh.[OrderId] = @OrderId
        ORDER BY te.[EventAt] DESC;

        SELECT so.[Id], so.[PurchaseOrderNumber], so.[ExternalOrderId], so.[Status],
          so.[ProductCost], so.[ShippingCost], so.[TotalCost], so.[Currency], so.[OrderedAt],
          so.[ConfirmedAt], so.[ShippedAt], s.[Name] AS [Supplier]
        FROM [Commerce].[SupplierOrders] so
        LEFT JOIN [Commerce].[Suppliers] s ON s.[Id] = so.[SupplierId]
        WHERE so.[OrderId] = @OrderId
        ORDER BY so.[CreatedAt] DESC;

        SELECT [Id], [InvoiceNumber], [IssueDate], [DueDate], [Status], [Currency],
          [SubtotalAmount], [DiscountAmount], [TaxAmount], [TotalAmount], [PaidAmount], [BalanceAmount]
        FROM [ERP].[Invoices]
        WHERE [OrderId] = @OrderId
        ORDER BY [CreatedAt] DESC;

        SELECT r.[Id], r.[RefundNumber], r.[ExternalRefundId], r.[Amount], r.[Currency],
          r.[Reason], r.[Status], r.[CreatedAt], r.[ProcessedAt]
        FROM [ERP].[Refunds] r
        WHERE r.[OrderId] = @OrderId
        ORDER BY r.[CreatedAt] DESC;
      `);

    const recordsets = result.recordsets || [];
    const order = recordsets[0]?.[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isOperationalAdmin = !hasPermission(req.adminUser?.role, 'finance.read');
    res.json({
      order,
      items: recordsets[1] || [],
      addresses: recordsets[2] || [],
      history: recordsets[3] || [],
      // Employee sessions can process orders without seeing payment/refund
      // configuration or transaction details.
      payments: isOperationalAdmin ? [] : (recordsets[4] || []),
      shipments: recordsets[5] || [],
      trackingEvents: recordsets[6] || [],
      supplierOrders: recordsets[7] || [],
      invoices: isOperationalAdmin ? [] : (recordsets[8] || []),
      refunds: isOperationalAdmin ? [] : (recordsets[9] || [])
    });
  } catch (error) {
    console.error(`GET /api/admin/orders/${orderId} failed`, error);
    if (error && error.number === 208) {
      return res.status(503).json({
        code: 'CANONICAL_SCHEMA_NOT_READY',
        error: 'Required Weluxo database objects are not available'
      });
    }
    res.status(500).json({ error: 'Unable to load order details' });
  }
});

module.exports = router;
