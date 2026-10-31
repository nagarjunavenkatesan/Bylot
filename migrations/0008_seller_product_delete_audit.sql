-- Migration 0008: Seller Sold-Item Deletion & Audit Fields
-- Adds soft deletion metadata (deleted_at, deleted_by, deletion_reason) to products table.

-- 1. Conditionally add deleted_at column to products
SET @col_deleted_at = 0;
SELECT COUNT(*) INTO @col_deleted_at
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'deleted_at';

SET @stmt_deleted_at = IF(@col_deleted_at = 0, 'ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP NULL AFTER status', 'SELECT 1');
PREPARE s_deleted_at FROM @stmt_deleted_at;
EXECUTE s_deleted_at;
DEALLOCATE PREPARE s_deleted_at;

-- 2. Conditionally add deleted_by column to products
SET @col_deleted_by = 0;
SELECT COUNT(*) INTO @col_deleted_by
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'deleted_by';

SET @stmt_deleted_by = IF(@col_deleted_by = 0, 'ALTER TABLE products ADD COLUMN deleted_by BIGINT UNSIGNED NULL AFTER deleted_at', 'SELECT 1');
PREPARE s_deleted_by FROM @stmt_deleted_by;
EXECUTE s_deleted_by;
DEALLOCATE PREPARE s_deleted_by;

-- 3. Conditionally add deletion_reason column to products
SET @col_deletion_reason = 0;
SELECT COUNT(*) INTO @col_deletion_reason
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'deletion_reason';

SET @stmt_deletion_reason = IF(@col_deletion_reason = 0, 'ALTER TABLE products ADD COLUMN deletion_reason VARCHAR(255) NULL AFTER deleted_by', 'SELECT 1');
PREPARE s_deletion_reason FROM @stmt_deletion_reason;
EXECUTE s_deletion_reason;
DEALLOCATE PREPARE s_deletion_reason;

-- 4. Conditionally add foreign key fk_products_deleted_by
SET @fk_del = 0;
SELECT COUNT(*) INTO @fk_del
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND CONSTRAINT_NAME = 'fk_products_deleted_by';

SET @stmt_fk_del = IF(@fk_del = 0, 'ALTER TABLE products ADD CONSTRAINT fk_products_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE s_fk_del FROM @stmt_fk_del;
EXECUTE s_fk_del;
DEALLOCATE PREPARE s_fk_del;

-- 5. Conditionally add index for deleted products lookup (status, deleted_at)
SET @idx_del = 0;
SELECT COUNT(*) INTO @idx_del
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND INDEX_NAME = 'idx_products_status_deleted';

SET @stmt_idx_del = IF(@idx_del = 0, 'ALTER TABLE products ADD INDEX idx_products_status_deleted (status, deleted_at)', 'SELECT 1');
PREPARE s_idx_del FROM @stmt_idx_del;
EXECUTE s_idx_del;
DEALLOCATE PREPARE s_idx_del;
