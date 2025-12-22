
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server directory
dotenv.config({ path: path.resolve(__dirname, 'server/.env') });

const { Pool } = pg;

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
};

async function run() {
    const pool = new Pool(config);
    try {
        console.log('--- USERS ---');
        const users = await pool.query('SELECT id, name, email FROM users');
        console.table(users.rows);

        console.log('\n--- ITEMS ---');
        const items = await pool.query('SELECT id, name, seller_id FROM items');
        console.table(items.rows);
        
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
