
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
        console.log('Running Migration: Altering users table...');
        
        // 1. Make password nullable
        await pool.query('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');
        console.log('SUCCESS: password column is now nullable.');

        // 2. Add google_id column (if not exists - idempotent check)
        // PostgreSQL doesn't have "ADD COLUMN IF NOT EXISTS" in older versions, but let's try safely.
        // Or just catch error if it exists.
        try {
            await pool.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE');
            console.log('SUCCESS: google_id column added.');
        } catch (e) {
            if (e.code === '42701') { // duplicate_column
                 console.log('INFO: google_id column already exists.');
            } else {
                throw e;
            }
        }

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await pool.end();
    }
}

run();
