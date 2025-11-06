const sql = require("mssql");
const dbConfig = require("../config/db");

let poolPromise;

const getPool = async () => {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig)
      .then(pool => {
        console.log("✅ Connected to SQL Server");
        return pool;
      })
      .catch(err => {
        console.error("❌ Database connection failed", err);
        throw err;
      });
  }
  return poolPromise;
};

module.exports = { getPool };
