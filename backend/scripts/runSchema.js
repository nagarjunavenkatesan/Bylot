const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const env = require("../config/env");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "config", "schema.sql"), "utf8");
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true
  });

  await connection.query(sql);
  await connection.end();
  console.log("Bylot database schema applied successfully");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
