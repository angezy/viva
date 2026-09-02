const fs = require("node:fs");
const path = require("node:path");
const { root, splitSqlBatches, withMigrationConnection } = require("./lib/database");

const migrationsDir = path.join(root, "database", "migrations");
const systemSeed = path.join(root, "database", "seeds", "seed-system.sql");
const foundation = path.join(root, "scripts", "create_database.sql");

function migrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort((a, b) => Number(a.match(/^\d+/)[0]) - Number(b.match(/^\d+/)[0]));
}

async function executeFile(pool, filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const batch of splitSqlBatches(source)) await pool.request().batch(batch);
}

async function hasObject(pool, name, type = "U") {
  const result = await pool.request().input("ObjectName", name).input("ObjectType", type)
    .query("SELECT CASE WHEN OBJECT_ID(@ObjectName, @ObjectType) IS NULL THEN 0 ELSE 1 END AS Present");
  return Number(result.recordset?.[0]?.Present) === 1;
}

async function applyMigration(pool, fileName) {
  const migrationId = fileName.replace(/\.sql$/i, "");
  const historyReady = await hasObject(pool, "dbo.WeluxoMigrationHistory");
  if (historyReady) {
    const result = await pool.request().input("MigrationId", migrationId)
      .query("SELECT 1 AS Applied FROM dbo.WeluxoMigrationHistory WHERE MigrationId = @MigrationId");
    if (result.recordset?.length) return { fileName, skipped: true };
  }
  await executeFile(pool, path.join(migrationsDir, fileName));
  if (await hasObject(pool, "dbo.WeluxoMigrationHistory")) {
    await pool.request().input("MigrationId", migrationId).input("Description", `Applied ${fileName}`)
      .query("IF NOT EXISTS (SELECT 1 FROM dbo.WeluxoMigrationHistory WHERE MigrationId=@MigrationId) INSERT INTO dbo.WeluxoMigrationHistory(MigrationId,Description) VALUES(@MigrationId,@Description)");
  }
  return { fileName, skipped: false };
}

async function main() {
  const envResult = await withMigrationConnection(async (pool, config, env) => {
    if (env.ALLOW_SCHEMA_MIGRATIONS !== "true") throw new Error("Set ALLOW_SCHEMA_MIGRATIONS=true for a controlled bootstrap run");
    if (env.MIGRATION_IDENTITY_CONFIRMED !== "true") throw new Error("Set MIGRATION_IDENTITY_CONFIRMED=true to confirm the deployment database identity");

    const tableResult = await pool.request().query("SELECT COUNT(*) AS TableCount FROM sys.tables");
    const hasLegacyFoundation = await hasObject(pool, "dbo.User_tbl");
    let foundationCreated = false;
    if (!hasLegacyFoundation && Number(tableResult.recordset?.[0]?.TableCount || 0) === 0) {
      await executeFile(pool, foundation);
      foundationCreated = true;
    } else if (!hasLegacyFoundation) {
      throw new Error("Target database is not empty but the required dbo.User_tbl foundation is missing; refusing to guess its contents");
    }

    const applied = [];
    for (const fileName of migrationFiles()) applied.push(await applyMigration(pool, fileName));
    await executeFile(pool, systemSeed);
    return { database: config.database, foundationCreated, migrations: applied, systemSeed: true };
  });
  console.log(JSON.stringify({ ok: true, ...envResult }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
