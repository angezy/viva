const fs = require("fs");
const path = require("path");
const { getPool, closePool } = require("../utils/dbConnection");

const apply = process.argv.includes("--apply");
const retentionHours = Math.min(24 * 30, Math.max(24, Number(process.env.ORPHAN_UPLOAD_RETENTION_HOURS) || 48));
const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
const roots = [
  path.resolve(__dirname, "..", "public", "uploads"),
  path.resolve(__dirname, "..", "private_uploads", "support"),
  path.resolve(__dirname, "..", "private_uploads", "quarantine"),
];

function collectPaths(value, output) {
  const matches = String(value || "").match(/\/(?:api\/)?uploads\/[a-zA-Z0-9_./-]+/g) || [];
  for (const match of matches) output.add(path.basename(match));
}

async function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  for (const entry of await fs.promises.readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

async function main() {
  if (apply && process.env.ALLOW_ORPHAN_UPLOAD_CLEANUP !== "true") throw new Error("Set ALLOW_ORPHAN_UPLOAD_CLEANUP=true before using --apply");
  const pool = await getPool();
  const result = await pool.request().query(`
    CREATE TABLE #refs ([value] NVARCHAR(MAX));
    IF OBJECT_ID(N'[dbo].[Products_tbl]') IS NOT NULL AND COL_LENGTH(N'dbo.Products_tbl', N'Img') IS NOT NULL
      EXEC(N'INSERT INTO #refs SELECT TRY_CONVERT(NVARCHAR(MAX), [Img]) FROM [dbo].[Products_tbl]');
    IF OBJECT_ID(N'[Commerce].[ProductImages]', N'U') IS NOT NULL INSERT INTO #refs SELECT [Url] FROM [Commerce].[ProductImages];
    IF OBJECT_ID(N'[Commerce].[StorefrontProductImages]', N'U') IS NOT NULL INSERT INTO #refs SELECT [ImagePath] FROM [Commerce].[StorefrontProductImages];
    IF OBJECT_ID(N'[dbo].[Comments]', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Comments', N'Img') IS NOT NULL
      EXEC(N'INSERT INTO #refs SELECT TRY_CONVERT(NVARCHAR(MAX), [Img]) FROM [dbo].[Comments]');
    IF OBJECT_ID(N'[dbo].[DashboardSettings]', N'U') IS NOT NULL INSERT INTO #refs SELECT [SettingValue] FROM [dbo].[DashboardSettings];
    IF OBJECT_ID(N'[Security].[UploadObjects]', N'U') IS NOT NULL INSERT INTO #refs SELECT [storage_name] FROM [Security].[UploadObjects] WHERE [deleted_at] IS NULL;
    SELECT [value] FROM #refs WHERE [value] IS NOT NULL;`);
  const referenced = new Set();
  for (const row of result.recordset || []) collectPaths(row.value, referenced);
  for (const row of result.recordset || []) if (/^[a-zA-Z0-9_.-]+$/.test(String(row.value || ""))) referenced.add(path.basename(row.value));

  const candidates = [];
  for (const root of roots) {
    for (const file of await walkFiles(root)) {
      const stat = await fs.promises.stat(file);
      const isQuarantine = path.resolve(file).startsWith(roots[2] + path.sep);
      if (stat.mtimeMs <= cutoff && (isQuarantine || !referenced.has(path.basename(file)))) candidates.push(file);
    }
  }
  if (apply) await Promise.all(candidates.map((file) => fs.promises.unlink(file)));
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", retentionHours, candidates: candidates.length, deleted: apply ? candidates.length : 0 }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => closePool().catch(() => {}));
