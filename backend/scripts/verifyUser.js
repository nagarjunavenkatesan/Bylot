#!/usr/bin/env node
/**
 * CLI utility for operators to manually verify a user's account.
 * Usage: npm run verify-user -- <email>
 */

const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const targetEmail = process.argv[2];

if (!targetEmail || !targetEmail.includes("@")) {
  console.error("Usage: npm run verify-user -- <email>");
  console.error("Error: Please provide a valid email address.");
  process.exit(1);
}

const cleanEmail = targetEmail.toLowerCase().trim();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "bylot"
  });

  try {
    const [rows] = await connection.execute(
      "SELECT id, name, email, email_verified_at FROM users WHERE email = ? LIMIT 1",
      [cleanEmail]
    );

    if (rows.length === 0) {
      console.error(`[VERIFY-USER] Error: No user found with email "${cleanEmail}".`);
      process.exit(1);
    }

    const user = rows[0];
    if (user.email_verified_at) {
      console.log(`[VERIFY-USER] User "${cleanEmail}" is already email-verified (since ${user.email_verified_at}).`);
      process.exit(0);
    }

    await connection.execute(
      `UPDATE users 
       SET email_verified_at = CURRENT_TIMESTAMP, 
           email_verification_token_hash = NULL, 
           email_verification_expires_at = NULL 
       WHERE id = ?`,
      [user.id]
    );

    console.log(`[VERIFY-USER] Success: User "${cleanEmail}" (ID: ${user.id}) has been manually verified by administrator.`);
  } catch (err) {
    console.error("[VERIFY-USER] Fatal error:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();
