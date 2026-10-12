const { pool } = require("../config/db");

const ALLOWED_TABLES = new Set([
  "users",
  "sellers",
  "products",
  "categories",
  "orders",
  "order_items",
  "refresh_tokens",
  "product_reports",
  "token_blacklist"
]);

function validateTable(table) {
  if (!ALLOWED_TABLES.has(String(table).toLowerCase())) {
    throw new Error(`[SECURITY] Unauthorized database table query: ${table}`);
  }
}

async function findById(table, id, columns = "*") {
  validateTable(table);
  const [rows] = await pool.execute(`SELECT ${columns} FROM \`${table}\` WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function deleteById(table, id) {
  validateTable(table);
  const [result] = await pool.execute(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findById,
  deleteById
};
