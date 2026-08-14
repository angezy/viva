const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sql = require(path.join(root, 'bend', 'node_modules', 'mssql'));

function loadEnv(filePath) {
  const values = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const split = line.indexOf('=');
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

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const env = { ...loadEnv(path.join(root, 'bend', '.env')), ...process.env };
  const migrationPath = path.join(root, 'database', 'migrations', '001_weluxo_platform_upgrade.sql');
  let migrationSql = fs.readFileSync(migrationPath, 'utf8');

  if (mode === 'dry-run') {
    migrationSql = migrationSql.replace(
      /\n  COMMIT TRANSACTION;\r?\nEND TRY/,
      '\n  ROLLBACK TRANSACTION;\nEND TRY'
    );
  }

  const config = {
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    server: env.DB_SERVER,
    database: env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    connectionTimeout: 20000,
    requestTimeout: 180000
  };
  if (env.DB_PORT) config.port = Number(env.DB_PORT);

  if (!config.user || !config.server || !config.database) {
    throw new Error('DB_USER, DB_SERVER, and DB_DATABASE must be configured in bend/.env');
  }

  const connection = await sql.connect(config);
  try {
    await connection.request().batch(migrationSql);
    console.log(JSON.stringify({ mode, database: config.database, migration: path.basename(migrationPath), success: true }));
  } finally {
    sql.close();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ success: false, error: error.message, number: error.number || null, lineNumber: error.lineNumber || null }));
  process.exitCode = 1;
});

