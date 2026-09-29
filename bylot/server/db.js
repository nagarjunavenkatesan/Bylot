import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '4014',
    database: process.env.DB_NAME || 'bylot_db',
};

const pool = mysql.createPool({
    ...DB_CONFIG,
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

async function ensureDatabaseReady() {
    const bootstrap = await mysql.createConnection({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
    });

    await bootstrap.execute(
        `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await bootstrap.query(`USE \`${DB_CONFIG.database}\``);

    await bootstrap.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            name       VARCHAR(100)  NOT NULL,
            email      VARCHAR(100)  UNIQUE NOT NULL,
            password   VARCHAR(255)  NULL,
            phone      VARCHAR(20)   NULL,
            google_id  VARCHAR(255)  UNIQUE NULL,
            role       VARCHAR(50)   DEFAULT 'user',
            status     VARCHAR(50)   DEFAULT 'active',
            created_at DATETIME      DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await bootstrap.execute(`
        CREATE TABLE IF NOT EXISTS items (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            name           VARCHAR(255)   NOT NULL,
            description    TEXT           NULL,
            price          DECIMAL(10, 2) NOT NULL DEFAULT 0,
            original_price DECIMAL(10, 2) NULL,
            expiry_date    DATE           NULL,
            category       VARCHAR(50)    NULL,
            location       VARCHAR(255)   NULL,
            district       VARCHAR(100)   NULL,
            location_link  TEXT           NULL,
            latitude       DECIMAL(10, 8) NULL,
            longitude      DECIMAL(11, 8) NULL,
            image_url      TEXT           NULL,
            status         VARCHAR(50)    DEFAULT 'active',
            seller_id      INT            NULL,
            created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await bootstrap.execute(`
        CREATE TABLE IF NOT EXISTS verification_codes (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            phone      VARCHAR(20)  NOT NULL,
            code       VARCHAR(10)  NOT NULL,
            expires_at DATETIME     NOT NULL,
            created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await bootstrap.end();
}

export const initDb = async () => {
    try {
        await ensureDatabaseReady();
        const [rows] = await pool.execute('SELECT NOW() as now');
        console.log(`[DATABASE] Connected to ${DB_CONFIG.database} at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
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

    // Self-Healing Migration: Add role column
    try {
        await pool.execute(`
            ALTER TABLE users 
            ADD COLUMN role VARCHAR(50) DEFAULT 'user'
        `);
        console.log('[DATABASE] Schema updated: role column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('[DATABASE] Verified schema: role column exists.');
        } else {
            console.error('[DATABASE] Schema Check Error (role):', e.message);
        }
    }

    // Self-Healing Migration: Add user status column
    try {
        await pool.execute(`
            ALTER TABLE users 
            ADD COLUMN status VARCHAR(50) DEFAULT 'active'
        `);
        console.log('[DATABASE] Schema updated: user status column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('[DATABASE] Verified schema: user status column exists.');
        } else {
            console.error('[DATABASE] Schema Check Error (user status):', e.message);
        }
    }

    // Self-Healing Migration: Add item status column
    try {
        await pool.execute(`
            ALTER TABLE items 
            ADD COLUMN status VARCHAR(50) DEFAULT 'active'
        `);
        console.log('[DATABASE] Schema updated: item status column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('[DATABASE] Verified schema: item status column exists.');
        } else {
            console.error('[DATABASE] Schema Check Error (item status):', e.message);
        }
    }

    // Self-Healing Migration: Add district column on items
    try {
        await pool.execute(`
            ALTER TABLE items
            ADD COLUMN district VARCHAR(100) NULL
        `);
        console.log('[DATABASE] Schema updated: district column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('[DATABASE] Verified schema: district column exists.');
        } else {
            console.error('[DATABASE] Schema Check Error (district):', e.message);
        }
    }

    // Orders table for district-wise buy tracking
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS orders (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                item_id    INT NOT NULL,
                buyer_id   INT NOT NULL,
                seller_id  INT NULL,
                district   VARCHAR(100) NULL,
                amount     DECIMAL(10, 2) NOT NULL DEFAULT 0,
                status     VARCHAR(50) DEFAULT 'completed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[DATABASE] Verified schema: orders table exists.');
    } catch (e) {
        console.error('[DATABASE] Schema Error (orders):', e.message);
    }

    // Product reports used by the admin moderation panel
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS product_reports (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                product_id   INT NOT NULL,
                reporter_id  INT NOT NULL,
                reason       VARCHAR(50)  NOT NULL,
                description  TEXT         NULL,
                status       VARCHAR(50)  DEFAULT 'pending',
                admin_note   TEXT         NULL,
                resolved_by  INT          NULL,
                resolved_at  DATETIME     NULL,
                created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE KEY uk_one_report_per_user (product_id, reporter_id),
                INDEX idx_reports_status (status),
                INDEX idx_reports_product (product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[DATABASE] Verified schema: product_reports table exists.');
    } catch (e) {
        console.error('[DATABASE] Schema Error (product_reports):', e.message);
    }

    // Backfill missing districts from location text
    try {
        const missingDistricts = await pool.execute(
            "SELECT id, location, district FROM items WHERE district IS NULL OR TRIM(district) = ''"
        );
        const { extractDistrict } = await import('./districtUtils.js');
        for (const item of missingDistricts[0]) {
            const district = extractDistrict(item.location, item.district);
            await pool.execute('UPDATE items SET district = ? WHERE id = ?', [district, item.id]);
        }
        if (missingDistricts[0].length) {
            console.log(`[DATABASE] Backfilled district for ${missingDistricts[0].length} item(s).`);
        }
    } catch (e) {
        console.error('[DATABASE] District backfill error:', e.message);
    }

    // Admin Account Automation
    try {
        const adminAccounts = [
            {
                email: 'nagarjunavenkatesan@gmail.com',
                name: process.env.ADMIN_NAME || 'Nagarjun Admin',
                password: process.env.ADMIN_PASSWORD || '@bvnd4014BV',
            },
            ...(process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL !== 'nagarjunavenkatesan@gmail.com'
                ? [{
                    email: process.env.ADMIN_EMAIL,
                    name: process.env.ADMIN_NAME || 'Bylot Admin',
                    password: process.env.ADMIN_PASSWORD || '@bvnd4014BV',
                }]
                : []),
        ];

        for (const admin of adminAccounts) {
            const hashedPassword = await bcrypt.hash(admin.password, 10);
            const existingAdmin = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [admin.email]);

            if (existingAdmin[0].length) {
                await pool.execute(
                    "UPDATE users SET name = ?, password = ?, role = 'admin', status = 'active' WHERE email = ?",
                    [admin.name, hashedPassword, admin.email]
                );
            } else {
                await pool.execute(
                    "INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'admin', 'active')",
                    [admin.name, admin.email, hashedPassword]
                );
            }

            console.log(`[DATABASE] Admin account ready: ${admin.email}`);
        }
    } catch (e) {
        console.error('[DATABASE] Auto-admin Error:', e.message);
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
