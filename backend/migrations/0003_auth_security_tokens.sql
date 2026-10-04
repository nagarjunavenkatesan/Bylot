-- Migration 0003: Auth security enhancements
-- 1. Safe email normalization on users table
-- 2. Add token_version and email verification columns to users
-- 3. Create refresh_tokens table for multi-device support, rotation, and reuse detection

-- Normalize existing emails to lowercase and trimmed
UPDATE users SET email = LOWER(TRIM(email));
UPDATE sellers SET contact_email = LOWER(TRIM(contact_email)) WHERE contact_email IS NOT NULL;

-- Ensure all existing users are marked as verified so no one is locked out after upgrade
UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL;

-- Add token_version to users if not present
SET @col1 = 0;
SELECT COUNT(*) INTO @col1
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'token_version';

SET @stmt1 = IF(@col1 = 0, 'ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER role', 'SELECT 1');
PREPARE s1 FROM @stmt1;
EXECUTE s1;
DEALLOCATE PREPARE s1;

-- Add email verification columns to users if not present
SET @col2 = 0;
SELECT COUNT(*) INTO @col2
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'email_verification_token_hash';

SET @stmt2 = IF(@col2 = 0, 'ALTER TABLE users ADD COLUMN email_verification_token_hash VARCHAR(64) NULL AFTER email_verified_at', 'SELECT 1');
PREPARE s2 FROM @stmt2;
EXECUTE s2;
DEALLOCATE PREPARE s2;

SET @col3 = 0;
SELECT COUNT(*) INTO @col3
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'email_verification_expires_at';

SET @stmt3 = IF(@col3 = 0, 'ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP NULL AFTER email_verification_token_hash', 'SELECT 1');
PREPARE s3 FROM @stmt3;
EXECUTE s3;
DEALLOCATE PREPARE s3;

-- Create refresh_tokens table for multi-device support, rotation, and token families
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  jti VARCHAR(64) NOT NULL UNIQUE,
  token_hash VARCHAR(64) NOT NULL,
  family_id VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_jti (jti),
  INDEX idx_refresh_family (family_id),
  INDEX idx_refresh_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
