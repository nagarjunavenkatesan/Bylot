const { pool } = require("../config/db");

async function findSellerByUserId(userId) {
  const [rows] = await pool.execute("SELECT * FROM sellers WHERE user_id = ? LIMIT 1", [userId]);
  return rows[0] || null;
}

module.exports = {
  findSellerByUserId
};
