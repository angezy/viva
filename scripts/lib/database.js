const fs = require("node:fs");
const path = require("node:path");
const sql = require(path.join(__dirname, "..", "..", "bend", "node_modules", "mssql"));

const root = path.resolve(__dirname, "..", "..");

function loadEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

function loadProjectEnv() {
  return {
    ...loadEnv(path.join(root, ".env")),
    ...loadEnv(path.join(root, "bend", ".env")),
    ...process.env,
  };
}

function migrationConfig(env = loadProjectEnv()) {
  const value = (migrationName, runtimeName) => env[migrationName] || env[runtimeName] || undefined;
  const config = {
    user: value("MIGRATION_DB_USER", "DB_USER"),
    password: value("MIGRATION_DB_PASSWORD", "DB_PASSWORD"),
    server: value("MIGRATION_DB_SERVER", "DB_SERVER"),
    database: value("MIGRATION_DB_DATABASE", "DB_DATABASE"),
    port: Number(value("MIGRATION_DB_PORT", "DB_PORT")) || 1433,
    options: {
      encrypt: String(value("MIGRATION_DB_ENCRYPT", "DB_ENCRYPT") ?? "true") !== "false",
      trustServerCertificate: String(value("MIGRATION_DB_TRUST_SERVER_CERT", "DB_TRUST_SERVER_CERT") ?? "false") === "true",
      enableArithAbort: true,
    },
    connectionTimeout: 20000,
    requestTimeout: 180000,
  };
  if (!config.user || !config.server || !config.database) throw new Error("Configure DB_USER/DB_SERVER/DB_DATABASE or the MIGRATION_DB_* equivalents");
  return config;
}

function splitSqlBatches(source) {
  return String(source || "")
    .split(/^\s*GO\s*(?:--.*)?$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function withMigrationConnection(callback) {
  const env = loadProjectEnv();
  const config = migrationConfig(env);
  const pool = await sql.connect(config);
  try {
    return await callback(pool, config, env);
  } finally {
    await pool.close().catch(() => {});
    sql.close();
  }
}

module.exports = { loadProjectEnv, migrationConfig, root, splitSqlBatches, sql, withMigrationConnection };
