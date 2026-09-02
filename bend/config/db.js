const path = require("path");
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT) || 1433,
    pool: {
        max: Number(process.env.DB_POOL_MAX) || 10,
        min: Number(process.env.DB_POOL_MIN) || 0,
        idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000,
    },
    options: {
        encrypt: process.env.DB_ENCRYPT !== "false",
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true",
    },
};
module.exports = dbConfig;
