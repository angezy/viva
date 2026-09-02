const crypto = require("crypto");
const sql = require("mssql");
const { getPool } = require("./dbConnection");

const SEVERITIES = new Set(["info", "warning", "high", "critical"]);

function auditHash(value) {
  if (value === undefined || value === null || value === "") return null;
  const key = String(process.env.SECURITY_EVENT_KEY_SECRET || process.env.RATE_LIMIT_KEY_SECRET || "development-audit-key");
  return crypto.createHmac("sha256", key).update(String(value)).digest("hex");
}

function safeMetadata(metadata = {}) {
  const output = {};
  for (const [key, value] of Object.entries(metadata || {}).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_.-]{1,60}$/.test(key)) continue;
    if (["password", "token", "secret", "authorization", "cookie", "payload"].some((word) => key.toLowerCase().includes(word))) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      output[key] = typeof value === "string" ? value.slice(0, 300) : value;
    }
  }
  return output;
}

async function recordSecurityEvent({ pool = null, eventType, severity = "info", actor = null, resourceType = null, resourceId = null, requestId = null, metadata = {} }) {
  const normalizedType = String(eventType || "security.unknown").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100);
  const normalizedSeverity = SEVERITIES.has(severity) ? severity : "info";
  const safe = safeMetadata(metadata);
  try {
    const db = pool || await getPool();
    await db.request()
      .input("EventType", sql.NVarChar(100), normalizedType)
      .input("Severity", sql.NVarChar(20), normalizedSeverity)
      .input("ActorHash", sql.Char(64), auditHash(actor))
      .input("ResourceType", sql.NVarChar(80), resourceType ? String(resourceType).slice(0, 80) : null)
      .input("ResourceIdHash", sql.Char(64), auditHash(resourceId))
      .input("RequestId", sql.UniqueIdentifier, requestId || null)
      .input("Metadata", sql.NVarChar(2000), Object.keys(safe).length ? JSON.stringify(safe) : null)
      .query(`INSERT INTO [Integration].[SecurityEvents]
        ([event_type], [severity], [actor_hash], [resource_type], [resource_id_hash], [request_id], [metadata_json])
        VALUES (@EventType, @Severity, @ActorHash, @ResourceType, @ResourceIdHash, @RequestId, @Metadata)`);
  } catch (error) {
    // A telemetry outage must not disclose secrets or mask the primary request.
    console.warn(JSON.stringify({ type: "security_event_fallback", eventType: normalizedType, severity: normalizedSeverity, metadata: safe, error: String(error?.code || "unavailable").slice(0, 80) }));
  }
}

module.exports = { auditHash, recordSecurityEvent, safeMetadata };

