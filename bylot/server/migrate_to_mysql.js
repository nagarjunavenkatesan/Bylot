/**
 * migrate_to_mysql.js  (run from: bylot/server/)
 * 
 *   node migrate_to_mysql.js
 *
 * Imports pg_export.json (one level up) into the MySQL database.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config(); // loads server/.env when run from server/

const connection = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// pg_export.json is one level up (in the bylot root)
const exportFile = path.join(__dirname, '..', 'pg_export.json');
const data = JSON.parse(fs.readFileSync(exportFile, 'utf8'));

function toMysqlDatetime(isoStr) {
    if (!isoStr) return null;
    return isoStr.slice(0, 19).replace('T', ' ');
}

function toMysqlDate(isoStr) {
    if (!isoStr) return null;
    return isoStr.slice(0, 10);
}

async function migrate() {
    try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

        // ── Users ──────────────────────────────────────────────────────────
        console.log(`\nMigrating ${data.users.length} users...`);
        for (const u of data.users) {
            await connection.execute(
                `INSERT INTO users (id, name, email, password, phone, google_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   name=VALUES(name), email=VALUES(email), password=VALUES(password),
                   phone=VALUES(phone), google_id=VALUES(google_id), created_at=VALUES(created_at)`,
                [u.id, u.name, u.email, u.password, u.phone, u.google_id, toMysqlDatetime(u.created_at)]
            );
        }
        console.log('  ✅ Users migrated.');
        const maxUserId = Math.max(...data.users.map(u => u.id));
        await connection.execute(`ALTER TABLE users AUTO_INCREMENT = ${maxUserId + 1}`);

        // ── Items ──────────────────────────────────────────────────────────
        console.log(`\nMigrating ${data.items.length} items...`);
        for (const item of data.items) {
            await connection.execute(
                `INSERT INTO items (id, name, description, price, original_price, expiry_date, category,
                                   location, location_link, latitude, longitude, image_url, seller_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   name=VALUES(name), description=VALUES(description), price=VALUES(price),
                   original_price=VALUES(original_price), expiry_date=VALUES(expiry_date),
                   category=VALUES(category), location=VALUES(location), location_link=VALUES(location_link),
                   latitude=VALUES(latitude), longitude=VALUES(longitude),
                   image_url=VALUES(image_url), seller_id=VALUES(seller_id), created_at=VALUES(created_at)`,
                [
                    item.id, item.name, item.description,
                    item.price, item.original_price,
                    toMysqlDate(item.expiry_date),
                    item.category, item.location, item.location_link,
                    item.latitude, item.longitude, item.image_url,
                    item.seller_id, toMysqlDatetime(item.created_at)
                ]
            );
        }
        console.log('  ✅ Items migrated.');
        const maxItemId = Math.max(...data.items.map(i => i.id));
        await connection.execute(`ALTER TABLE items AUTO_INCREMENT = ${maxItemId + 1}`);

        // ── Verification Codes ─────────────────────────────────────────────
        if (data.verification_codes.length > 0) {
            console.log(`\nMigrating ${data.verification_codes.length} verification codes...`);
            for (const vc of data.verification_codes) {
                await connection.execute(
                    `INSERT INTO verification_codes (id, phone, code, expires_at, created_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                       phone=VALUES(phone), code=VALUES(code),
                       expires_at=VALUES(expires_at), created_at=VALUES(created_at)`,
                    [vc.id, vc.phone, vc.code, toMysqlDatetime(vc.expires_at), toMysqlDatetime(vc.created_at)]
                );
            }
            console.log('  ✅ Verification codes migrated.');
            const maxVcId = Math.max(...data.verification_codes.map(v => v.id));
            await connection.execute(`ALTER TABLE verification_codes AUTO_INCREMENT = ${maxVcId + 1}`);
        }

        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('\n🎉 Migration complete! All data imported into MySQL.');

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        try { await connection.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
    } finally {
        await connection.end();
    }
}

migrate();
