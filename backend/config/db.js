const mysql = require("mysql2/promise");
const env = require("./env");

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  decimalNumbers: true,
  timezone: "Z"
});

async function pingDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    // Auto-verify schema columns & tables to prevent database runtime errors
    try {
      const [cols] = await connection.query("SHOW COLUMNS FROM products LIKE 'product_item_id'");
      if (!cols || cols.length === 0) {
        await connection.query("ALTER TABLE products ADD COLUMN product_item_id VARCHAR(20) NULL UNIQUE AFTER id");
      }
    } catch (e) {
      console.warn("Notice checking product_item_id column:", e.message);
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS product_reports (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          product_id BIGINT UNSIGNED NOT NULL,
          reporter_id BIGINT UNSIGNED NOT NULL,
          reason ENUM('fake_product', 'wrong_expiry', 'misleading_price', 'poor_quality', 'already_expired', 'other') NOT NULL,
          description TEXT NULL,
          status ENUM('pending', 'reviewed', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
          admin_note TEXT NULL,
          resolved_by BIGINT UNSIGNED NULL,
          resolved_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_reports_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE KEY uk_one_report_per_user (product_id, reporter_id),
          INDEX idx_reports_status (status),
          INDEX idx_reports_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (e) {
      console.warn("Notice checking product_reports table:", e.message);
    }
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  pingDatabase
};

