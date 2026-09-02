const sql = require("mssql");

async function objectExists(pool, qualifiedName, acceptedTypes = ["U"]) {
  const types = acceptedTypes.filter((type) => ["U", "V"].includes(type));
  if (!types.length) return false;
  const request = pool.request().input("ObjectName", sql.NVarChar(261), qualifiedName);
  const placeholders = types.map((type, index) => {
    request.input(`Type${index}`, sql.Char(2), type);
    return `@Type${index}`;
  });
  const result = await request.query(`SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.objects WHERE [object_id] = OBJECT_ID(@ObjectName) AND [type] IN (${placeholders.join(",")})) THEN 1 ELSE 0 END AS ready`);
  return Number(result.recordset?.[0]?.ready) === 1;
}

async function requireSchemaObjects(pool, names) {
  const missing = [];
  for (const entry of names) {
    const name = typeof entry === "string" ? entry : entry.name;
    const types = typeof entry === "string" ? ["U"] : entry.types || ["U"];
    if (!(await objectExists(pool, name, types))) missing.push(name);
  }
  if (missing.length) {
    const error = new Error(`Required database schema is missing (${missing.join(", ")}); apply the current database migrations`);
    error.code = "SCHEMA_MIGRATION_REQUIRED";
    throw error;
  }
  return true;
}

module.exports = { objectExists, requireSchemaObjects };
