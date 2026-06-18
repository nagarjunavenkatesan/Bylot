const { pool } = require("../config/db");

async function findById(table, id, columns = "*") {
  const [rows] = await pool.execute(`SELECT ${columns} FROM ${table} WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function deleteById(table, id) {
  const [result] = await pool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findById,
  deleteById
};
