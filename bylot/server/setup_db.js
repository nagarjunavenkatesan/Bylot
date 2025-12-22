import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'bylot/server/.env' });

const { Pool } = pg;

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres', // Connect to default DB first to check/create 'bylot'
};

async function setupDatabase() {
    let pool = new Pool(config);

    try {
        console.log('Connecting to PostgreSQL...');
        const client = await pool.connect();

        // 1. Create Database if not exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${process.env.DB_NAME}'`);
        if (res.rowCount === 0) {
            console.log(`Creating database '${process.env.DB_NAME}'...`);
            await client.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
        } else {
            console.log(`Database '${process.env.DB_NAME}' already exists.`);
        }
        client.release();
        await pool.end();

        // 2. Connect to the new database
        console.log(`Connecting to '${process.env.DB_NAME}'...`);
        pool = new Pool({ ...config, database: process.env.DB_NAME });
        const dbClient = await pool.connect();

        // 3. Create Tables
        console.log('Creating tables...');

        // Users Table
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255), -- Made nullable for Google Auth
                phone VARCHAR(20),
                google_id VARCHAR(255) UNIQUE, -- Added for Google Auth
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Ensure existing table supports Google Auth
        await dbClient.query('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');
        try {
            await dbClient.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE');
        } catch (e) {
            // IF NOT EXISTS might not be supported in older PG, catch error
            if (e.code !== '42701') console.log('Notice: google_id column might already exist');
        }

        // Items Table
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                original_price DECIMAL(10, 2),
                expiry_date DATE,
                category VARCHAR(50),
                location VARCHAR(255),
                location_link TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                image_url TEXT,
                seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Verification Codes Table
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) NOT NULL,
                code VARCHAR(10) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Tables created successfully.');
        dbClient.release();
    } catch (err) {
        console.error('Error setting up database:', err);
    } finally {
        await pool.end();
    }
}

setupDatabase();
