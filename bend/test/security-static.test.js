const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("HTTP request code contains no active DDL", () => {
  const files = [
    "bend/routes/homeroute.js",
    "bend/routes/supportRoute.js",
    "bend/routes/chatRoute.js",
    "bend/routes/dashboardRoute.js",
    "bend/utils/coupons.js",
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|SCHEMA)\b/i, file);
  }
});

test("commerce authority is durable and legacy checkout is disabled", () => {
  const home = read("bend/routes/homeroute.js");
  assert.doesNotMatch(home, /session(?:Carts|Payments|Orders|CartCoupons|SavedCartItems)/);
  assert.match(home, /loadDurableCheckout/);
  assert.match(home, /payment_status\]\s*=\s*N'Paid'/);
  assert.match(home, /Legacy checkout is disabled/);
});

test("ownership predicates bind customer identity on IDOR-sensitive resources", () => {
  const home = read("bend/routes/homeroute.js");
  const support = read("bend/routes/supportRoute.js");
  for (const pattern of [
    /CustomerAccountAddresses[\s\S]{0,500}UserID\s*=\s*@UserId/,
    /StorefrontOrders[\s\S]{0,300}UserId\s*=\s*@UserId/,
    /SavedProducts_tbl[\s\S]{0,300}UserId\s*=\s*@UserId/,
    /SecureCheckoutSessions[\s\S]{0,500}user_key\]\s*=\s*@UserKey/,
  ]) assert.match(home, pattern);
  assert.match(support, /tickets[\s\S]{0,300}(?:user_id\s*=\s*@UserId|customer_email\s*=\s*@Email)/);
  assert.match(support, /UploadObjects[\s\S]{0,500}ticket_id\]\s*=\s*@TicketId/);
});

test("CSP protects executable script without unsafe-inline", () => {
  const proxy = read("fend/src/proxy.js");
  const scriptDirective = proxy.match(/`script-src[^`]+`/)?.[0] || "";
  assert.match(scriptDirective, /nonce-/);
  assert.match(scriptDirective, /strict-dynamic/);
  assert.doesNotMatch(scriptDirective, /unsafe-inline/);
  assert.match(proxy, /Content-Security-Policy-Report-Only/);
});

test("application role explicitly denies DDL", () => {
  const role = read("database/production_app_role.sql");
  for (const permission of ["ALTER", "CONTROL", "CREATE TABLE", "VIEW DEFINITION"]) {
    assert.match(role, new RegExp(`DENY\\s+${permission.replace(" ", "\\s+")}`, "i"));
  }
});

test("legacy public uploads are database-whitelisted instead of anonymously static", () => {
  const server = read("bend/server.js");
  assert.match(server, /function referencedPublicUpload/);
  assert.match(server, /app\.use\("\/uploads", referencedPublicUpload/);
  assert.match(server, /StorefrontProductImages/);
});
