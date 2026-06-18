const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUser() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  const [rows] = await connection.execute("SELECT id, email, role, status, password_hash FROM users WHERE email = 'nagaarjunbv@gmail.com'");
  console.log('User Details:', rows);
  await connection.end();
}

checkUser().catch(console.error);
