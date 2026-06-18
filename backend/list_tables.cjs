const mysql = require('mysql2/promise');
require('dotenv').config();

async function listTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  const [rows] = await connection.execute("SHOW TABLES");
  console.log('Tables:', rows);
  await connection.end();
}

listTables().catch(console.error);
