-- Migration: 0004_performance_indexes.sql
-- Description: Composite and FULLTEXT indexes for high-performance product listings, search, and soft delete
-- Safe to re-run on existing databases

-- 1. Ensure status enum includes 'deleted' for soft deletion
ALTER TABLE products MODIFY COLUMN status ENUM('draft', 'active', 'inactive', 'out_of_stock', 'blocked', 'deleted') NOT NULL DEFAULT 'active';

-- 2. Composite indexes for product listings and sorts
SET @idx1 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_status_created');
SET @s1 = IF(@idx1 = 0, 'CREATE INDEX idx_products_status_created ON products (status, created_at)', 'SELECT 1');
PREPARE stmt1 FROM @s1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @idx2 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_status_discount');
SET @s2 = IF(@idx2 = 0, 'CREATE INDEX idx_products_status_discount ON products (status, discount_percent)', 'SELECT 1');
PREPARE stmt2 FROM @s2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @idx3 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_status_price');
SET @s3 = IF(@idx3 = 0, 'CREATE INDEX idx_products_status_price ON products (status, selling_price)', 'SELECT 1');
PREPARE stmt3 FROM @s3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SET @idx4 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_status_expiry');
SET @s4 = IF(@idx4 = 0, 'CREATE INDEX idx_products_status_expiry ON products (status, expiry_date)', 'SELECT 1');
PREPARE stmt4 FROM @s4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

SET @idx5 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_cat_status_created');
SET @s5 = IF(@idx5 = 0, 'CREATE INDEX idx_products_cat_status_created ON products (category_id, status, created_at)', 'SELECT 1');
PREPARE stmt5 FROM @s5; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

SET @idx6 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_seller_status');
SET @s6 = IF(@idx6 = 0, 'CREATE INDEX idx_products_seller_status ON products (seller_id, status)', 'SELECT 1');
PREPARE stmt6 FROM @s6; EXECUTE stmt6; DEALLOCATE PREPARE stmt6;

SET @idx7 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sellers' AND INDEX_NAME = 'idx_sellers_appr_stat');
SET @s7 = IF(@idx7 = 0, 'CREATE INDEX idx_sellers_appr_stat ON sellers (approval_status, status)', 'SELECT 1');
PREPARE stmt7 FROM @s7; EXECUTE stmt7; DEALLOCATE PREPARE stmt7;

SET @idx8 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sellers' AND INDEX_NAME = 'idx_sellers_coords');
SET @s8 = IF(@idx8 = 0, 'CREATE INDEX idx_sellers_coords ON sellers (latitude, longitude)', 'SELECT 1');
PREPARE stmt8 FROM @s8; EXECUTE stmt8; DEALLOCATE PREPARE stmt8;

SET @idx9 = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_ft');
SET @s9 = IF(@idx9 = 0, 'CREATE FULLTEXT INDEX idx_products_ft ON products (name, brand, description)', 'SELECT 1');
PREPARE stmt9 FROM @s9; EXECUTE stmt9; DEALLOCATE PREPARE stmt9;
