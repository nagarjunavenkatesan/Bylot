import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
    console.log('--- MySQL Connection Test ---');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`Database: ${process.env.DB_NAME}`);

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('✅ Success! Connected to MySQL database.');
        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('Test Query Result:', rows[0].result);

        await connection.end();
    } catch (err) {
        console.error('❌ Failed to connect to MySQL:', err.message);
        console.log('\nTroubleshooting tips:');
        console.log('1. Make sure XAMPP/MySQL Server is running.');
        console.log('2. Check if the password in .env matches your MySQL password.');
        console.log('3. Run "node setup_db.js" first to create the database.');
    }
}

testConnection();
