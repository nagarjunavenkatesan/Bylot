const { pool } = require("../config/db");
const { hashPassword } = require("../utils/password");

async function main() {
  const email = process.env.ADMIN_EMAIL || "nagaarjunbv@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "@bvnd4014BV";
  const name = process.env.ADMIN_NAME || "Bylot Admin";

  if (!email) {
    throw new Error("Set ADMIN_EMAIL before running npm run create-admin");
  }

  const passwordHash = await hashPassword(password);
  const [existing] = await pool.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);

  let userId;
  if (existing[0]) {
    userId = existing[0].id;
    await pool.execute(
      "UPDATE users SET name = ?, password_hash = ?, role = 'admin', status = 'active' WHERE id = ?",
      [name, passwordHash, userId]
    );
  } else {
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash, role, status, email_verified_at) VALUES (?, ?, ?, 'admin', 'active', CURRENT_TIMESTAMP)",
      [name, email, passwordHash]
    );
    userId = result.insertId;
  }

  await pool.execute(
    "INSERT INTO admin (user_id, permissions) VALUES (?, JSON_OBJECT('all', true)) ON DUPLICATE KEY UPDATE permissions = VALUES(permissions)",
    [userId]
  );

  console.log(`Admin user ready: ${email}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
