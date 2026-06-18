const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDB() {
  try {
    // Connect without database first to create it
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '4014',
      multipleStatements: true
    });
    
    console.log('Connected to MySQL. Running schema.sql...');
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    await connection.query(schemaSql);
    console.log('Database and tables created successfully!');
    
    await connection.end();
  } catch (err) {
    console.error('Failed to init DB:', err);
    process.exit(1);
  }
}

initDB();
