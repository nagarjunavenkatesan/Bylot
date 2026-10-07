// backend/tests/globalSetup.js
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

module.exports = async function globalSetup() {
  if (process.env.NODE_ENV === "production") {
    console.error("[TEST GUARD] Tests cannot be run in production!");
    process.exit(1);
  }

  process.env.NODE_ENV = "test";
  const testDb = process.env.DB_NAME || "bylot_test";
  process.env.DB_NAME = testDb;

  if (!testDb.endsWith("_test")) {
    console.error(`[TEST GUARD] DB_NAME must end in _test. Current: ${testDb}`);
    process.exit(1);
  }

  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "4014";
  const port = Number(process.env.DB_PORT || 3306);

  try {
    const rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${testDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.end();

    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: testDb,
      multipleStatements: true
    });

    // Apply schema
    const schemaPath = path.join(__dirname, "../config/schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      await conn.query(schemaSql);
    }

    await conn.end();

    const { spawnSync } = require("child_process");
    const migrate = spawnSync(
      process.execPath,
      [path.join(__dirname, "../scripts/migrate.js"), "--db", testDb],
      {
        env: { ...process.env, DB_NAME: testDb, NODE_ENV: "test" },
        encoding: "utf8"
      }
    );
    if (migrate.status !== 0) {
      console.error(migrate.stdout || migrate.stderr);
      throw new Error("Failed to apply migrations in test globalSetup");
    }
  } catch (err) {
    console.error("[TEST SETUP FATAL] Failed to initialize test database:", err.message);
    throw err;
  }
};
