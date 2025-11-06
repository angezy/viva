const express = require('express');
const router = express.Router();
const { getPool } = require('../utils/dbConnection');

// Helper to normalize mssql result/result.recordset
function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.recordset) return result.recordset;
  return [];
}

// GET /api/dashboard/profile
router.get('/api/dashboard/profile', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT TOP 1 UserID, Username, Email, FullName, AvatarUrl, Bio FROM User_tbl ORDER BY UserID`);
    const rows = normalizeResult(result);
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

    const r = rows[0];
    const mapped = {
      id: r.UserID ?? r.userId ?? r.id,
      username: r.Username ?? r.username ?? '',
      email: r.Email ?? r.email ?? '',
      name: r.FullName ?? r.Name ?? r.name ?? '',
      avatar: r.AvatarUrl ?? r.Avatar ?? r.img ?? null,
      bio: r.Bio ?? r.bio ?? null,
    };

    res.json(mapped);
  } catch (err) {
    console.error('/api/dashboard/profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/orders
router.get('/api/dashboard/orders', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 20 OrderId, OrderNumber, CreatedAt, TotalAmount, Status
      FROM Orders
      ORDER BY CreatedAt DESC
    `);
    const rows = normalizeResult(result);

    const mapped = rows.map(r => ({
      id: r.OrderId ?? r.orderId ?? r.id,
      number: r.OrderNumber ?? r.orderNumber ?? r.Number ?? '',
      createdAt: r.CreatedAt ?? r.createdAt ?? null,
      total: r.TotalAmount ?? r.total ?? 0,
      status: r.Status ?? r.status ?? 'unknown',
    }));

    res.json(mapped);
  } catch (err) {
    console.error('/api/dashboard/orders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/notifications
router.get('/api/dashboard/notifications', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 50 NotificationId, Title, Message, CreatedAt, IsRead
      FROM Notifications
      WHERE IsVisible = 1 OR IsVisible IS NULL
      ORDER BY CreatedAt DESC
    `);
    const rows = normalizeResult(result);

    const mapped = rows.map(n => ({
      id: n.NotificationId ?? n.id,
      title: n.Title ?? n.title ?? '',
      message: n.Message ?? n.message ?? '',
      createdAt: n.CreatedAt ?? n.createdAt ?? null,
      isRead: !!(n.IsRead || n.isRead),
    }));

    res.json(mapped);
  } catch (err) {
    console.error('/api/dashboard/notifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/settings
router.get('/api/dashboard/settings', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT TOP 1 SettingKey, SettingValue FROM DashboardSettings`);
    const rows = normalizeResult(result);

    // Convert rows like { SettingKey, SettingValue } to an object
    const settings = {};
    rows.forEach(r => {
      const key = r.SettingKey ?? r.key ?? null;
      const val = r.SettingValue ?? r.value ?? null;
      if (key) settings[key] = val;
    });

    res.json(settings);
  } catch (err) {
    console.error('/api/dashboard/settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/stats
router.get('/api/dashboard/stats', async (req, res) => {
  try {
    const pool = await getPool();

    // Example: aggregate counts for users, orders, products, recent revenue
    const usersRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM User_tbl`);
    const ordersRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Orders`);
    const productsRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Products_tbl`);
    const revenueRes = await pool.request().query(`SELECT ISNULL(SUM(TotalAmount),0) AS totalRevenue FROM Orders WHERE CreatedAt >= DATEADD(day, -30, GETDATE())`);

    const users = normalizeResult(usersRes)[0];
    const orders = normalizeResult(ordersRes)[0];
    const products = normalizeResult(productsRes)[0];
    const revenue = normalizeResult(revenueRes)[0];

    const payload = {
      users: users ? users.cnt ?? users.CNT ?? users.count ?? 0 : 0,
      orders: orders ? orders.cnt ?? orders.CNT ?? orders.count ?? 0 : 0,
      products: products ? products.cnt ?? products.CNT ?? products.count ?? 0 : 0,
      revenueLast30Days: revenue ? revenue.totalRevenue ?? revenue.TotalRevenue ?? 0 : 0,
    };

    res.json(payload);
  } catch (err) {
    console.error('/api/dashboard/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
