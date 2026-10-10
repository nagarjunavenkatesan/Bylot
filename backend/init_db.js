const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.DB_PASSWORD) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

async function initDB() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.ALLOW_PROD_DB_INIT !== 'true') {
    console.error('[DB INIT FATAL] Database initialization is blocked in production to protect existing data.');
    console.error('To run safely, provide ALLOW_PROD_DB_INIT=true explicitly alongside required database credentials.');
    process.exit(1);
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'bylot';

  if (!password) {
    console.error('[DB INIT FATAL] DB_PASSWORD environment variable is required. Default or fallback passwords are not allowed.');
    process.exit(1);
  }

  try {
    console.log(`Connecting to MySQL server at ${host}:${port} as ${user}...`);
    // Connect without database first to ensure database exists
    const rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.end();

    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: dbName,
      multipleStatements: true
    });

    console.log(`Connected to database "${dbName}". Running schema.sql...`);
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await connection.query(schemaSql);
    console.log('Database and tables initialized successfully!');

    await connection.end();
  } catch (err) {
    console.error('[DB INIT FATAL] Failed to initialize DB:', err.message);
    process.exit(1);
  }
}

initDB();
