const { requireSession } = require("./sessionSecurity");
const { isStaffRole, normalizeRole, ROLES } = require("./roles");

const PERMISSIONS = Object.freeze([
  "dashboard.view",
  "profile.read",
  "notifications.manage",
  "analytics.read",
  "orders.read",
  "orders.update",
  "tickets.read",
  "tickets.reply",
  "tickets.update",
  "users.read",
  "products.read",
  "products.manage",
  "inventory.manage",
  "coupons.manage",
  "marketing.read",
  "marketing.manage",
  "settings.manage",
  "staff.manage",
  "roles.manage",
  "finance.read",
  "payments.manage",
  "refunds.manage",
  "shipping.manage",
  "integrations.manage",
  "suppliers.read",
  "loyalty.read",
  "reviews.manage",
  "content.manage",
  "audit.read",
]);

const OWNER_PERMISSIONS = new Set(PERMISSIONS);
const ROLE_PERMISSIONS = Object.freeze({
  owner: OWNER_PERMISSIONS,
  admin: new Set([
    "dashboard.view",
    "orders.read",
    "orders.update",
    "tickets.read",
    "tickets.reply",
    "tickets.update",
    "users.read",
  ]),
  customer: new Set(),
});

function hasPermission(role, permission) {
  const normalizedPermission = String(permission || "").trim().toLowerCase();
  if (!normalizedPermission) return false;
  const normalizedRole = normalizeRole(role);
  // Owner is intentionally future-proof: a newly introduced administrative
  // permission is available to the owner until it is explicitly restricted.
  if (normalizedRole === ROLES.OWNER) return true;
  return ROLE_PERMISSIONS[normalizedRole]?.has(normalizedPermission) || false;
}

function permissionsForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.OWNER) return [...PERMISSIONS];
  return [...(ROLE_PERMISSIONS[normalizedRole] || [])];
}

function forbidden(res, permission) {
  return res.status(403).json({
    error: "You do not have permission to perform this action",
    code: "FORBIDDEN",
    requiredPermission: permission,
  });
}

function requirePermission(permission, property = "dashboardUser") {
  const sessionMiddleware = requireSession("admin", property);
  return async (req, res, next) => {
    const afterSession = () => {
      const user = req[property];
      if (!user || !isStaffRole(user.role) || !hasPermission(user.role, permission)) {
        return forbidden(res, permission);
      }
      // Some legacy handlers read req.user while others read req.dashboardUser.
      if (!req.user) req.user = user;
      req.permissions = permissionsForRole(user.role);
      return next();
    };
    return sessionMiddleware(req, res, afterSession);
  };
}

function requireAnyPermission(permissions, property = "dashboardUser") {
  const allowed = [...new Set((Array.isArray(permissions) ? permissions : [permissions]).map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
  const sessionMiddleware = requireSession("admin", property);
  return async (req, res, next) => {
    return sessionMiddleware(req, res, () => {
      const user = req[property];
      const permission = allowed.find((candidate) => hasPermission(user?.role, candidate));
      if (!permission) return forbidden(res, allowed.join(" or "));
      if (!req.user) req.user = user;
      req.permissions = permissionsForRole(user.role);
      return next();
    });
  };
}

function recordPermissionForArea(area) {
  switch (String(area || "").trim().toLowerCase()) {
    case "orders": return "orders.read";
    case "finance": return "finance.read";
    case "suppliers": return "suppliers.read";
    case "marketing": return "marketing.read";
    case "loyalty": return "loyalty.read";
    default: return "dashboard.view";
  }
}

function requireRecordPermission(property = "adminUser") {
  const sessionMiddleware = requireSession("admin", property);
  return async (req, res, next) => sessionMiddleware(req, res, () => {
    const permission = recordPermissionForArea(req.params?.area);
    const user = req[property];
    if (!hasPermission(user?.role, permission)) return forbidden(res, permission);
    if (!req.user) req.user = user;
    req.permissions = permissionsForRole(user.role);
    return next();
  });
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  forbidden,
  hasPermission,
  isStaffRole,
  normalizeRole,
  permissionsForRole,
  recordPermissionForArea,
  requireAnyPermission,
  requirePermission,
  requireRecordPermission,
};
