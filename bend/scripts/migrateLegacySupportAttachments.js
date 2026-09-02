const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const { getPool, closePool } = require("../utils/dbConnection");
const { scanFileForMalware, sha256File } = require("../utils/fileSecurity");

const apply = process.argv.includes("--apply");
const publicRoot = path.resolve(__dirname, "..", "public", "uploads");
const privateRoot = path.resolve(__dirname, "..", "private_uploads", "support");

function attachmentsFrom(value) {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch (_error) { return []; }
}

function legacyFilename(url) {
  const match = String(url || "").match(/^\/(?:api\/)?uploads\/([^/?#]+)$/i);
  return match ? path.basename(match[1]) : null;
}

async function main() {
  if (apply && process.env.ALLOW_LEGACY_ATTACHMENT_MIGRATION !== "true") {
    throw new Error("Set ALLOW_LEGACY_ATTACHMENT_MIGRATION=true and take a database/filesystem backup before using --apply");
  }
  await fs.promises.mkdir(privateRoot, { recursive: true });
  const pool = await getPool();
  const result = await pool.request().query("SELECT [id], [ticket_id], [attachments] FROM [dbo].[ticket_messages] WHERE [attachments] IS NOT NULL AND ISJSON([attachments]) = 1");
  let candidates = 0;
  let migrated = 0;
  let missing = 0;
  let rejected = 0;

  for (const row of result.recordset || []) {
    const attachments = attachmentsFrom(row.attachments);
    let changed = false;
    const copied = [];
    for (const attachment of attachments) {
      const filename = legacyFilename(attachment.url);
      if (!filename) continue;
      candidates += 1;
      const source = path.resolve(publicRoot, filename);
      if (path.dirname(source) !== publicRoot || !fs.existsSync(source)) { missing += 1; continue; }
      if (!apply) continue;
      const scan = await scanFileForMalware(source);
      if (!scan.clean) { rejected += 1; continue; }
      const extension = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
      const storageName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
      const target = path.join(privateRoot, storageName);
      await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
      copied.push({ source, target });
      const stat = await fs.promises.stat(target);
      const hash = await sha256File(target);
      attachment.url = `/api/support/tickets/${row.ticket_id}/attachments/${storageName}`;
      attachment.size = Number(attachment.size) || stat.size;
      attachment.type = String(attachment.type || "application/octet-stream").slice(0, 160);
      attachment.name = String(attachment.name || filename).slice(0, 255);
      attachment.__migration = { storageName, hash, scanner: scan.scanner, detail: scan.detail, legacyPath: `/uploads/${filename}`, statSize: stat.size };
      changed = true;
    }
    if (!apply || !changed) continue;

    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      for (const attachment of attachments.filter((item) => item.__migration)) {
        const metadata = attachment.__migration;
        delete attachment.__migration;
        await new sql.Request(transaction)
          .input("TicketId", sql.Int, row.ticket_id)
          .input("StorageName", sql.NVarChar(255), metadata.storageName)
          .input("OriginalName", sql.NVarChar(255), attachment.name)
          .input("MediaType", sql.NVarChar(160), attachment.type)
          .input("Size", sql.BigInt, metadata.statSize)
          .input("Hash", sql.Char(64), metadata.hash)
          .input("Scanner", sql.NVarChar(80), metadata.scanner)
          .input("Detail", sql.NVarChar(400), String(metadata.detail || "clean").slice(0, 400))
          .input("LegacyPath", sql.NVarChar(500), metadata.legacyPath)
          .query(`INSERT INTO [Security].[UploadObjects]
            ([ticket_id], [storage_name], [original_name], [media_type], [size_bytes], [sha256], [scan_status], [scanner], [scan_detail], [legacy_public_path], [scanned_at], [released_at])
            VALUES (@TicketId, @StorageName, @OriginalName, @MediaType, @Size, @Hash, N'Migrated', @Scanner, @Detail, @LegacyPath, SYSUTCDATETIME(), SYSUTCDATETIME())`);
      }
      await new sql.Request(transaction)
        .input("MessageId", sql.Int, row.id)
        .input("Attachments", sql.NVarChar(sql.MAX), JSON.stringify(attachments))
        .query("UPDATE [dbo].[ticket_messages] SET [attachments] = @Attachments WHERE [id] = @MessageId");
      await transaction.commit();
      for (const file of copied) await fs.promises.unlink(file.source);
      migrated += copied.length;
    } catch (error) {
      await transaction.rollback().catch(() => {});
      await Promise.all(copied.map((file) => fs.promises.unlink(file.target).catch(() => {})));
      throw error;
    }
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", candidates, migrated, missing, rejected }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => closePool().catch(() => {}));

