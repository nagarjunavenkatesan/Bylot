const { pool } = require("../config/db");

const publicColumns = "id, name, email, phone, role, profile_image, status, email_verified_at, token_version, created_at, updated_at";

async function findUserByEmail(email) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

async function findUserByGoogleId(googleId) {
  const [rows] = await pool.execute("SELECT * FROM users WHERE google_id = ? LIMIT 1", [googleId]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.execute(`SELECT ${publicColumns} FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

async function createUser({
  name,
  email,
  phone,
  passwordHash,
  googleId,
  role = "customer",
  profileImage = null,
  emailVerified = false,
  verificationTokenHash = null,
  verificationExpiresAt = null
}) {
  const [result] = await pool.execute(
    `INSERT INTO users (
      name, email, phone, password_hash, google_id, role, profile_image,
      email_verified_at, email_verification_token_hash, email_verification_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      phone || null,
      passwordHash || null,
      googleId || null,
      role,
      profileImage || null,
      emailVerified ? new Date() : null,
      verificationTokenHash || null,
      verificationExpiresAt || null
    ]
  );
  return findUserById(result.insertId);
}

module.exports = {
  publicColumns,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  createUser
};
