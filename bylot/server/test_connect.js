import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'bylot/server/.env' });

const { Client } = pg;
const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres'
});

console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT} as ${process.env.DB_USER}...`);

client.connect()
    .then(() => {
        console.log('Connected successfully!');
        client.end();
    })
    .catch(e => {
        console.error('Connection error:', e.message);
        process.exit(1);
    });
