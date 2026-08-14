const express = require('express');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { getPool } = require('../utils/dbConnection');

const router = express.Router();

function requireAdmin(req, res, next) {
  const authorization = req.headers?.authorization || '';
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : null;
  const token = bearer || req.cookies?.viva_token;
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: 'Authentication required' });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (String(user.role || '').toLowerCase() !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
    next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

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
    requiredObjects: ['Commerce.Orders'],
    columns: ['Order number', 'Order status', 'Payment', 'Fulfillment', 'Total', 'Refunded', 'Currency', 'Created'],
    query: `SELECT TOP (@Limit) o.[Id], o.[OrderNumber], o.[OrderStatus], o.[PaymentStatus], o.[FulfillmentStatus], o.[TotalAmount], o.[RefundedAmount], o.[Currency], o.[CreatedAt]
      FROM [Commerce].[Orders] o WHERE o.[CreatedAt] >= @StartAt AND o.[CreatedAt] < @EndAt
      AND (@Currency IS NULL OR o.[Currency] = @Currency) AND (@Status IS NULL OR o.[OrderStatus] = @Status)
      AND (@PaymentStatus IS NULL OR o.[PaymentStatus] = @PaymentStatus) AND (@FulfillmentStatus IS NULL OR o.[FulfillmentStatus] = @FulfillmentStatus)
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

module.exports = router;
