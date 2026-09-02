const sql = require("mssql");
const dbConfig = require("../config/db");

let poolPromise;

const getPool = async () => {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig)
      .then((pool) => pool)
      .catch((err) => {
        poolPromise = undefined;
        console.error("Database connection failed", err && err.message ? err.message : err);
        throw err;
      });
  }
  return poolPromise;
};

async function closePool() {
  const pool = await poolPromise;
  poolPromise = undefined;
  if (pool) await pool.close();
}

module.exports = { getPool, closePool };
