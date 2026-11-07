# BYLOT — DATABASE AUDIT & SCHEMA INTEGRITY

**RDBMS:** MySQL 8.0  
**Host / Port:** `127.0.0.1:3306` (isolated inside Docker network in production)  
**Database Name:** `bylot`  
**Driver:** `mysql2/promise` (Node.js connection pool)  

---

## 1. DATABASE SCHEMA & TABLE INVENTORY

The Bylot database contains 13 relational tables governed by foreign keys and unique constraints:

| Table Name | Primary Key | Key Foreign Keys | Indices / Unique Constraints | Purpose |
|---|---|---|---|---|
| `users` | `id` (INT) | None | `UNIQUE(email)`, `idx_users_role` | User accounts (buyers, sellers, admins) |
| `sellers` | `id` (INT) | `user_id -> users(id)` | `UNIQUE(user_id)`, `idx_sellers_status` | Seller business profiles and KYC |
| `products` | `id` (INT) | `seller_id -> sellers(id)` | `idx_products_expiry`, `idx_products_cat` | Product catalog and inventory |
| `categories` | `id` (INT) | None | `UNIQUE(slug)` | Product categories |
| `orders` | `id` (INT) | `buyer_id -> users(id)` | `idx_orders_status`, `idx_orders_created` | Customer orders |
| `order_items` | `id` (INT) | `order_id`, `product_id` | Foreign keys with `ON DELETE RESTRICT` | Order item line entries |
| `admin_2fa` | `id` (INT) | `admin_user_id -> users(id)`| `UNIQUE(admin_user_id)` | Encrypted TOTP secrets & 2FA state |
| `admin_recovery_codes`| `id` (INT) | `admin_user_id -> users(id)`| `idx_recovery_user` | Hashed single-use recovery codes |
| `report_archives` | `id` (INT) | `generated_by -> users(id)` | `UNIQUE(archive_id)` | Encrypted archive metadata |
| `seller_delete_audits`| `id` (INT) | `seller_id`, `product_id` | `idx_delete_audit_seller` | Soft delete compliance logs |
| `schema_migrations` | `id` (INT) | None | `UNIQUE(migration_name)` | Migration ledger |
| `locations` | `id` (INT) | None | `idx_locations_state` | Indian states & districts reference |

---

## 2. MIGRATION LEDGER & EXECUTION STATUS

Database migrations are located in `migrations/` and managed via `backend/scripts/migrate.js`:

| Migration File | Description | Execution Status |
|---|---|---|
| `0001_core_schema.sql` | Base users, sellers, products, orders | **EXECUTED** |
| `0002_admin_2fa.sql` | Admin two-factor authentication tables | **EXECUTED** |
| `0003_report_archives.sql` | Encrypted archive management tables | **EXECUTED** |
| `0004_performance_indexes.sql`| B-tree indices on expiry, category, status | **EXECUTED** |
| `0005_audit_logs.sql` | Structured audit logging tables | **EXECUTED** |
| `0006_district_locations.sql` | Indian districts and geographic coordinates | **EXECUTED** |
| `0007_seller_ratings.sql` | Seller rating aggregations | **EXECUTED** |
| `0008_seller_product_delete_audit.sql` | Soft delete compliance logging | **EXECUTED** |

---

## 3. PERFORMANCE & CONNECTION POOLING

- **Connection Pool Configuration (`backend/config/db.js`):**
  - `connectionLimit: 15` (prevents connection exhaustion on MySQL server)
  - `waitForConnections: true`
  - `queueLimit: 0` (unbounded queue with timeout handling)
  - `connectTimeout: 10000ms`
- **Zero Raw Query Interpolation:** All queries use prepared statements.
- **Transaction Safety:** Order placement and seller approval utilize ACID transactions (`connection.beginTransaction()`, `connection.commit()`, `connection.rollback()`).
