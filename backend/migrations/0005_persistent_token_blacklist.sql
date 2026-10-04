-- Migration 0005: Persistent token blacklist for cross-restart revocation
-- Safe to re-run on existing databases

CREATE TABLE IF NOT EXISTS token_blacklist (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  token_jti VARCHAR(64) NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tb_hash (token_hash),
  INDEX idx_tb_jti (token_jti),
  INDEX idx_tb_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
