#!/usr/bin/env node
/**
 * Safe, trackable database migration runner for Bylot.
 * Tracks applied migrations in the schema_migrations table.
 * 
 * Usage:
 *   node backend/scripts/migrate.js [--dry-run] [--db <dbname>]
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const isDryRun = process.argv.includes("--dry-run");

// Allow passing custom db via argument or env
const dbArgIdx = process.argv.indexOf("--db");
const customDb = dbArgIdx !== -1 ? process.argv[dbArgIdx + 1] : null;

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: customDb || process.env.DB_NAME || "bylot",
  multipleStatements: true
};

function stripComments(sql) {
  // Strip block comments /* ... */
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip line comments -- ... (preserve line structure)
  cleaned = cleaned
    .split("\n")
    .map(line => {
      const idx = line.indexOf("--");
      if (idx === -1) return line;
      return line.slice(0, idx);
    })
    .join("\n");
  return cleaned;
}

function splitSqlStatements(sql) {
  const cleaned = stripComments(sql);
  return cleaned
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function run() {
  console.log(`[MIGRATE] Connecting to database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}...`);
  if (isDryRun) {
    console.log("[MIGRATE] Running in DRY-RUN mode. No changes will be applied.");
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
  } catch (err) {
    console.error("[MIGRATE] Connection failed:", err.message);
    process.exit(1);
  }

  try {
    // 1. Ensure schema_migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Fetch applied migrations
    const [rows] = await connection.query("SELECT filename FROM schema_migrations ORDER BY id ASC");
    const appliedSet = new Set(rows.map(r => r.filename));

    // 3. Find migration files
    const migrationsDir = path.join(__dirname, "../migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("[MIGRATE] No migrations folder found at:", migrationsDir);
      await connection.end();
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log("[MIGRATE] Database is up to date. No pending migrations.");
      await connection.end();
      return;
    }

    console.log(`[MIGRATE] Found ${pending.length} pending migration(s): ${pending.join(", ")}`);

    for (const filename of pending) {
      const filePath = path.join(migrationsDir, filename);
      console.log(`\n[MIGRATE] --------------------------------------------------`);
      console.log(`[MIGRATE] Processing: ${filename}`);

      if (isDryRun) {
        console.log(`[MIGRATE] [DRY RUN] Would execute ${filename}`);
        continue;
      }

      // Check special pre-condition checks
      if (filename.includes("product_constraints")) {
        try {
          const [violating] = await connection.query(
            "SELECT id, name, selling_price, stock_quantity, mrp FROM products WHERE selling_price < 0 OR stock_quantity < 0 OR mrp < 0 LIMIT 10"
          );
          if (violating.length > 0) {
            console.warn(`[MIGRATE] Warning: Found ${violating.length} violating row(s) before applying constraints. Auto-fixing values:`, violating);
          }
        } catch {
          // Table might not exist yet if fresh DB
        }
      }

      const rawSql = fs.readFileSync(filePath, "utf-8");
      const statements = splitSqlStatements(rawSql);

      console.log(`[MIGRATE] Executing ${statements.length} statements from ${filename}...`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await connection.query(stmt);
        } catch (stmtErr) {
          console.error(`[MIGRATE] Error on statement #${i + 1} in ${filename}:`);
          console.error(`Statement: ${stmt.slice(0, 120)}...`);
          console.error(`Error: ${stmtErr.message}`);
          throw stmtErr;
        }
      }

      // Record migration
      await connection.query(
        "INSERT INTO schema_migrations (filename) VALUES (?)",
        [filename]
      );
      console.log(`[MIGRATE] Successfully applied and recorded: ${filename}`);
    }

    console.log(`\n[MIGRATE] All pending migrations successfully processed!`);
  } catch (err) {
    console.error(`\n[MIGRATE] Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
