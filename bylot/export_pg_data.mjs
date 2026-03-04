import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from server dir
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

async function exportData() {
    try {
        console.log('Connecting to PostgreSQL...');
        console.log(`Host: ${process.env.DB_HOST}, DB: ${process.env.DB_NAME}, User: ${process.env.DB_USER}`);

        const [users, items, vcodes] = await Promise.all([
            pool.query('SELECT * FROM users'),
            pool.query('SELECT * FROM items'),
            pool.query('SELECT * FROM verification_codes'),
        ]);

        const data = {
            users: users.rows,
            items: items.rows,
            verification_codes: vcodes.rows,
        };

        const outPath = path.join(__dirname, 'pg_export.json');
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

        console.log('✅ Export successful!');
        console.log(`   Users:              ${data.users.length}`);
        console.log(`   Items:              ${data.items.length}`);
        console.log(`   Verification codes: ${data.verification_codes.length}`);
        console.log(`   Saved to: ${outPath}`);
    } catch (err) {
        console.error('❌ Export failed:', err.message);
    } finally {
        await pool.end();
    }
}

exportData();
