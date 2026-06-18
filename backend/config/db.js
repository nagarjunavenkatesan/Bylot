const mysql = require("mysql2/promise");
const env = require("./env");

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  decimalNumbers: true,
  timezone: "Z"
});

async function pingDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  pingDatabase
};
