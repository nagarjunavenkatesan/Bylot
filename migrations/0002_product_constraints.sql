-- Migration 0002: Add check constraints on products (selling_price >= 0, stock_quantity >= 0, mrp >= 0)
-- Safe to re-run on existing MySQL databases

-- Clean up any invalid legacy data first to prevent constraint violations
UPDATE products SET selling_price = 0 WHERE selling_price < 0;
UPDATE products SET stock_quantity = 0 WHERE stock_quantity < 0;
UPDATE products SET mrp = selling_price WHERE mrp < 0;

-- Drop existing constraints if they already exist
SET @chk1 = 0;
SELECT COUNT(*) INTO @chk1
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND CONSTRAINT_NAME = 'chk_products_selling_price';

SET @stmt1 = IF(@chk1 > 0, 'ALTER TABLE products DROP CHECK chk_products_selling_price', 'SELECT 1');
PREPARE s1 FROM @stmt1;
EXECUTE s1;
DEALLOCATE PREPARE s1;

SET @chk2 = 0;
SELECT COUNT(*) INTO @chk2
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND CONSTRAINT_NAME = 'chk_products_stock_quantity';

SET @stmt2 = IF(@chk2 > 0, 'ALTER TABLE products DROP CHECK chk_products_stock_quantity', 'SELECT 1');
PREPARE s2 FROM @stmt2;
EXECUTE s2;
DEALLOCATE PREPARE s2;

SET @chk3 = 0;
SELECT COUNT(*) INTO @chk3
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'products'
  AND CONSTRAINT_NAME = 'chk_products_mrp';

SET @stmt3 = IF(@chk3 > 0, 'ALTER TABLE products DROP CHECK chk_products_mrp', 'SELECT 1');
PREPARE s3 FROM @stmt3;
EXECUTE s3;
DEALLOCATE PREPARE s3;

-- Add check constraints
ALTER TABLE products ADD CONSTRAINT chk_products_selling_price CHECK (selling_price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_stock_quantity CHECK (stock_quantity >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_mrp CHECK (mrp >= 0);
