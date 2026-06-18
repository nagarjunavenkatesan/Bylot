import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from server dir regardless of cwd
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.DB_HOST) {
    dotenv.config({ path: path.join(__dirname, '..', 'bylot', 'server', '.env') });
}

async function setupDatabase() {
    // Step 1: Connect without specifying a database so we can create it if needed
    let connection;
    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection({
            host:     process.env.DB_HOST || 'localhost',
            port:     process.env.DB_PORT || 3306,
            user:     process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });

        // 1. Create database if not exists
        await connection.execute(
            `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        console.log(`Database '${process.env.DB_NAME}' ready.`);
        await connection.end();

        // 2. Connect to the target database
        connection = await mysql.createConnection({
            host:     process.env.DB_HOST || 'localhost',
            port:     process.env.DB_PORT || 3306,
            user:     process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        // 3. Create tables
        console.log('Creating tables...');

        // Users Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                name       VARCHAR(100)  NOT NULL,
                email      VARCHAR(100)  UNIQUE NOT NULL,
                password   VARCHAR(255)  NULL,
                phone      VARCHAR(20)   NULL,
                google_id  VARCHAR(255)  UNIQUE NULL,
                created_at DATETIME      DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Items Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS items (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                name           VARCHAR(255)   NOT NULL,
                description    TEXT           NULL,
                price          DECIMAL(10, 2) NOT NULL,
                original_price DECIMAL(10, 2) NULL,
                expiry_date    DATE           NULL,
                category       VARCHAR(50)    NULL,
                location       VARCHAR(255)   NULL,
                location_link  TEXT           NULL,
                latitude       DECIMAL(10, 8) NULL,
                longitude      DECIMAL(11, 8) NULL,
                image_url      TEXT           NULL,
                seller_id      INT            NULL,
                created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Verification Codes Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                phone      VARCHAR(20)  NOT NULL,
                code       VARCHAR(10)  NOT NULL,
                expires_at DATETIME     NOT NULL,
                created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✅ Tables created successfully.');
    } catch (err) {
        console.error('❌ Error setting up database:', err.message);
    } finally {
        if (connection) await connection.end();
    }
}

setupDatabase();
