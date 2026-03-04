import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: './bylot/server/.env' }); // Adjusted for running from root
// Fallback if running from server dir
if (!process.env.DB_HOST) {
    dotenv.config();
}

const pool = mysql.createPool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

/**
 * Execute a query.
 * Returns an object with a `rows` property so the rest of the app
 * doesn't need to change (it was written for node-postgres).
 */
export const query = async (text, params) => {
    const [rows] = await pool.execute(text, params);
    // For INSERT/UPDATE/DELETE mysql2 returns an OkPacket, not an array of rows.
    if (Array.isArray(rows)) {
        return { rows, rowCount: rows.length };
    }
    // OkPacket: { affectedRows, insertId, ... }
    return { rows: [], rowCount: rows.affectedRows, insertId: rows.insertId };
};

export const initDb = async () => {
    try {
        const [rows] = await pool.execute('SELECT NOW() as now');
        console.log(`[DATABASE] Connected to ${process.env.DB_NAME} at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    } catch (err) {
        console.error('[DATABASE] Connection error:', err);
        return;
    }

    // Self-Healing Migration: Add google_id if missing
    try {
        await pool.execute(`
            ALTER TABLE users 
            ADD COLUMN google_id VARCHAR(255) UNIQUE
        `);
        console.log('[DATABASE] Schema updated: google_id column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('[DATABASE] Verified schema: google_id column exists.');
        } else {
            console.error('[DATABASE] Schema Check Error:', e.message);
        }
    }

    // Self-Healing Migration: Make password nullable for Google Auth
    try {
        await pool.execute(`
            ALTER TABLE users 
            MODIFY COLUMN password VARCHAR(255) NULL
        `);
        console.log('[DATABASE] Verified schema: password column is nullable.');
    } catch (e) {
        console.error('[DATABASE] Schema Error (password nullable):', e.message);
    }
};
