-- Migration 0001: Remove payment feature completely
-- ATTENTION OPERATOR: Take a complete database backup before applying this migration!
-- (e.g., mysqldump -u <user> -p <db_name> > backup_before_0001.sql)
-- Safe to re-run on existing databases

-- Drop payments table if it exists
DROP TABLE IF EXISTS payments;

-- Drop payment-related columns from orders table if they exist
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME = 'payment_status';

SET @stmt = IF(@col_exists > 0, 'ALTER TABLE orders DROP COLUMN payment_status', 'SELECT 1');
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop payment_method if present
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME = 'payment_method';

SET @stmt = IF(@col_exists > 0, 'ALTER TABLE orders DROP COLUMN payment_method', 'SELECT 1');
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop payment_id if present
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME = 'payment_id';

SET @stmt = IF(@col_exists > 0, 'ALTER TABLE orders DROP COLUMN payment_id', 'SELECT 1');
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
