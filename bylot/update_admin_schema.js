
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });

const { Pool } = pg;

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
};

async function addAdminColumn() {
    const pool = new Pool(config);
    try {
        const client = await pool.connect();
        console.log('Connected to database...');

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        `);
        
        console.log('Added is_admin column to users table.');

        // Make user ID 3 admin for testing (as per create_admin_item.js hint)
        // Or make the user with email 'admin@bylot.com' admin?
        // Let's make the FIRST user admin for simplicity or a specific one?
        // Let's just create the column for now.
        
        client.release();
    } catch (err) {
        console.error('Error adding admin column:', err);
    } finally {
        await pool.end();
    }
}

addAdminColumn();
