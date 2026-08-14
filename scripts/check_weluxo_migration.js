require('dotenv').config({ path: require('path').join(__dirname, '..', 'bend', '.env') });
const sql = require('../bend/node_modules/mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 20000,
  requestTimeout: 30000
};
if (process.env.DB_PORT) config.port = Number(process.env.DB_PORT);

async function main() {
  const pool = await sql.connect(config);
  try {
    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS [DatabaseName],
        DB_ID() AS [DatabaseId],
        OBJECT_ID(N'[ERP].[Payments]', N'U') AS [PaymentsObjectId],
        OBJECT_ID(N'[Commerce].[SupplierOrders]', N'U') AS [SupplierOrdersObjectId],
        CASE WHEN OBJECT_ID(N'[dbo].[WeluxoMigrationHistory]', N'U') IS NULL THEN 0 ELSE 1 END AS [HistoryTableExists],
        CASE WHEN EXISTS (SELECT 1 FROM sys.schemas WHERE [name] = N'Commerce') THEN 1 ELSE 0 END AS [CommerceSchemaExists],
        CASE WHEN EXISTS (SELECT 1 FROM sys.schemas WHERE [name] = N'ERP') THEN 1 ELSE 0 END AS [ERPSchemaExists],
        CASE WHEN EXISTS (SELECT 1 FROM sys.schemas WHERE [name] = N'CRM') THEN 1 ELSE 0 END AS [CRMSchemaExists];
    `);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await sql.close();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ error: error.message, number: error.number || null }));
  process.exitCode = 1;
});
