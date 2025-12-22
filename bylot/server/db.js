import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './bylot/server/.env' }); // Adjusted for running from root
// Fallback if running from server dir
if (!process.env.DB_USER) {
    dotenv.config(); 
}

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

export const query = (text, params) => pool.query(text, params);

export const initDb = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(`[DATABASE] Connected to ${process.env.DB_NAME} at ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    } catch (err) {
        console.error('[DATABASE] Connection error:', err);
    }
    
    // Self-Healing Migration: Add google_id if missing
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE');
        console.log('[DATABASE] Verified schema: google_id column exists.');
    } catch (e) {
        // Fallback for older Postgres versions that don't support IF NOT EXISTS
        if (e.code === '42701') { 
             console.log('[DATABASE] Verified schema: google_id column exists (already present).');
        } else if (e.code === '42601') { // Syntax error in older PG for IF NOT EXISTS?
             try {
                 await pool.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE');
                 console.log('[DATABASE] Schema updated: google_id column added.');
             } catch (e2) {
                 if (e2.code === '42701') console.log('[DATABASE] Verified schema: google_id column exists.');
                 else console.error('[DATABASE] Schema Error:', e2.message);
             }
        } else {
            console.error('[DATABASE] Schema Check Error:', e.message);
        }
    }

    // Self-Healing Migration: Make password nullable for Google Auth
    try {
        await pool.query('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');
        console.log('[DATABASE] Verified schema: password column is nullable.');
    } catch (e) {
        console.error('[DATABASE] Schema Error (password nullable):', e.message);
    }
};
