const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  PERMISSIONS,
  hasPermission,
  permissionsForRole,
  recordPermissionForArea,
} = require("../utils/rbac");
const { splitSqlBatches } = require("../../scripts/lib/database");

test("RBAC matrix gives owner complete access, limits admin, and excludes customers", () => {
  PERMISSIONS.forEach((permission) => assert.equal(hasPermission("owner", permission), true, `owner should have ${permission}`));
  assert.equal(hasPermission("owner", "settings.manage"), true);
  assert.equal(hasPermission("owner", "permission.added.in.future"), true);
  assert.equal(hasPermission("admin", "orders.read"), true);
  assert.equal(hasPermission("admin", "tickets.reply"), true);
  assert.equal(hasPermission("admin", "settings.manage"), false);
  assert.equal(hasPermission("admin", "products.manage"), false);
  assert.equal(hasPermission("admin", "integrations.manage"), false);
  assert.equal(hasPermission("admin", "finance.read"), false);
  assert.equal(hasPermission("admin", "refunds.manage"), false);
  assert.equal(hasPermission("admin", "staff.manage"), false);
  assert.equal(hasPermission("admin", "roles.manage"), false);
  assert.equal(hasPermission("admin", "analytics.read"), false);
  assert.equal(hasPermission("customer", "dashboard.view"), false);
  assert.equal(hasPermission("customer", "orders.read"), false);
  assert.equal(hasPermission("user", "dashboard.view"), false);
  assert.deepEqual(permissionsForRole("admin"), ["dashboard.view", "orders.read", "orders.update", "tickets.read", "tickets.reply", "tickets.update", "users.read"]);
  assert.equal(permissionsForRole("owner").length, PERMISSIONS.length);
});

test("admin record areas map to explicit permissions", () => {
  assert.equal(recordPermissionForArea("orders"), "orders.read");
  assert.equal(recordPermissionForArea("finance"), "finance.read");
  assert.equal(recordPermissionForArea("suppliers"), "suppliers.read");
  assert.equal(recordPermissionForArea("marketing"), "marketing.read");
});

test("bootstrap artifacts are ordered and contain no production data seed", () => {
  const root = path.resolve(__dirname, "..", "..");
  const bootstrap = fs.readFileSync(path.join(root, "scripts", "bootstrap_store.js"), "utf8");
  const systemSeed = fs.readFileSync(path.join(root, "database", "seeds", "seed-system.sql"), "utf8");
  const migrations = fs.readdirSync(path.join(root, "database", "migrations"));
  assert.match(bootstrap, /database.*migrations/);
  assert.ok(migrations.some((name) => /^020_rbac_roles_permissions\.sql$/i.test(name)));
  assert.doesNotMatch(systemSeed, /INSERT\s+INTO\s+.*(?:User_tbl|Orders|Customers|Coupons)/i);
  assert.doesNotMatch(systemSeed, /admin123|password|ChangeMe123/i);
  assert.equal(splitSqlBatches("SELECT 1\nGO\nSELECT 2").length, 2);
});

test("owner migration is explicit and protected against last-owner loss", () => {
  const root = path.resolve(__dirname, "..", "..");
  const migration = fs.readFileSync(path.join(root, "scripts", "promote_owner.js"), "utf8");
  const route = fs.readFileSync(path.join(root, "bend", "routes", "dashboardRoute.js"), "utf8");
  assert.match(migration, /--email/);
  assert.match(migration, /ALLOW_OWNER_MIGRATION/);
  assert.match(route, /The last owner cannot be demoted/);
  assert.match(route, /The last owner cannot be deleted/);
  assert.match(route, /requirePermission\('staff\.manage'/);
});
