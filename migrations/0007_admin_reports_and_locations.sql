-- Migration 0007: Admin Reports & Archives System + India States & Union Territories
-- Adds location hierarchy to products and creates secure admin report archives table.

-- 1. Conditionally add country column to products
SET @col_country = 0;
SELECT COUNT(*) INTO @col_country
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'country';

SET @stmt_country = IF(@col_country = 0, 'ALTER TABLE products ADD COLUMN country VARCHAR(80) NOT NULL DEFAULT \'India\'', 'SELECT 1');
PREPARE s_country FROM @stmt_country;
EXECUTE s_country;
DEALLOCATE PREPARE s_country;

-- 2. Conditionally add state column to products
SET @col_state = 0;
SELECT COUNT(*) INTO @col_state
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'state';

SET @stmt_state = IF(@col_state = 0, 'ALTER TABLE products ADD COLUMN state VARCHAR(100) NULL AFTER country', 'SELECT 1');
PREPARE s_state FROM @stmt_state;
EXECUTE s_state;
DEALLOCATE PREPARE s_state;

-- 3. Conditionally add district column to products
SET @col_district = 0;
SELECT COUNT(*) INTO @col_district
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'district';

SET @stmt_district = IF(@col_district = 0, 'ALTER TABLE products ADD COLUMN district VARCHAR(100) NULL AFTER state', 'SELECT 1');
PREPARE s_district FROM @stmt_district;
EXECUTE s_district;
DEALLOCATE PREPARE s_district;

-- 4. Conditionally add city column to products
SET @col_city = 0;
SELECT COUNT(*) INTO @col_city
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'city';

SET @stmt_city = IF(@col_city = 0, 'ALTER TABLE products ADD COLUMN city VARCHAR(100) NULL AFTER district', 'SELECT 1');
PREPARE s_city FROM @stmt_city;
EXECUTE s_city;
DEALLOCATE PREPARE s_city;

-- 5. Conditionally add locality column to products
SET @col_locality = 0;
SELECT COUNT(*) INTO @col_locality
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'locality';

SET @stmt_locality = IF(@col_locality = 0, 'ALTER TABLE products ADD COLUMN locality VARCHAR(190) NULL AFTER city', 'SELECT 1');
PREPARE s_locality FROM @stmt_locality;
EXECUTE s_locality;
DEALLOCATE PREPARE s_locality;

-- 6. Add index for location lookups if not present
SET @idx_loc = 0;
SELECT COUNT(*) INTO @idx_loc
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND INDEX_NAME = 'idx_products_location';

SET @stmt_idx = IF(@idx_loc = 0, 'ALTER TABLE products ADD INDEX idx_products_location (state, district)', 'SELECT 1');
PREPARE s_idx FROM @stmt_idx;
EXECUTE s_idx;
DEALLOCATE PREPARE s_idx;

-- 7. Create admin_report_archives table for secure evidence archives
CREATE TABLE IF NOT EXISTS admin_report_archives (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id VARCHAR(120) NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_days INT UNSIGNED NOT NULL DEFAULT 30,
  status ENUM('PENDING', 'GENERATING', 'READY', 'FAILED', 'DELETED') NOT NULL DEFAULT 'PENDING',
  file_path VARCHAR(255) NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64) NULL,
  plaintext_sha256 VARCHAR(64) NULL,
  ciphertext_sha256 VARCHAR(64) NULL,
  encryption_algorithm VARCHAR(40) NOT NULL DEFAULT 'AES-256-GCM',
  encryption_iv VARCHAR(64) NULL,
  encryption_tag VARCHAR(64) NULL,
  encrypted_dek TEXT NULL,
  manifest_summary JSON NULL,
  error_message VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reports_status (status),
  INDEX idx_reports_created (created_at),
  INDEX idx_reports_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Create canonical India States & Union Territories reference table
CREATE TABLE IF NOT EXISTS india_states_reference (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('state', 'union_territory') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Seed canonical 28 States and 8 Union Territories
INSERT IGNORE INTO india_states_reference (code, name, type) VALUES
  ('AP', 'Andhra Pradesh', 'state'),
  ('AR', 'Arunachal Pradesh', 'state'),
  ('AS', 'Assam', 'state'),
  ('BR', 'Bihar', 'state'),
  ('CG', 'Chhattisgarh', 'state'),
  ('GA', 'Goa', 'state'),
  ('GJ', 'Gujarat', 'state'),
  ('HR', 'Haryana', 'state'),
  ('HP', 'Himachal Pradesh', 'state'),
  ('JH', 'Jharkhand', 'state'),
  ('KA', 'Karnataka', 'state'),
  ('KL', 'Kerala', 'state'),
  ('MP', 'Madhya Pradesh', 'state'),
  ('MH', 'Maharashtra', 'state'),
  ('MN', 'Manipur', 'state'),
  ('ML', 'Meghalaya', 'state'),
  ('MZ', 'Mizoram', 'state'),
  ('NL', 'Nagaland', 'state'),
  ('OD', 'Odisha', 'state'),
  ('PB', 'Punjab', 'state'),
  ('RJ', 'Rajasthan', 'state'),
  ('SK', 'Sikkim', 'state'),
  ('TN', 'Tamil Nadu', 'state'),
  ('TS', 'Telangana', 'state'),
  ('TR', 'Tripura', 'state'),
  ('UP', 'Uttar Pradesh', 'state'),
  ('UK', 'Uttarakhand', 'state'),
  ('WB', 'West Bengal', 'state'),
  ('AN', 'Andaman and Nicobar Islands', 'union_territory'),
  ('CH', 'Chandigarh', 'union_territory'),
  ('DN', 'Dadra and Nagar Haveli and Daman and Diu', 'union_territory'),
  ('DL', 'Delhi', 'union_territory'),
  ('JK', 'Jammu and Kashmir', 'union_territory'),
  ('LA', 'Ladakh', 'union_territory'),
  ('LD', 'Lakshadweep', 'union_territory'),
  ('PY', 'Puducherry', 'union_territory');
