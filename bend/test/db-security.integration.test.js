const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const enabled = process.env.ALLOW_SECURITY_DB_TESTS === "true" && process.env.SECURITY_TEST_DB === "true";
const safeDatabase = /(?:test|staging|security|clone)/i.test(String(process.env.DB_DATABASE || ""));
const skip = enabled && safeDatabase ? false : "Set SECURITY_TEST_DB=true and ALLOW_SECURITY_DB_TESTS=true against an explicitly named test/staging/clone database";

async function context() {
  const sql = require("mssql");
  const { getPool } = require("../utils/dbConnection");
  return { sql, pool: await getPool() };
}

test("security schema through migration 015 is present", { skip }, async () => {
  const { pool } = await context();
  const result = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID(N'Security.AuthSessions', N'U') IS NOT NULL
                     AND OBJECT_ID(N'Commerce.DurableCartStates', N'U') IS NOT NULL
                     AND OBJECT_ID(N'Security.UploadObjects', N'U') IS NOT NULL
                     AND OBJECT_ID(N'Commerce.InventoryAdjustments', N'U') IS NOT NULL
                     AND OBJECT_ID(N'Integration.SecurityEvents', N'U') IS NOT NULL
                     AND OBJECT_ID(N'Commerce.LegacyProductInventoryMappings', N'U') IS NOT NULL
                THEN 1 ELSE 0 END AS ready`);
  assert.equal(result.recordset[0].ready, 1);
});

test("session revocation is immediate and durable", { skip }, async (t) => {
  const { sql, pool } = await context();
  const { revokeSession } = require("../utils/sessionSecurity");
  const jti = crypto.randomUUID();
  t.after(() => pool.request().input("Jti", sql.UniqueIdentifier, jti).query("DELETE FROM Security.AuthSessions WHERE jti=@Jti"));
  await pool.request()
    .input("Jti", sql.UniqueIdentifier, jti)
    .input("Hash", sql.Char(64), "a".repeat(64))
    .query(`INSERT INTO Security.AuthSessions (jti,user_id,session_role,token_hash,issued_at,expires_at)
      VALUES (@Jti,-41001,N'user',@Hash,SYSUTCDATETIME(),DATEADD(HOUR,1,SYSUTCDATETIME()))`);
  assert.equal(await revokeSession(pool, jti, "integration_test"), true);
  const row = (await pool.request().input("Jti", sql.UniqueIdentifier, jti).query("SELECT revoked_at FROM Security.AuthSessions WHERE jti=@Jti")).recordset[0];
  assert.ok(row.revoked_at);
});

test("two backend mutations serialize against one durable cart", { skip }, async (t) => {
  const { sql, pool } = await context();
  const { mutateCartState } = require("../utils/durableCartStore");
  const owner = `security-test-${crypto.randomUUID()}`;
  t.after(() => pool.request().input("Owner", sql.NVarChar(128), owner).query("DELETE FROM Commerce.DurableCartStates WHERE owner_key=@Owner"));
  await mutateCartState(pool, owner, (state) => ({ ...state, cart: [{ productId: "fixture", quantity: 0 }] }));
  await Promise.all([
    mutateCartState(pool, owner, (state) => ({ ...state, cart: [{ ...state.cart[0], quantity: state.cart[0].quantity + 1 }] })),
    mutateCartState(pool, owner, (state) => ({ ...state, cart: [{ ...state.cart[0], quantity: state.cart[0].quantity + 1 }] })),
  ]);
  const row = (await pool.request().input("Owner", sql.NVarChar(128), owner).query("SELECT cart_json, version FROM Commerce.DurableCartStates WHERE owner_key=@Owner")).recordset[0];
  assert.equal(JSON.parse(row.cart_json)[0].quantity, 2);
  assert.equal(Number(row.version), 3);
});

test("two simultaneous stock=1 reservations produce exactly one winner", { skip }, async (t) => {
  const { sql, pool } = await context();
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const checkouts = [crypto.randomUUID(), crypto.randomUUID()];
  const suffix = crypto.randomBytes(8).toString("hex");
  t.after(async () => {
    await pool.request().input("A", sql.UniqueIdentifier, checkouts[0]).input("B", sql.UniqueIdentifier, checkouts[1]).input("Variant", sql.UniqueIdentifier, variantId).input("Product", sql.UniqueIdentifier, productId).query(`
      DELETE FROM Commerce.InventoryReservations WHERE checkout_id IN (@A,@B);
      DELETE FROM Commerce.SecureCheckoutSessions WHERE id IN (@A,@B);
      DELETE FROM Commerce.ProductVariants WHERE Id=@Variant;
      DELETE FROM Commerce.Products WHERE Id=@Product;`);
  });
  await pool.request().input("Product", sql.UniqueIdentifier, productId).input("Sku", sql.NVarChar(100), `SEC-P-${suffix}`).input("Slug", sql.NVarChar(255), `security-${suffix}`).query(`
    INSERT INTO Commerce.Products (Id,SKU,Name,Slug,Status,ProductType) VALUES (@Product,@Sku,N'Security fixture',@Slug,N'Active',N'Physical')`);
  await pool.request().input("Variant", sql.UniqueIdentifier, variantId).input("Product", sql.UniqueIdentifier, productId).input("Sku", sql.NVarChar(100), `SEC-V-${suffix}`).query(`
    INSERT INTO Commerce.ProductVariants (Id,ProductId,SKU,VariantName,Status,SellingPrice,Currency,AvailableQuantity) VALUES (@Variant,@Product,@Sku,N'Default',N'Active',10,N'USD',1)`);
  for (const checkout of checkouts) {
    await pool.request().input("Id", sql.UniqueIdentifier, checkout).input("Key", sql.NVarChar(128), `fixture-${checkout}`).query(`
      INSERT INTO Commerce.SecureCheckoutSessions (id,user_key,cart_json,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_method,customer_email,checkout_status,payment_status,expires_at)
      VALUES (@Id,@Key,N'[]',N'USD',10,0,0,10,N'standard',N'fixture@example.invalid',N'Reserving',N'Pending',DATEADD(MINUTE,30,SYSUTCDATETIME()))`);
  }
  async function reserve(checkout) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction).input("Variant", sql.UniqueIdentifier, variantId).query(`
        UPDATE Commerce.ProductVariants WITH (UPDLOCK,ROWLOCK) SET AvailableQuantity=AvailableQuantity-1 WHERE Id=@Variant AND AvailableQuantity>=1`);
      const won = Number(result.rowsAffected?.[0] || 0) === 1;
      if (won) await new sql.Request(transaction).input("Checkout", sql.UniqueIdentifier, checkout).input("Variant", sql.UniqueIdentifier, variantId).query(`
        INSERT INTO Commerce.InventoryReservations (checkout_id,variant_id,quantity,expires_at) VALUES (@Checkout,@Variant,1,DATEADD(MINUTE,30,SYSUTCDATETIME()))`);
      await transaction.commit();
      return won;
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  }
  const winners = await Promise.all(checkouts.map(reserve));
  assert.equal(winners.filter(Boolean).length, 1);
  const state = (await pool.request().input("Variant", sql.UniqueIdentifier, variantId).query(`SELECT AvailableQuantity,(SELECT COUNT(*) FROM Commerce.InventoryReservations WHERE variant_id=@Variant AND reservation_status=N'Active') reservations FROM Commerce.ProductVariants WHERE Id=@Variant`)).recordset[0];
  assert.equal(Number(state.AvailableQuantity), 0);
  assert.equal(Number(state.reservations), 1);
});

test("duplicate webhook IDs have one durable ledger row", { skip }, async (t) => {
  const { sql, pool } = await context();
  const eventId = `evt_security_${crypto.randomBytes(10).toString("hex")}`;
  t.after(() => pool.request().input("Event", sql.NVarChar(255), eventId).query("DELETE FROM Integration.WebhookEvents WHERE provider=N'stripe' AND event_id=@Event"));
  const insert = () => pool.request().input("Event", sql.NVarChar(255), eventId).query(`
    INSERT INTO Integration.WebhookEvents (provider,event_id,event_type,payload_hash) VALUES (N'stripe',@Event,N'checkout.session.completed','${"b".repeat(64)}')`);
  const results = await Promise.allSettled([insert(), insert()]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const count = (await pool.request().input("Event", sql.NVarChar(255), eventId).query("SELECT COUNT(*) count FROM Integration.WebhookEvents WHERE provider=N'stripe' AND event_id=@Event")).recordset[0].count;
  assert.equal(Number(count), 1);
});

test("Customer A/B ownership and injection-shaped identifiers preserve baselines", { skip }, async () => {
  const { sql, pool } = await context();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const a = -42001;
    const b = -42002;
    const address = crypto.randomUUID();
    await new sql.Request(transaction).input("Id", sql.UniqueIdentifier, address).input("A", sql.Int, a).query(`
      INSERT INTO dbo.CustomerAccountAddresses (Id,UserID,AddressType,FirstName,LastName,AddressLine1,City,PostalCode,Country) VALUES (@Id,@A,N'shipping',N'A',N'Fixture',N'1 Test',N'Test',N'00000',N'US')`);
    const inaccessible = await new sql.Request(transaction).input("Id", sql.UniqueIdentifier, address).input("B", sql.Int, b).query("SELECT Id FROM dbo.CustomerAccountAddresses WHERE Id=@Id AND UserID=@B");
    assert.equal(inaccessible.recordset.length, 0);

    const baseline = (await new sql.Request(transaction).input("A", sql.Int, a).query("SELECT COUNT(*) count FROM dbo.CustomerAccountAddresses WHERE UserID=@A")).recordset[0].count;
    for (const payload of ["' OR 1=1--", "0; DELETE FROM dbo.CustomerAccountAddresses--", "../../../etc/passwd"]) {
      await assert.rejects(new sql.Request(transaction).input("Id", sql.UniqueIdentifier, payload).input("A", sql.Int, a).query("DELETE FROM dbo.CustomerAccountAddresses WHERE Id=@Id AND UserID=@A"));
    }
    const after = (await new sql.Request(transaction).input("A", sql.Int, a).query("SELECT COUNT(*) count FROM dbo.CustomerAccountAddresses WHERE UserID=@A")).recordset[0].count;
    assert.equal(Number(after), Number(baseline));
  } finally {
    await transaction.rollback();
  }
});
