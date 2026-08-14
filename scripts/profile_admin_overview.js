require('dotenv').config({ path: require('path').join(__dirname, '..', 'bend', '.env') });
const sql = require('../bend/node_modules/mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 20000,
  requestTimeout: 60000
};
if (process.env.DB_PORT) config.port = Number(process.env.DB_PORT);

async function timed(pool, label, query) {
  const started = Date.now();
  try {
    const result = await pool.request().query(query);
    const rows = result.recordset || result || [];
    console.log(JSON.stringify({ label, elapsedMs: Date.now() - started, rows: Array.isArray(rows) ? rows : [] }));
  } catch (error) {
    console.log(JSON.stringify({ label, elapsedMs: Date.now() - started, error: error.message, number: error.number || null }));
  }
}

async function main() {
  const pool = await sql.connect(config);
  try {
    await timed(pool, 'row_counts', `
      SELECT s.[name] AS [SchemaName], t.[name] AS [TableName], SUM(ps.[row_count]) AS [Rows]
      FROM sys.dm_db_partition_stats ps
      JOIN sys.tables t ON t.[object_id] = ps.[object_id]
      JOIN sys.schemas s ON s.[schema_id] = t.[schema_id]
      WHERE ps.[index_id] IN (0, 1) AND s.[name] IN (N'Commerce', N'ERP', N'CRM')
      GROUP BY s.[name], t.[name]
      ORDER BY SUM(ps.[row_count]) DESC;
    `);
    await timed(pool, 'orders_period', `SELECT COUNT_BIG(*) AS [Rows], COALESCE(SUM([TotalAmount] - [RefundedAmount]), 0) AS [Revenue] FROM [Commerce].[Orders] WHERE [CreatedAt] >= DATEADD(DAY, -29, CONVERT(DATE, SYSUTCDATETIME())) AND [CreatedAt] < DATEADD(DAY, 1, CONVERT(DATE, SYSUTCDATETIME())) AND [Currency] = N'USD';`);
    await timed(pool, 'order_items_period', `SELECT COUNT_BIG(*) AS [Rows], COALESCE(SUM(oi.[TotalAmount]), 0) AS [GrossSales] FROM [Commerce].[OrderItems] oi JOIN [Commerce].[Orders] o ON o.[Id] = oi.[OrderId] WHERE o.[CreatedAt] >= DATEADD(DAY, -29, CONVERT(DATE, SYSUTCDATETIME())) AND o.[CreatedAt] < DATEADD(DAY, 1, CONVERT(DATE, SYSUTCDATETIME())) AND o.[Currency] = N'USD';`);
    await timed(pool, 'open_tickets', `SELECT COUNT_BIG(*) AS [OpenTickets] FROM [CRM].[Tickets] WHERE [Status] NOT IN (N'Resolved', N'Closed');`);
    await timed(pool, 'campaign_events', `SELECT COUNT_BIG(*) AS [Events], COALESCE(SUM([RevenueAmount]), 0) AS [Revenue] FROM [CRM].[CampaignEvents] WHERE [EventAt] >= DATEADD(DAY, -29, CONVERT(DATE, SYSUTCDATETIME())) AND [EventAt] < DATEADD(DAY, 1, CONVERT(DATE, SYSUTCDATETIME()));`);
  } finally {
    await sql.close();
  }
}

main().catch(error => { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; });
