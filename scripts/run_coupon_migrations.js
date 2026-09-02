const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sql = require(path.join(root, "bend", "node_modules", "mssql"));

function loadEnv(filePath) {
  const values = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const split = line.indexOf("=");
    if (split < 0) continue;
    const key = line.slice(0, split).trim();
    let value = line.slice(split + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function migrationSql(fileName) {
  return fs.readFileSync(path.join(root, "database", "migrations", fileName), "utf8");
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const env = { ...loadEnv(path.join(root, "bend", ".env")), ...process.env };
  const config = {
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    server: env.DB_SERVER,
    database: env.DB_DATABASE,
    options: {
      encrypt: env.DB_ENCRYPT === "true",
      trustServerCertificate: env.DB_TRUST_SERVER_CERT !== "false",
      enableArithAbort: true,
    },
    connectionTimeout: 20000,
    requestTimeout: 30000,
  };
  if (env.DB_PORT) config.port = Number(env.DB_PORT);

  if (!config.user || !config.server || !config.database) {
    throw new Error("DB_USER, DB_SERVER, and DB_DATABASE must be configured in bend/.env");
  }

  const migrations = ["005_coupons.sql", "007_coupon_redemptions.sql"];
  const connection = await sql.connect(config);
  try {
    const body = migrations.map(migrationSql).join("\n");
    const batch = mode === "dry-run"
      ? `SET XACT_ABORT ON; BEGIN TRANSACTION; ${body}\nROLLBACK TRANSACTION;`
      : body;
    await connection.request().batch(batch);

    const result = await connection.request().query(`
      SELECT
        CASE WHEN OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL THEN 1 ELSE 0 END AS CouponsReady,
        CASE WHEN OBJECT_ID(N'dbo.CouponRedemptions', N'U') IS NOT NULL THEN 1 ELSE 0 END AS RedemptionsReady;
    `);
    const row = result.recordset?.[0] || {};
    console.log(JSON.stringify({
      mode,
      database: config.database,
      migrations,
      couponsReady: row.CouponsReady === 1,
      redemptionsReady: row.RedemptionsReady === 1,
    }));
  } finally {
    await sql.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message,
    number: error.number || null,
  }));
  process.exitCode = 1;
});
