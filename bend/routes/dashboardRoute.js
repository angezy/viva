const express = require('express');
const router = express.Router();
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const { getPool } = require('../utils/dbConnection');

// Helper to normalize mssql result/result.recordset
function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.recordset) return result.recordset;
  return [];
}

function requireDashboardAdmin(req, res, next) {
  const authorization = req.headers?.authorization || '';
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : null;
  const token = bearer || req.cookies?.viva_token;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return res.status(401).json({ error: 'Authentication required' });

  try {
    const user = jwt.verify(token, secret);
    if (String(user.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    req.dashboardUser = user;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Cache User_tbl columns so we can safely project optional fields
const userColumnsCache = { loaded: false, columns: new Set() };
async function loadUserColumns(pool) {
  if (userColumnsCache.loaded) return userColumnsCache.columns;
  try {
    const result = await pool
      .request()
      .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'User_tbl'`);
    const rows = normalizeResult(result);
    rows.forEach((row) => {
      const name = (row.COLUMN_NAME || row.column_name || "").toString().toLowerCase();
      if (name) userColumnsCache.columns.add(name);
    });
  } catch (err) {
    console.warn("Unable to read User_tbl columns", err && err.message ? err.message : err);
  } finally {
    userColumnsCache.loaded = true;
  }
  return userColumnsCache.columns;
}

async function tableExists(pool, tableName, schema = "dbo") {
  try {
    const result = await pool
      .request()
      .input("Table", tableName)
      .input("Schema", schema)
      .query(`
        SELECT 1 AS ExistsFlag
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = @Table AND TABLE_SCHEMA = @Schema
      `);
    const rows = normalizeResult(result);
    return rows.length > 0;
  } catch (err) {
    console.warn("tableExists check failed for", tableName, err && err.message ? err.message : err);
    return false;
  }
}

function isUniqueConstraintError(err) {
  return (
    err &&
    (err.number === 2627 ||
      err.number === 2601 ||
      /UNIQUE\s+KEY/i.test(err.message || "") ||
      /duplicate key/i.test(err.message || ""))
  );
}

function isForeignKeyConstraintError(err) {
  return err && err.number === 547;
}

function deriveBanStatus(row = {}, cols = new Set()) {
  const lowerCols = new Set(Array.from(cols).map((c) => c.toLowerCase()));
  if (lowerCols.has("isbanned")) return !!(row.IsBanned ?? row.isbanned ?? row.ISBANNED);
  if (lowerCols.has("banned")) return !!(row.Banned ?? row.banned);
  if (lowerCols.has("status")) {
    const status = String(row.Status ?? row.status ?? "").toLowerCase();
    if (status === "banned" || status === "inactive" || status === "blocked") return true;
    if (status === "active") return false;
  }
  if (lowerCols.has("active")) return !(row.Active === 1 || row.Active === true);
  if (lowerCols.has("isactive")) return !(row.IsActive === 1 || row.IsActive === true);
  return false;
}

function banUpdateClause(cols, banned) {
  const lowerCols = new Set(Array.from(cols).map((c) => c.toLowerCase()));
  if (lowerCols.has("isbanned")) return { clause: "IsBanned = @Banned", type: "bool" };
  if (lowerCols.has("banned")) return { clause: "Banned = @Banned", type: "bool" };
  if (lowerCols.has("status")) return { clause: "Status = @StatusVal", type: "status" };
  if (lowerCols.has("active")) return { clause: "Active = @ActiveVal", type: "active" };
  if (lowerCols.has("isactive")) return { clause: "IsActive = @ActiveVal", type: "active" };
  return null;
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
      SELECT TOP 20 OrderId, UserId, PlacedAt, Total, Status
      FROM Orders_tbl
      ORDER BY PlacedAt DESC
    `);
    const rows = normalizeResult(result);

    const mapped = rows.map(r => ({
      id: r.OrderId ?? r.orderId ?? r.id,
      number: r.OrderId ?? r.orderId ?? '',
      userId: r.UserId ?? r.userId ?? null,
      createdAt: r.PlacedAt ?? r.placedAt ?? r.CreatedAt ?? r.createdAt ?? null,
      total: r.Total ?? r.total ?? r.TotalAmount ?? 0,
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

// POST /api/dashboard/notifications
// Used by dashboard actions or backend jobs to show an administrator message.
router.post('/api/dashboard/notifications', requireDashboardAdmin, async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Title', sql.NVarChar(200), title)
      .input('Message', sql.NVarChar(sql.MAX), message)
      .query(`
        INSERT INTO Notifications (Title, Message, IsRead, IsVisible)
        OUTPUT INSERTED.NotificationId, INSERTED.Title, INSERTED.Message, INSERTED.CreatedAt, INSERTED.IsRead
        VALUES (@Title, @Message, 0, 1)
      `);
    const row = normalizeResult(result)[0];
    res.status(201).json({
      id: row.NotificationId,
      title: row.Title,
      message: row.Message,
      createdAt: row.CreatedAt,
      isRead: !!row.IsRead,
    });
  } catch (err) {
    console.error('/api/dashboard/notifications POST error:', err);
    res.status(500).json({ error: err.message || 'Unable to create notification' });
  }
});

// PATCH /api/dashboard/notifications/:notificationId
// Allows the dashboard to mark a notification as read or hide it.
router.patch('/api/dashboard/notifications/:notificationId', requireDashboardAdmin, async (req, res) => {
  const notificationId = Number(req.params.notificationId);
  if (!Number.isInteger(notificationId) || notificationId < 1) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  const { isRead, isVisible } = req.body || {};
  if (typeof isRead !== 'boolean' && typeof isVisible !== 'boolean') {
    return res.status(400).json({ error: 'Provide isRead or isVisible as a boolean' });
  }

  try {
    const setClauses = [];
    let request = (await getPool()).request().input('NotificationId', sql.Int, notificationId);
    if (typeof isRead === 'boolean') {
      setClauses.push('IsRead = @IsRead');
      request = request.input('IsRead', sql.Bit, isRead);
    }
    if (typeof isVisible === 'boolean') {
      setClauses.push('IsVisible = @IsVisible');
      request = request.input('IsVisible', sql.Bit, isVisible);
    }

    const result = await request.query(`UPDATE Notifications SET ${setClauses.join(', ')} WHERE NotificationId = @NotificationId`);
    if (!result.rowsAffected?.[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true, id: notificationId, isRead, isVisible });
  } catch (err) {
    console.error('/api/dashboard/notifications PATCH error:', err);
    res.status(500).json({ error: err.message || 'Unable to update notification' });
  }
});

// GET /api/dashboard/settings
router.get('/api/dashboard/settings', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT SettingKey, SettingValue FROM DashboardSettings`);
    const rows = normalizeResult(result);

    // Convert persisted string values into the booleans the UI expects.
    const settings = {};
    rows.forEach(r => {
      const key = r.SettingKey ?? r.key ?? null;
      const val = r.SettingValue ?? r.value ?? null;
      if (key === 'emailNotifications' || key === 'darkMode') {
        settings[key] = String(val).toLowerCase() === 'true';
      }
    });

    res.json({ emailNotifications: true, darkMode: false, ...settings });
  } catch (err) {
    console.error('/api/dashboard/settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dashboard/settings
router.put('/api/dashboard/settings', requireDashboardAdmin, async (req, res) => {
  const body = req.body || {};
  const supportedKeys = ['emailNotifications', 'darkMode'];
  const entries = supportedKeys.filter((key) => typeof body[key] === 'boolean');
  if (!entries.length) {
    return res.status(400).json({ error: 'Provide emailNotifications or darkMode as a boolean' });
  }

  try {
    const pool = await getPool();
    for (const key of entries) {
      const value = body[key] ? 'true' : 'false';
      const update = await pool
        .request()
        .input('SettingKey', sql.NVarChar(100), key)
        .input('SettingValue', sql.NVarChar(sql.MAX), value)
        .query(`UPDATE DashboardSettings SET SettingValue = @SettingValue WHERE SettingKey = @SettingKey`);
      if (!update.rowsAffected?.[0]) {
        await pool
          .request()
          .input('SettingKey', sql.NVarChar(100), key)
          .input('SettingValue', sql.NVarChar(sql.MAX), value)
          .query(`INSERT INTO DashboardSettings (SettingKey, SettingValue) VALUES (@SettingKey, @SettingValue)`);
      }
    }
    res.json({
      emailNotifications: typeof body.emailNotifications === 'boolean' ? body.emailNotifications : undefined,
      darkMode: typeof body.darkMode === 'boolean' ? body.darkMode : undefined,
    });
  } catch (err) {
    console.error('/api/dashboard/settings PUT error:', err);
    res.status(500).json({ error: err.message || 'Unable to save settings' });
  }
});

// GET /api/dashboard/users
router.get('/api/dashboard/users', async (_req, res) => {
  try {
    const pool = await getPool();
    const cols = await loadUserColumns(pool);
    const hasOrdersTable = await tableExists(pool, "Orders_tbl");
    const baseCols = ["UserID", "Username", "Email", "Role", "CreatedAt", "LastLogin"];
    const optionalCols = [
      { db: "FullName", key: "FullName" },
      { db: "AvatarUrl", key: "AvatarUrl" },
      { db: "Avatar", key: "Avatar" },
      { db: "Country", key: "Country" },
      { db: "State", key: "State" },
      { db: "City", key: "City" },
      { db: "Zip", key: "Zip" },
      { db: "Address", key: "Address" },
      { db: "SignupIP", key: "SignupIP" },
      { db: "LastIP", key: "LastIP" },
    ].filter((c) => cols.has(c.db.toLowerCase()));

    const selectList = [...baseCols, ...optionalCols.map((c) => c.db)];
    const selectClause = selectList.map((c) => `[${c}]`).join(", ");
    const orderCountSelect = hasOrdersTable
      ? "(SELECT COUNT(*) FROM Orders_tbl o WHERE o.UserId = CAST(u.UserID AS NVARCHAR(64))) AS OrderCount"
      : "CAST(0 AS INT) AS OrderCount";

    const result = await pool.request().query(`
      SELECT ${selectClause},
        ${orderCountSelect}
      FROM User_tbl u
      ORDER BY CreatedAt DESC
    `);
    const rows = normalizeResult(result);
    const mapped = rows.map((u) => ({
      id: u.UserID ?? u.userId ?? u.id,
      username: u.Username ?? u.username ?? "",
      email: u.Email ?? u.email ?? "",
      role: u.Role ?? u.role ?? "user",
      createdAt: u.CreatedAt ?? u.createdAt ?? null,
      lastLogin: u.LastLogin ?? u.lastLogin ?? null,
      name: u.FullName ?? u.Name ?? u.name ?? "",
      avatar: u.AvatarUrl ?? u.Avatar ?? u.avatar ?? null,
      country: u.Country ?? u.country ?? "",
      state: u.State ?? u.state ?? "",
      city: u.City ?? u.city ?? "",
      zip: u.Zip ?? u.zip ?? "",
      address: u.Address ?? u.address ?? "",
      signupIp: u.SignupIP ?? u.signupIp ?? u.SignupIp ?? null,
      lastIp: u.LastIP ?? u.lastIp ?? u.LastIp ?? null,
      orderCount: u.OrderCount ?? u.orderCount ?? 0,
      banned: deriveBanStatus(u, cols),
    }));
    res.json(mapped);
  } catch (err) {
    console.error("/api/dashboard/users error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dashboard/users/:userId - update role/address/ban
router.patch('/api/dashboard/users/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid user id" });

  const {
    role,
    country,
    state,
    city,
    zip,
    address,
    name,
    username,
    email,
    banned,
  } = req.body || {};

  try {
    const pool = await getPool();
    const cols = await loadUserColumns(pool);

    const setClauses = [];
    const warnings = [];
    let request = pool.request().input("UserId", sql.Int, userId);

    const addIfPresent = (columnName, paramName, value) => {
      if (value === undefined || value === null || value === "") return;
      if (!cols.has(columnName.toLowerCase())) return;
      setClauses.push(`[${columnName}] = @${paramName}`);
      request = request.input(paramName, sql.NVarChar, value);
    };

    addIfPresent("Role", "Role", role);
    addIfPresent("Country", "Country", country);
    addIfPresent("State", "State", state);
    addIfPresent("City", "City", city);
    addIfPresent("Zip", "Zip", zip);
    addIfPresent("Address", "Address", address);
    addIfPresent("FullName", "FullName", name);
    addIfPresent("Username", "Username", username);
    addIfPresent("Email", "Email", email);

    if (banned !== undefined) {
      const banInfo = banUpdateClause(cols, banned);
      if (!banInfo) {
        warnings.push("Ban/restrict field not available on this database");
      } else {
        if (banInfo.type === "bool") {
          setClauses.push(banInfo.clause);
          request = request.input("Banned", sql.Bit, !!banned);
        } else if (banInfo.type === "status") {
          setClauses.push(banInfo.clause);
          request = request.input("StatusVal", sql.NVarChar, banned ? "banned" : "active");
        } else if (banInfo.type === "active") {
          setClauses.push(banInfo.clause);
          request = request.input("ActiveVal", sql.Bit, banned ? 0 : 1);
        }
      }
    }

    if (!setClauses.length) {
      return res.json({ ok: true, message: "No updatable fields provided or columns missing", warnings });
    }

    await request.query(`UPDATE User_tbl SET ${setClauses.join(", ")} WHERE UserID = @UserId`);
    res.json({ ok: true, warnings });
  } catch (err) {
    console.error("/api/dashboard/users patch error:", err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Duplicate value conflicts with existing user" });
    }
    res.status(500).json({ error: err.message || "Update failed" });
  }
});

// DELETE /api/dashboard/users/:userId
router.delete('/api/dashboard/users/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid user id" });

  try {
    const pool = await getPool();
    const cols = await loadUserColumns(pool);
    const hasIsDeleted = cols.has("isdeleted");
    const hasActive = cols.has("active") || cols.has("isactive");

    if (hasIsDeleted) {
      const result = await pool
        .request()
        .input("UserId", sql.Int, userId)
        .query("UPDATE User_tbl SET IsDeleted = 1 WHERE UserID = @UserId");
      return res.json({ ok: true, rowsAffected: result?.rowsAffected?.[0] ?? 0, softDeleted: true });
    }

    if (hasActive) {
      const result = await pool
        .request()
        .input("UserId", sql.Int, userId)
        .query("UPDATE User_tbl SET Active = 0 WHERE UserID = @UserId");
      return res.json({ ok: true, rowsAffected: result?.rowsAffected?.[0] ?? 0, softDeleted: true });
    }

    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query("DELETE FROM User_tbl WHERE UserID = @UserId");

    res.json({ ok: true, rowsAffected: result?.rowsAffected?.[0] ?? 0, softDeleted: false });
  } catch (err) {
    console.error("/api/dashboard/users delete error:", err);
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Cannot delete user with related records (orders, etc.)" });
    }
    res.status(500).json({ error: err.message || "Delete failed" });
  }
});

// GET /api/dashboard/stats
router.get('/api/dashboard/stats', async (req, res) => {
  try {
    const pool = await getPool();

    // Example: aggregate counts for users, orders, products, recent revenue
    const usersRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM User_tbl`);
    const ordersRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Orders_tbl`);
    const productsRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Products_tbl`);
    const revenueRes = await pool.request().query(`SELECT ISNULL(SUM(Total),0) AS totalRevenue FROM Orders_tbl WHERE PlacedAt >= DATEADD(day, -30, GETDATE())`);

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
