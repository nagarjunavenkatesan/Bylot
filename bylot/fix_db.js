
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        console.log('Attempting to add google_id column...');
        try {
            await pool.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE');
            console.log('SUCCESS: google_id column added.');
        } catch (e) {
            console.log('Error (might be harmless if exists):', e.message);
        }
    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await pool.end();
    }
}

run();
