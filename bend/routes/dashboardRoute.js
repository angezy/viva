const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const sql = require('mssql');
const { getPool } = require('../utils/dbConnection');
const {
  ensureCouponsTable,
  isValidCouponCode,
  mapCouponRow,
  normalizeCouponCode,
} = require('../utils/coupons');
const { detectVariableFont, validateUploadedFiles } = require('../utils/fileSecurity');
const { revokeAllUserSessions } = require('../utils/sessionSecurity');
const { requirePermission } = require('../utils/rbac');
const { recordSecurityEvent } = require('../utils/securityAudit');
const { readIntegrationConfig, saveIntegrationValues } = require('../utils/integrationConfig');
const { testConnection: testHyperSkuConnection } = require('../utils/hyperSku');

const FONT_UPLOAD_FORMATS = new Set(['woff2', 'woff', 'ttf', 'otf']);
const fontUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'fonts');
fs.mkdirSync(fontUploadsDir, { recursive: true });
const marketingUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'marketing');
fs.mkdirSync(marketingUploadsDir, { recursive: true });
const fontUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, fontUploadsDir),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `font-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase().slice(1);
    if (!FONT_UPLOAD_FORMATS.has(extension)) {
      return callback(new Error('Only WOFF2, WOFF, TTF, and OTF font files are supported'));
    }
    callback(null, true);
  },
});

// Helper to normalize mssql result/result.recordset
function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.recordset) return result.recordset;
  if (result.recordsets?.[0]) return result.recordsets[0];
  return [];
}

const requireProfileRead = requirePermission('profile.read', 'dashboardUser');
const requireNotificationsManage = requirePermission('notifications.manage', 'dashboardUser');
const requireAnalyticsRead = requirePermission('analytics.read', 'dashboardUser');
const requireOrdersRead = requirePermission('orders.read', 'dashboardUser');
const requireUsersRead = requirePermission('users.read', 'dashboardUser');
const requireStaffManage = requirePermission('staff.manage', 'dashboardUser');
const requireSettingsManage = requirePermission('settings.manage', 'dashboardUser');
const requireMarketingManage = requirePermission('marketing.manage', 'dashboardUser');
const requireCouponsManage = requirePermission('coupons.manage', 'dashboardUser');

// Integration environment configuration ---------------------------------
router.get('/api/dashboard/integrations', requirePermission('integrations.manage', 'dashboardUser'), (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(readIntegrationConfig());
});
const marketingImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, marketingUploadsDir),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `marketing-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowed.has(file.mimetype)) {
      return callback(new Error('Only JPEG, PNG, WEBP, and GIF images are supported'));
    }
    callback(null, true);
  },
});

router.put('/api/dashboard/integrations', requirePermission('integrations.manage', 'dashboardUser'), async (req, res) => {
  try {
    const result = saveIntegrationValues(req.body?.updates);
    await recordSecurityEvent({
      eventType: 'admin.integration_config_updated',
      actor: req.dashboardUser?.id || req.dashboardUser?.sub || null,
      resourceType: 'environment',
      metadata: { changedKeys: result.changedKeys.join(','), restartRequired: result.restartRequired },
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, changedKeys: result.changedKeys, restartRequired: result.restartRequired, restartRequiredKeys: result.restartRequiredKeys, ...result.config });
  } catch (error) {
    console.error('/api/dashboard/integrations PUT error:', error);
    const status = Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500 ? Number(error.statusCode) : 500;
    res.status(status).json({ error: status === 500 ? 'Unable to save integration configuration. Check that the server environment file is writable.' : error.message });
  }
});

router.get('/api/dashboard/integrations/hypersku/ping', requirePermission('integrations.manage', 'dashboardUser'), async (req, res) => {
  try {
    const result = await testHyperSkuConnection();
    await recordSecurityEvent({
      eventType: 'admin.hypersku_connection_tested',
      actor: req.dashboardUser?.id || req.dashboardUser?.sub || null,
      resourceType: 'supplier_integration',
      resourceId: 'HYPERSKU',
      metadata: { countryCount: result.countryCount },
    });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, countryCount: result.countryCount });
  } catch (error) {
    console.error('/api/dashboard/integrations/hypersku/ping error:', error?.name || 'HyperSkuError', error?.statusCode || 'unknown_status', error?.path || '');
    res.status(502).json({ error: 'HyperSKU connection failed. Check the API credential, API access permission, and token settings.' });
  }
});

// Coupon management -------------------------------------------------------
router.get('/api/dashboard/coupons', requireCouponsManage, async (_req, res) => {
  try {
    const pool = await getPool();
    if (!(await ensureCouponsTable(pool))) {
      return res.status(500).json({ error: 'Coupon storage is unavailable' });
    }
    const result = await pool.request().query('SELECT * FROM dbo.Coupons ORDER BY CreatedAt DESC, CouponId DESC');
    res.json(normalizeResult(result).map(mapCouponRow));
  } catch (error) {
    console.error('/api/dashboard/coupons GET error:', error);
    res.status(500).json({ error: 'Unable to load coupons' });
  }
});

router.post('/api/dashboard/coupons', requireCouponsManage, async (req, res) => {
  const code = normalizeCouponCode(req.body?.code);
  const discountPercent = Number(req.body?.discountPercent);
  const expiresAt = new Date(req.body?.expiresAt || 0);

  if (!isValidCouponCode(code)) {
    return res.status(400).json({ error: 'Use 3-64 letters, numbers, hyphens, or underscores for the coupon code' });
  }
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return res.status(400).json({ error: 'Discount percentage must be greater than 0 and no more than 100' });
  }
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Expiration must be a future date and time' });
  }

  try {
    const pool = await getPool();
    if (!(await ensureCouponsTable(pool))) {
      return res.status(500).json({ error: 'Coupon storage is unavailable' });
    }
    const result = await pool
      .request()
      .input('Code', sql.NVarChar(64), code)
      .input('DiscountPercent', sql.Decimal(5, 2), discountPercent)
      .input('ExpiresAt', sql.DateTime2(3), expiresAt)
      .query(`
        INSERT INTO dbo.Coupons (Code, DiscountPercent, ExpiresAt, IsActive)
        OUTPUT INSERTED.*
        VALUES (@Code, @DiscountPercent, @ExpiresAt, 1)
      `);
    res.status(201).json(mapCouponRow(normalizeResult(result)[0] || {}));
  } catch (error) {
    console.error('/api/dashboard/coupons POST error:', error);
    if (error?.number === 2601 || error?.number === 2627 || /UNIQUE\s+KEY/i.test(error?.message || '')) {
      return res.status(409).json({ error: 'That coupon code already exists' });
    }
    res.status(500).json({ error: 'Unable to create coupon' });
  }
});

router.patch('/api/dashboard/coupons/:couponId', requireCouponsManage, async (req, res) => {
  const couponId = Number(req.params.couponId);
  if (!Number.isInteger(couponId) || couponId < 1) {
    return res.status(400).json({ error: 'Invalid coupon id' });
  }
  if (typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  try {
    const pool = await getPool();
    if (!(await ensureCouponsTable(pool))) {
      return res.status(500).json({ error: 'Coupon storage is unavailable' });
    }
    const result = await pool
      .request()
      .input('CouponId', sql.Int, couponId)
      .input('IsActive', sql.Bit, req.body.isActive)
      .query(`
        UPDATE dbo.Coupons
        SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE CouponId = @CouponId
      `);
    const rows = normalizeResult(result);
    if (!rows.length) return res.status(404).json({ error: 'Coupon not found' });
    res.json(mapCouponRow(rows[0]));
  } catch (error) {
    console.error('/api/dashboard/coupons PATCH error:', error);
    res.status(500).json({ error: 'Unable to update coupon' });
  }
});

const SITE_SETTING_DEFAULTS = {
  siteName: process.env.STORE_NAME || 'Your Store',
  siteDescription: `${process.env.STORE_NAME || 'Your Store'} - Your online store.`,
  siteTagline: 'Shop with confidence',
  siteUrl: process.env.STORE_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
  siteKeywords: 'online shop, lifestyle products, performance gear',
  siteLogoUrl: '',
  siteFaviconUrl: '',
  siteOgImageUrl: '',
  fontFamily: 'system',
  customFontName: '',
  customFontUrl: '',
  customFontFormat: 'woff2',
  customFontVariable: false,
  customFontId: '',
  customFonts: [],
  primaryColor: '#FF6B35',
  primaryDarkColor: '#B94016',
  linkHoverColor: '#C94C1B',
  primaryLightColor: '#FFB38A',
  primarySoftColor: '#FFF0E8',
  accentColor: '#315C78',
  accentDarkColor: '#24465C',
  accentLightColor: '#A9C5D6',
  accentSoftColor: '#EDF4F7',
  backgroundColor: '#F7F3EC',
  surfaceColor: '#FFFEFC',
  surfaceMutedColor: '#EEEAE3',
  borderColor: '#D8D2C8',
  textPrimaryColor: '#242321',
  textSecondaryColor: '#68635D',
  successColor: '#287A65',
  warningColor: '#f28c28',
  errorColor: '#c94a4a',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
  supportPhone: '',
  supportHours: 'Support available within 24-48 hours',
  welcomePopupEnabled: false,
  welcomePopupEyebrow: 'NEW CUSTOMER WELCOME',
  welcomePopupTitle: 'Welcome to our store',
  welcomePopupDescription: 'Configure a welcome offer from the owner dashboard when you are ready.',
  welcomePopupButtonLabel: 'Start shopping',
  welcomePopupCouponCode: '',
  welcomePopupFinePrint: '',
};
const SITE_SETTING_KEYS = Object.keys(SITE_SETTING_DEFAULTS);
const BOOLEAN_SETTING_KEYS = ['welcomePopupEnabled', 'customFontVariable'];
const JSON_SETTING_KEYS = ['customFonts'];
const COLOR_SETTING_KEYS = [
  'primaryColor', 'primaryDarkColor', 'linkHoverColor', 'primaryLightColor', 'primarySoftColor',
  'accentColor', 'accentDarkColor', 'accentLightColor', 'accentSoftColor',
  'backgroundColor', 'surfaceColor', 'surfaceMutedColor', 'borderColor',
  'textPrimaryColor', 'textSecondaryColor', 'successColor', 'warningColor', 'errorColor',
];
const SITE_FONT_FAMILY_VALUES = new Set([
  'system', 'arial', 'verdana', 'trebuchet', 'georgia', 'times', 'courier', 'custom',
]);

function isHexColor(value) {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(String(value || '').trim());
}

function isSiteFontFamily(value) {
  return SITE_FONT_FAMILY_VALUES.has(String(value || '').trim());
}

function isCustomFontName(value) {
  return /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(String(value || '').trim());
}

function isCustomFontUrl(value) {
  return /^(?:https?:\/\/|\/uploads\/fonts\/)[^\s"'<>]+$/i.test(String(value || '').trim());
}

function isCustomFontFormat(value) {
  return FONT_UPLOAD_FORMATS.has(String(value || '').trim().toLowerCase());
}

function isCustomFontId(value) {
  return /^[A-Za-z0-9_-]{1,100}$/.test(String(value || '').trim());
}

function normalizeCustomFonts(value) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch (_error) { source = []; }
  }
  if (!Array.isArray(source)) return [];
  return source
    .map((font) => {
      const id = String(font?.id || '').trim();
      const name = String(font?.name || '').trim();
      const url = String(font?.url || '').trim();
      const format = isCustomFontFormat(font?.format) ? String(font.format).toLowerCase() : '';
      if (!isCustomFontId(id) || !isCustomFontName(name) || !isCustomFontUrl(url) || !format) return null;
      return {
        id,
        name,
        url,
        format,
        variable: font?.variable === true || String(font?.variable).toLowerCase() === 'true',
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

function readSiteSettings(rows = []) {
  const settings = { ...SITE_SETTING_DEFAULTS };
  rows.forEach((row) => {
    const key = String(row.SettingKey ?? row.key ?? '');
    if (SITE_SETTING_KEYS.includes(key) && row.SettingValue != null) {
      const value = String(row.SettingValue).trim();
      if (BOOLEAN_SETTING_KEYS.includes(key)) {
        settings[key] = value.toLowerCase() === 'true';
      } else if (key === 'customFonts') {
        settings[key] = normalizeCustomFonts(value);
      } else if (key === 'customFontId') {
        if (isCustomFontId(value)) settings[key] = value;
      } else if (key === 'fontFamily') {
        if (isSiteFontFamily(value)) settings[key] = value;
      } else if (key === 'customFontName') {
        if (isCustomFontName(value)) settings[key] = value;
      } else if (key === 'customFontUrl') {
        if (isCustomFontUrl(value)) settings[key] = value;
      } else if (key === 'customFontFormat') {
        if (isCustomFontFormat(value)) settings[key] = value.toLowerCase();
      } else if (!COLOR_SETTING_KEYS.includes(key) || isHexColor(value)) settings[key] = value;
    }
  });
  if (settings.fontFamily === 'custom' && settings.customFonts.length) {
    const activeCustomFont = settings.customFonts.find((font) => font.id === settings.customFontId) || settings.customFonts[0];
    settings.customFontId = activeCustomFont.id;
    settings.customFontName = activeCustomFont.name;
    settings.customFontUrl = activeCustomFont.url;
    settings.customFontFormat = activeCustomFont.format;
    settings.customFontVariable = activeCustomFont.variable;
  }
  return settings;
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
router.get('/api/dashboard/profile', requireProfileRead, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('UserId', sql.Int, Number(req.dashboardUser.id))
      .query(`SELECT TOP 1 UserID, Username, Email, FullName, AvatarUrl, Bio FROM User_tbl WHERE UserID = @UserId`);
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
    res.status(500).json({ error: 'Unable to load profile' });
  }
});

// GET /api/dashboard/orders
router.get('/api/dashboard/orders', requireOrdersRead, async (req, res) => {
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
    res.status(500).json({ error: 'Unable to load orders' });
  }
});

// GET /api/dashboard/notifications
router.get('/api/dashboard/notifications', requireNotificationsManage, async (req, res) => {
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
    res.status(500).json({ error: 'Unable to load notifications' });
  }
});

// POST /api/dashboard/notifications
// Used by dashboard actions or backend jobs to show an administrator message.
router.post('/api/dashboard/notifications', requireNotificationsManage, async (req, res) => {
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
    res.status(500).json({ error: 'Unable to create notification' });
  }
});

// PATCH /api/dashboard/notifications/:notificationId
// Allows the dashboard to mark a notification as read or hide it.
router.patch('/api/dashboard/notifications/:notificationId', requireNotificationsManage, async (req, res) => {
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
    res.status(500).json({ error: 'Unable to update notification' });
  }
});

// Upload a custom site font for use by the typography settings.
router.post('/api/dashboard/settings/font-upload', requireSettingsManage, (req, res) => {
  fontUpload.single('font')(req, res, async (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Unable to upload font' });
    if (!req.file) return res.status(400).json({ error: 'Choose a WOFF2, WOFF, TTF, or OTF font file' });
    if (!(await validateUploadedFiles(req.file, 'font'))) {
      return res.status(400).json({ error: 'Font content does not match its file extension' });
    }

    const format = path.extname(req.file.originalname).toLowerCase().slice(1);
    res.json({
      url: `/uploads/fonts/${req.file.filename}`,
      format,
      name: req.file.originalname,
      id: path.basename(req.file.filename, path.extname(req.file.filename)),
      variable: await detectVariableFont(req.file),
    });
  });
});

// Upload images used by the marketing email body editor.
router.post('/api/dashboard/marketing/upload', requireMarketingManage, (req, res) => {
  marketingImageUpload.single('image')(req, res, async (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Unable to upload image' });
    if (!req.file) return res.status(400).json({ error: 'Choose a JPEG, PNG, WEBP, or GIF image' });
    if (!(await validateUploadedFiles(req.file, 'image'))) {
      return res.status(400).json({ error: 'Uploaded image content does not match its declared type' });
    }

    res.json({ location: `/uploads/marketing/${req.file.filename}` });
  });
});

// GET /api/dashboard/settings
router.get('/api/dashboard/settings', requireSettingsManage, async (req, res) => {
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

    res.json({ emailNotifications: true, darkMode: false, ...settings, site: readSiteSettings(rows) });
  } catch (err) {
    console.error('/api/dashboard/settings error:', err);
    res.status(500).json({ error: 'Unable to load dashboard settings' });
  }
});

// Public storefront identity and SEO defaults. The dashboard writes these values
// into the same settings table, while this endpoint exposes only site settings.
router.get('/api/site-settings', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT SettingKey, SettingValue FROM DashboardSettings`);
    res.json(readSiteSettings(normalizeResult(result)));
  } catch (err) {
    console.error('/api/site-settings error:', err);
    res.json({ ...SITE_SETTING_DEFAULTS });
  }
});

// PUT /api/dashboard/settings
router.put('/api/dashboard/settings', requireSettingsManage, async (req, res) => {
  const body = req.body || {};
  const supportedKeys = ['emailNotifications', 'darkMode'];
  const siteBody = body.site && typeof body.site === 'object' ? body.site : {};
  const booleanEntries = supportedKeys.filter((key) => typeof body[key] === 'boolean');
  const siteEntries = SITE_SETTING_KEYS.filter((key) => typeof siteBody[key] === 'string' || (BOOLEAN_SETTING_KEYS.includes(key) && typeof siteBody[key] === 'boolean') || (JSON_SETTING_KEYS.includes(key) && Array.isArray(siteBody[key])));
  const invalidColor = COLOR_SETTING_KEYS.find((key) => typeof siteBody[key] === 'string' && !isHexColor(siteBody[key]));
  if (invalidColor) {
    return res.status(400).json({ error: `${invalidColor} must be a 3- or 6-digit hex color such as #FF6B35` });
  }
  if (typeof siteBody.fontFamily === 'string' && !isSiteFontFamily(siteBody.fontFamily)) {
    return res.status(400).json({ error: 'fontFamily is not a supported site font' });
  }
  if (typeof siteBody.customFontName === 'string' && siteBody.customFontName.trim() && !isCustomFontName(siteBody.customFontName)) {
    return res.status(400).json({ error: 'customFontName contains unsupported characters' });
  }
  if (typeof siteBody.customFontUrl === 'string' && siteBody.customFontUrl.trim() && !isCustomFontUrl(siteBody.customFontUrl)) {
    return res.status(400).json({ error: 'customFontUrl must be an HTTPS URL or an uploaded /uploads/fonts/ path' });
  }
  if (typeof siteBody.customFontFormat === 'string' && !isCustomFontFormat(siteBody.customFontFormat)) {
    return res.status(400).json({ error: 'customFontFormat must be woff2, woff, ttf, or otf' });
  }
  if (typeof siteBody.customFontId === 'string' && siteBody.customFontId.trim() && !isCustomFontId(siteBody.customFontId)) {
    return res.status(400).json({ error: 'customFontId contains unsupported characters' });
  }
  if (Array.isArray(siteBody.customFonts)) {
    const normalizedFonts = normalizeCustomFonts(siteBody.customFonts);
    if (normalizedFonts.length !== siteBody.customFonts.length) {
      return res.status(400).json({ error: 'customFonts contains an invalid font entry' });
    }
    if (siteBody.customFontId && !normalizedFonts.some((font) => font.id === siteBody.customFontId)) {
      return res.status(400).json({ error: 'customFontId must refer to an imported font' });
    }
  }
  if (siteBody.fontFamily === 'custom' && (!isCustomFontName(siteBody.customFontName) || !isCustomFontUrl(siteBody.customFontUrl))) {
    return res.status(400).json({ error: 'Custom font requires a valid name and font file URL' });
  }
  const entries = [...booleanEntries, ...siteEntries];
  if (!entries.length) {
    return res.status(400).json({ error: 'Provide a supported setting to save' });
  }

  try {
    const pool = await getPool();
    for (const key of entries) {
      const value = booleanEntries.includes(key) || BOOLEAN_SETTING_KEYS.includes(key)
        ? (booleanEntries.includes(key) ? body[key] : siteBody[key]) ? 'true' : 'false'
        : JSON_SETTING_KEYS.includes(key)
          ? JSON.stringify(normalizeCustomFonts(siteBody[key]))
          : siteBody[key].trim();
      await pool
        .request()
        .input('SettingKey', sql.NVarChar(100), key)
        .input('SettingValue', sql.NVarChar(sql.MAX), value)
        .query(`
          IF EXISTS (SELECT 1 FROM DashboardSettings WHERE SettingKey = @SettingKey)
            UPDATE DashboardSettings SET SettingValue = @SettingValue WHERE SettingKey = @SettingKey;
          ELSE
            INSERT INTO DashboardSettings (SettingKey, SettingValue) VALUES (@SettingKey, @SettingValue);
        `);
    }
    const refreshed = await pool.request().query(`SELECT SettingKey, SettingValue FROM DashboardSettings`);
    res.json({
      emailNotifications: typeof body.emailNotifications === 'boolean' ? body.emailNotifications : undefined,
      darkMode: typeof body.darkMode === 'boolean' ? body.darkMode : undefined,
      site: readSiteSettings(normalizeResult(refreshed)),
    });
  } catch (err) {
    console.error('/api/dashboard/settings PUT error:', err);
    res.status(500).json({ error: 'Unable to save dashboard settings' });
  }
});

// GET /api/dashboard/users
router.get('/api/dashboard/users', requireUsersRead, async (req, res) => {
  try {
    const pool = await getPool();
    const cols = await loadUserColumns(pool);
    const ownerView = String(req.dashboardUser?.role || '').toLowerCase() === 'owner';
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
      ${ownerView ? '' : "WHERE LOWER(ISNULL(u.Role, N'customer')) NOT IN (N'admin', N'owner')"}
      ORDER BY CreatedAt DESC
    `);
    const rows = normalizeResult(result);
    const mapped = rows.map((u) => ({
      id: u.UserID ?? u.userId ?? u.id,
      username: u.Username ?? u.username ?? "",
      email: u.Email ?? u.email ?? "",
      role: String(u.Role ?? u.role ?? "customer").toLowerCase() === "user" ? "customer" : String(u.Role ?? u.role ?? "customer").toLowerCase(),
      createdAt: u.CreatedAt ?? u.createdAt ?? null,
      lastLogin: u.LastLogin ?? u.lastLogin ?? null,
      name: u.FullName ?? u.Name ?? u.name ?? "",
      avatar: u.AvatarUrl ?? u.Avatar ?? u.avatar ?? null,
      country: u.Country ?? u.country ?? "",
      state: u.State ?? u.state ?? "",
      city: u.City ?? u.city ?? "",
      zip: u.Zip ?? u.zip ?? "",
      address: u.Address ?? u.address ?? "",
      signupIp: ownerView ? (u.SignupIP ?? u.signupIp ?? u.SignupIp ?? null) : null,
      lastIp: ownerView ? (u.LastIP ?? u.lastIp ?? u.LastIp ?? null) : null,
      orderCount: u.OrderCount ?? u.orderCount ?? 0,
      banned: deriveBanStatus(u, cols),
    }));
    res.json(mapped);
  } catch (err) {
    console.error("/api/dashboard/users error:", err);
    res.status(500).json({ error: 'Unable to load users' });
  }
});

// PATCH /api/dashboard/users/:userId - update role/address/ban
router.patch('/api/dashboard/users/:userId', requireStaffManage, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: "Invalid user id" });

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

  const allowedRoles = new Set(['owner', 'admin', 'user', 'customer']);
  const requestedRole = role == null ? null : String(role).trim().toLowerCase();
  if (requestedRole && !allowedRoles.has(requestedRole)) {
    return res.status(400).json({ error: 'Role is not supported' });
  }
  const normalizedRole = requestedRole === 'user' ? 'customer' : requestedRole;
  if (userId === Number(req.dashboardUser?.sub) && normalizedRole && normalizedRole !== 'owner') {
    return res.status(409).json({ error: 'You cannot demote your own active owner session' });
  }

  try {
    const pool = await getPool();
    const cols = await loadUserColumns(pool);

    if (normalizedRole) {
      const targetResult = await pool.request()
        .input('TargetUserId', sql.Int, userId)
        .query(`SELECT TOP 1 Role FROM User_tbl WHERE UserID = @TargetUserId`);
      const targetRole = String(normalizeResult(targetResult)[0]?.Role || 'customer').toLowerCase();
      if (!normalizeResult(targetResult).length) return res.status(404).json({ error: 'User not found' });
      if (targetRole === 'owner' && normalizedRole !== 'owner') {
        const countResult = await pool.request().query(`SELECT COUNT(*) AS OwnerCount FROM User_tbl WHERE LOWER(ISNULL(Role, N'customer')) = N'owner'`);
        if (Number(normalizeResult(countResult)[0]?.OwnerCount || 0) <= 1) {
          return res.status(409).json({ error: 'The last owner cannot be demoted' });
        }
      }
    }

    const setClauses = [];
    const warnings = [];
    let request = pool.request().input("UserId", sql.Int, userId);

    const addIfPresent = (columnName, paramName, value) => {
      if (value === undefined || value === null || value === "") return;
      if (!cols.has(columnName.toLowerCase())) return;
      setClauses.push(`[${columnName}] = @${paramName}`);
      request = request.input(paramName, sql.NVarChar, value);
    };

    addIfPresent("Role", "Role", normalizedRole);
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
    if (normalizedRole || banned !== undefined || email) {
      await revokeAllUserSessions(pool, userId, normalizedRole ? 'role_changed' : banned ? 'account_restricted' : 'identity_changed');
    }
    await recordSecurityEvent({ pool, eventType: 'admin.user_updated', severity: 'warning', actor: req.dashboardUser?.sub, resourceType: 'user', resourceId: userId, metadata: { roleChanged: Boolean(normalizedRole), restrictionChanged: banned !== undefined } });
    res.json({ ok: true, warnings });
  } catch (err) {
    console.error("/api/dashboard/users patch error:", err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Duplicate value conflicts with existing user" });
    }
    res.status(500).json({ error: "Unable to update user" });
  }
});

// DELETE /api/dashboard/users/:userId
router.delete('/api/dashboard/users/:userId', requireStaffManage, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: "Invalid user id" });
  if (userId === Number(req.dashboardUser?.sub)) {
    return res.status(409).json({ error: 'Administrators cannot delete their own active account' });
  }

  try {
    const pool = await getPool();
    const targetResult = await pool.request()
      .input('TargetUserId', sql.Int, userId)
      .query(`SELECT TOP 1 Role FROM User_tbl WHERE UserID = @TargetUserId`);
    const target = normalizeResult(targetResult)[0];
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (String(target.Role || 'customer').toLowerCase() === 'owner') {
      const countResult = await pool.request().query(`SELECT COUNT(*) AS OwnerCount FROM User_tbl WHERE LOWER(ISNULL(Role, N'customer')) = N'owner'`);
      if (Number(normalizeResult(countResult)[0]?.OwnerCount || 0) <= 1) {
        return res.status(409).json({ error: 'The last owner cannot be deleted' });
      }
    }
    const cols = await loadUserColumns(pool);
    const hasIsDeleted = cols.has("isdeleted");
    const hasActive = cols.has("active") || cols.has("isactive");

    if (hasIsDeleted) {
      const result = await pool
        .request()
        .input("UserId", sql.Int, userId)
        .query("UPDATE User_tbl SET IsDeleted = 1 WHERE UserID = @UserId");
      await revokeAllUserSessions(pool, userId, 'account_deleted');
      await recordSecurityEvent({ pool, eventType: 'admin.user_deleted', severity: 'high', actor: req.dashboardUser?.sub, resourceType: 'user', resourceId: userId, metadata: { softDeleted: true } });
      return res.json({ ok: true, rowsAffected: result?.rowsAffected?.[0] ?? 0, softDeleted: true });
    }

    if (hasActive) {
      const result = await pool
        .request()
        .input("UserId", sql.Int, userId)
        .query("UPDATE User_tbl SET Active = 0 WHERE UserID = @UserId");
      await revokeAllUserSessions(pool, userId, 'account_disabled');
      await recordSecurityEvent({ pool, eventType: 'admin.user_disabled', severity: 'high', actor: req.dashboardUser?.sub, resourceType: 'user', resourceId: userId, metadata: { softDeleted: true } });
      return res.json({ ok: true, rowsAffected: result?.rowsAffected?.[0] ?? 0, softDeleted: true });
    }

    const result = await pool
      .request()
      .input("UserId", sql.Int, userId)
      .query("DELETE FROM User_tbl WHERE UserID = @UserId");

    await revokeAllUserSessions(pool, userId, 'account_deleted');
    await recordSecurityEvent({ pool, eventType: 'admin.user_deleted', severity: 'high', actor: req.dashboardUser?.sub, resourceType: 'user', resourceId: userId, metadata: { softDeleted: false } });
    res.json({ ok: true, rowsAffected: result?.rowsAffected?.[0] ?? 0, softDeleted: false });
  } catch (err) {
    console.error("/api/dashboard/users delete error:", err);
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Cannot delete user with related records (orders, etc.)" });
    }
    res.status(500).json({ error: "Unable to delete user" });
  }
});

// GET /api/dashboard/stats
router.get('/api/dashboard/stats', requireAnalyticsRead, async (req, res) => {
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
    res.status(500).json({ error: 'Unable to load dashboard stats' });
  }
});

module.exports = router;
