const fs = require("fs");
const path = require("path");
const sql = require("mssql");

const root = path.resolve(__dirname, "..", "..");
require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, "bend", ".env") });
const migrationDirectory = path.join(root, "database", "migrations");
const migrations = fs.readdirSync(migrationDirectory).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
const expectedObjects = [
  "Security.AuthSessions",
  "Security.RateLimitBuckets",
  "Security.UploadObjects",
  "Commerce.DurableCartStates",
  "Commerce.SecureCheckoutSessions",
  "Commerce.InventoryReservations",
  "Commerce.InventoryAdjustments",
  "Integration.WebhookEvents",
  "Integration.SecurityEvents",
  "Integration.CjImportMappings",
  "Commerce.CjFulfillmentOrders",
  "Commerce.LegacyProductInventoryMappings",
  "dbo.CustomerEmailQueue",
];

function connectionConfig(apply) {
  const prefix = apply ? "MIGRATION_DB_" : "DB_";
  const config = {
    user: process.env[`${prefix}USER`],
    password: process.env[`${prefix}PASSWORD`],
    server: process.env[`${prefix}SERVER`] || process.env.DB_SERVER,
    database: process.env[`${prefix}DATABASE`] || process.env.DB_DATABASE,
    port: Number(process.env[`${prefix}PORT`] || process.env.DB_PORT) || 1433,
    connectionTimeout: 20_000,
    requestTimeout: 120_000,
    pool: { max: 2, min: 0, idleTimeoutMillis: 10_000 },
    options: {
      encrypt: String(process.env[`${prefix}ENCRYPT`] ?? process.env.DB_ENCRYPT) !== "false",
      trustServerCertificate: String(process.env[`${prefix}TRUST_SERVER_CERT`] ?? process.env.DB_TRUST_SERVER_CERT) === "true",
    },
  };
  if (!config.user || !config.password || !config.server || !config.database) {
    throw new Error(`${prefix}USER, ${prefix}PASSWORD, server, and database must be configured`);
  }
  return config;
}

async function verify(pool) {
  const request = pool.request();
  const selects = expectedObjects.map((name, index) => {
    request.input(`Object${index}`, sql.NVarChar(261), name);
    return `SELECT @Object${index} AS [name], CASE WHEN OBJECT_ID(@Object${index}, N'U') IS NULL THEN 0 ELSE 1 END AS [ready]`;
  });
  const result = await request.query(selects.join(" UNION ALL "));
  const missing = (result.recordset || []).filter((row) => row.ready !== 1).map((row) => row.name);
  if (missing.length) throw new Error(`Schema verification failed; missing: ${missing.join(", ")}`);
  return { ready: expectedObjects.length, missing: [] };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verifyOnly = process.argv.includes("--verify");
  if (!apply && !verifyOnly) {
    console.log(JSON.stringify({ mode: "plan", migrations, applyCommand: "npm run migrate:security:apply", verifyCommand: "npm run migrate:security:verify" }));
    return;
  }
  if (apply) {
    if (process.env.ALLOW_SCHEMA_MIGRATIONS !== "true") throw new Error("Set ALLOW_SCHEMA_MIGRATIONS=true to authorize schema changes");
    if (process.env.MIGRATION_IDENTITY_CONFIRMED !== "true") throw new Error("Set MIGRATION_IDENTITY_CONFIRMED=true after confirming a deployment-only database identity");
    if (process.env.NODE_ENV === "production" && process.env.BACKUP_RESTORE_CONFIRMED !== "true") {
      throw new Error("Production migration requires BACKUP_RESTORE_CONFIRMED=true after a restore-clone rehearsal");
    }
  }

  const pool = await sql.connect(connectionConfig(apply));
  try {
    if (apply) {
      for (const name of migrations) {
        const body = fs.readFileSync(path.join(migrationDirectory, name), "utf8");
        await pool.request().batch(body);
        console.log(JSON.stringify({ applied: name }));
      }
    }
    const result = await verify(pool);
    console.log(JSON.stringify({ mode: apply ? "apply" : "verify", database: pool.config.database, migrations: apply ? migrations.length : undefined, ...result }));
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: String(error?.message || error), number: error?.number || null }));
  process.exitCode = 1;
});
