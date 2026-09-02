const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  scanFileForMalware,
  scanUploadedFiles,
  validateUploadedFiles,
} = require("../utils/fileSecurity");
const { parseBoundedInteger, requestOriginIsAllowed } = require("../utils/securityControls");
const { safeMetadata } = require("../utils/securityAudit");
const { sessionRecordAccepts, tokenHash } = require("../utils/sessionSecurity");
const { isGuestCartOwnerKey, mergeGuestCartState } = require("../utils/durableCartStore");
const {
  stripeEventDisposition,
  stripeEventIsPaid,
  verifyStripeSignature,
} = require("../routes/stripeWebhookRoute");

test("revoked, expired, copied, and mismatched sessions are rejected", () => {
  const token = "signed-token";
  const decoded = { jti: crypto.randomUUID(), sub: 42, role: "user" };
  const row = {
    jti: decoded.jti,
    user_id: 42,
    session_role: "user",
    token_hash: tokenHash(token),
    expires_at: new Date(Date.now() + 60_000),
    revoked_at: null,
  };
  assert.equal(sessionRecordAccepts(decoded, token, row), true);
  assert.equal(sessionRecordAccepts(decoded, "copied-or-modified", row), false);
  assert.equal(sessionRecordAccepts({ ...decoded, sub: 43 }, token, row), false);
  assert.equal(sessionRecordAccepts({ ...decoded, role: "admin" }, token, row), false);
  assert.equal(sessionRecordAccepts(decoded, token, { ...row, revoked_at: new Date() }), false);
  assert.equal(sessionRecordAccepts(decoded, token, { ...row, expires_at: new Date(Date.now() - 1) }), false);
});

test("Stripe signatures enforce integrity and replay tolerance", () => {
  const payload = Buffer.from('{"id":"evt_test"}');
  const secret = "whsec_test";
  const now = Date.now();
  const timestamp = Math.floor(now / 1000);
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(payload).digest("hex");
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, 300, now), true);
  assert.equal(verifyStripeSignature(Buffer.from("tampered"), `t=${timestamp},v1=${signature}`, secret, 300, now), false);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp - 301},v1=${signature}`, secret, 300, now), false);
});

test("Stripe event policy separates paid, release, failure, refund, and ignored events", () => {
  assert.equal(stripeEventDisposition({ type: "checkout.session.completed" }), "paid");
  assert.equal(stripeEventDisposition({ type: "checkout.session.expired" }), "release");
  assert.equal(stripeEventDisposition({ type: "payment_intent.payment_failed" }), "payment_failed");
  assert.equal(stripeEventDisposition({ type: "charge.refunded" }), "refunded");
  assert.equal(stripeEventDisposition({ type: "customer.created" }), "ignore");
  assert.equal(stripeEventIsPaid({ type: "checkout.session.completed", data: { object: { payment_status: "unpaid" } } }), false);
  assert.equal(stripeEventIsPaid({ type: "payment_intent.succeeded", data: { object: { status: "succeeded" } } }), true);
});

test("security telemetry metadata strips likely secrets", () => {
  const clean = safeMetadata({ action: "disable", token: "secret", PasswordHash: "secret", count: 3, nested: { secret: true } });
  assert.deepEqual(clean, { action: "disable", count: 3 });
});

test("bounded integers reject SQL-shaped and out-of-range input", () => {
  assert.equal(parseBoundedInteger("12", { min: 1, max: 20 }), 12);
  for (const value of ["1 OR 1=1", "0;DROP TABLE x", "1.5", -1, 21, "NaN"]) {
    assert.equal(parseBoundedInteger(value, { min: 1, max: 20 }), null);
  }
});

test("guest carts merge into the customer cart exactly once with bounded quantities", () => {
  const guestId = `guest-${crypto.randomUUID()}`;
  assert.equal(isGuestCartOwnerKey(guestId), true);
  assert.equal(isGuestCartOwnerKey("42"), false);

  const merged = mergeGuestCartState({
    cart: [{ productId: "7", quantity: 98, title: "Account item" }],
    coupon: { code: "ACCOUNT", expiresAt: "2099-01-01T00:00:00.000Z" },
    savedGuest: [],
  }, {
    cart: [
      { productId: "7", quantity: 3, title: "Guest item" },
      { productId: "8", quantity: 2, title: "Second guest item" },
      { productId: "ignored", quantity: 0 },
    ],
    coupon: { code: "GUEST", expiresAt: "2099-01-01T00:00:00.000Z" },
    savedGuest: [],
  }, 99);

  assert.deepEqual(merged.cart.map(({ productId, quantity }) => ({ productId, quantity })), [
    { productId: "7", quantity: 99 },
    { productId: "8", quantity: 2 },
  ]);
  assert.equal(merged.coupon.code, "ACCOUNT");
});

test("origin checks accept exact origins and reject hostile suffixes", () => {
  const base = { headers: { origin: "https://shop.example.com", host: "api.example.com" }, secure: true };
  assert.equal(requestOriginIsAllowed(base, ["https://shop.example.com"]), true);
  assert.equal(requestOriginIsAllowed({ ...base, headers: { ...base.headers, origin: "https://shop.example.com.evil.test" } }, ["https://shop.example.com"]), false);
});

test("production-safe seed does not contain a default administrator credential", () => {
  const root = path.resolve(__dirname, "..", "..");
  const seed = fs.readFileSync(path.join(root, "scripts", "seed_default_data.sql"), "utf8");
  assert.doesNotMatch(seed, /admin@weluxo|ChangeMe123|\$2[aby]\$/i);
  assert.doesNotMatch(seed, /INSERT\s+INTO\s+[^\n]*(User_tbl|Orders_tbl|Products_tbl|Coupons)/i);
});

test("EICAR is rejected before an external scanner is invoked", async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "weluxo-eicar-"));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "eicar.txt");
  await fs.promises.writeFile(filePath, "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
  let invoked = false;
  const result = await scanFileForMalware(filePath, { mode: "clamav", executor: async () => { invoked = true; } });
  assert.equal(result.clean, false);
  assert.equal(result.scanner, "builtin-eicar");
  assert.equal(invoked, false);
});

test("scanner outage fails closed and clean uploads receive a digest", async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "weluxo-scan-"));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const cleanPath = path.join(directory, "clean.txt");
  await fs.promises.writeFile(cleanPath, "ordinary support note");
  const file = { path: cleanPath, mimetype: "text/plain", originalname: "note.txt", filename: "stored.txt", size: 21 };
  assert.equal(await validateUploadedFiles([file], "support"), true);
  const clean = await scanUploadedFiles([file], { mode: "clamav", executor: async () => ({ stdout: "" }) });
  assert.equal(clean.clean, true);
  assert.match(clean.results[0].sha256, /^[a-f0-9]{64}$/);

  const secondPath = path.join(directory, "second.txt");
  await fs.promises.writeFile(secondPath, "ordinary support note");
  const unavailable = await scanFileForMalware(secondPath, { mode: "clamav", executor: async () => { const error = new Error("offline"); error.code = "ENOENT"; throw error; } });
  assert.equal(unavailable.clean, false);
  assert.equal(unavailable.unavailable, true);
});
