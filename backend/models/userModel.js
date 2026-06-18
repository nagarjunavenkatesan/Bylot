const { pool } = require("../config/db");

const publicColumns = "id, name, email, phone, role, profile_image, status, email_verified_at, created_at, updated_at";

async function findUserByEmail(email) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.execute(`SELECT ${publicColumns} FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function createUser({ name, email, phone, passwordHash, googleId, role = "customer", profileImage = null, emailVerified = false }) {
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, phone, password_hash, google_id, role, profile_image, email_verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, phone || null, passwordHash || null, googleId || null, role, profileImage, emailVerified ? new Date() : null]
  );
  return findUserById(result.insertId);
}

async function saveRefreshToken(userId, tokenHash) {
  await pool.execute("UPDATE users SET refresh_token_hash = ? WHERE id = ?", [tokenHash, userId]);
}

module.exports = {
  publicColumns,
  findUserByEmail,
  findUserById,
  createUser,
  saveRefreshToken
};
