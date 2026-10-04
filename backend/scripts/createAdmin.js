const readline = require("readline");
const { pool } = require("../config/db");
const { hashPassword } = require("../utils/password");

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Bylot Administrator";

  if (!email) {
    email = await askQuestion("Enter Admin Email: ");
  }
  if (!password) {
    password = await askQuestion("Enter Admin Password: ");
  }

  email = (email || "").trim().toLowerCase();
  password = (password || "").trim();

  if (!email || !password) {
    throw new Error("Both ADMIN_EMAIL and ADMIN_PASSWORD are required to create an admin user.");
  }
  if (password.length < 10) {
    throw new Error("Admin password must be at least 10 characters long.");
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
