import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME || 'postgres'
});

async function checkVersion() {
    try {
        await client.connect();
        const res = await client.query('SELECT version();');
        console.log(res.rows[0].version);
        await client.end();
    } catch (err) {
        console.error('Error connecting or querying:', err.message);
        process.exit(1);
    }
}

checkVersion();
