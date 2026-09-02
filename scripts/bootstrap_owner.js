const bcrypt = require("../bend/node_modules/bcrypt");
const { sql, withMigrationConnection } = require("./lib/database");

function validEmail(value) { return /^\S+@\S+\.\S+$/.test(String(value || "").trim().toLowerCase()); }
function validPassword(value) { return typeof value === "string" && value.length >= 12 && value.length <= 128; }

async function main() {
  const result = await withMigrationConnection(async (pool, config, env) => {
    if (env.ALLOW_SCHEMA_MIGRATIONS !== "true") throw new Error("Set ALLOW_SCHEMA_MIGRATIONS=true for owner bootstrap");
    if (env.MIGRATION_IDENTITY_CONFIRMED !== "true") throw new Error("Set MIGRATION_IDENTITY_CONFIRMED=true to confirm the target database");
    const email = String(env.INITIAL_OWNER_EMAIL || "").trim().toLowerCase();
    const password = env.INITIAL_OWNER_PASSWORD;
    if (!validEmail(email)) throw new Error("INITIAL_OWNER_EMAIL must be a valid email address");
    if (!validPassword(password)) throw new Error("INITIAL_OWNER_PASSWORD must be 12-128 characters");

    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const ownerCount = await new sql.Request(transaction).query("SELECT COUNT(*) AS OwnerCount FROM dbo.User_tbl WHERE LOWER(ISNULL(Role, N'customer')) = N'owner'");
      if (Number(ownerCount.recordset?.[0]?.OwnerCount || 0) > 0) {
        await transaction.rollback();
        return { database: config.database, created: false, reason: "owner_exists" };
      }

      const existing = await new sql.Request(transaction).input("Email", sql.NVarChar(255), email)
        .query("SELECT TOP 1 UserID, Role FROM dbo.User_tbl WHERE LOWER(LTRIM(RTRIM(Email)))=@Email");
      if (existing.recordset?.length) throw new Error("INITIAL_OWNER_EMAIL already belongs to a user; use the explicit promote_owner command for an existing installation");

      const username = String(env.INITIAL_OWNER_USERNAME || email.split("@")[0]).trim().slice(0, 100);
      const passwordHash = await bcrypt.hash(password, 12);
      await new sql.Request(transaction)
        .input("Username", sql.NVarChar(100), username)
        .input("Email", sql.NVarChar(255), email)
        .input("PasswordHash", sql.NVarChar(255), passwordHash)
        .input("Role", sql.NVarChar(50), "owner")
        .query("INSERT INTO dbo.User_tbl (Username, Email, PasswordHash, Role, CreatedAt) VALUES (@Username,@Email,@PasswordHash,@Role,GETDATE())");
      await transaction.commit();
      return { database: config.database, created: true, email };
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  });
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
