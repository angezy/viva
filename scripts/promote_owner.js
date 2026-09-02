const { sql, withMigrationConnection } = require("./lib/database");

function requestedEmail() {
  const index = process.argv.indexOf("--email");
  return index >= 0 ? String(process.argv[index + 1] || "").trim().toLowerCase() : "";
}

async function main() {
  const email = requestedEmail();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Usage: node scripts/promote_owner.js --email existing-admin@example.com");
  const result = await withMigrationConnection(async (pool, config, env) => {
    if (env.ALLOW_OWNER_MIGRATION !== "true") throw new Error("Set ALLOW_OWNER_MIGRATION=true for an explicit owner migration");
    if (env.MIGRATION_IDENTITY_CONFIRMED !== "true") throw new Error("Set MIGRATION_IDENTITY_CONFIRMED=true to confirm the target database");
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const owners = await new sql.Request(transaction).query("SELECT COUNT(*) AS OwnerCount FROM dbo.User_tbl WHERE LOWER(ISNULL(Role,N'customer'))=N'owner'");
      if (Number(owners.recordset?.[0]?.OwnerCount || 0) > 0) {
        await transaction.rollback();
        return { database: config.database, changed: false, reason: "owner_exists" };
      }
      const target = await new sql.Request(transaction).input("Email", sql.NVarChar(255), email)
        .query("SELECT TOP 1 UserID, Role FROM dbo.User_tbl WITH (UPDLOCK,HOLDLOCK) WHERE LOWER(LTRIM(RTRIM(Email)))=@Email");
      if (!target.recordset?.length) throw new Error("The explicitly supplied owner email was not found");
      const user = target.recordset[0];
      if (!["admin", "customer", "user"].includes(String(user.Role || "customer").toLowerCase())) throw new Error("Only an existing admin/customer account may be promoted");
      await new sql.Request(transaction).input("UserID", sql.Int, user.UserID)
        .query("UPDATE dbo.User_tbl SET Role=N'owner' WHERE UserID=@UserID; UPDATE Security.AuthSessions SET revoked_at=COALESCE(revoked_at,SYSUTCDATETIME()), revocation_reason=N'role_migration' WHERE user_id=@UserID AND revoked_at IS NULL");
      await transaction.commit();
      return { database: config.database, changed: true, email };
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
