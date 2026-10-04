# Bylot Database Migration Guide

This document describes how to execute, verify, and rollback database migrations in the Bylot marketplace.

---

## 1. Safety and Backup (MANDATORY BEFORE MIGRATING)

Always take a complete logical backup of your MySQL database prior to running any migration:

```bash
# Backup existing database
mysqldump -h localhost -u bylot_user -p --single-transaction --routines --triggers bylot > backup_before_migration_$(date +%F_%T).sql
```

Store this backup off-server or in secure object storage.

---

## 2. Running Migrations

Bylot includes a safe, trackable migration engine (`backend/scripts/migrate.js`) that records applied migrations in the `schema_migrations` table.

### A. Dry Run (Inspect pending migrations without modifying data)
```bash
npm run migrate -- --dry-run
```

### B. Apply Pending Migrations
```bash
npm run migrate
```

### C. Running against a custom database (e.g., staging or test DB)
```bash
node backend/scripts/migrate.js --db bylot_test
```

---

## 3. Migration Catalog

| Migration File | Description | Rollback Note |
|---|---|---|
| `0001_remove_payments.sql` | Completely drops legacy `payments` table and `payment_*` columns from `orders`. | Irreversible; restore from backup if needed. |
| `0002_product_constraints.sql` | Adds CHECK constraints on `selling_price >= 0`, `stock_quantity >= 0`, and `mrp >= 0`. Pre-cleans violating legacy rows. | Drop check constraints via `ALTER TABLE products DROP CHECK ...` |
| `0003_auth_security_tokens.sql` | Adds `token_version`, email verification columns, and creates multi-device `refresh_tokens` table. Automatically marks existing users verified. | Drop `refresh_tokens` table and drop added columns. |
| `0004_performance_indexes.sql` | Adds composite indexes and FULLTEXT search index `idx_products_ft` on `(name, brand, description)` and ensures status supports `deleted`. | Drop indexes via `ALTER TABLE ... DROP INDEX ...` |
| `0005_persistent_token_blacklist.sql` | Creates persistent `token_blacklist` table for cross-restart token revocation. | `DROP TABLE IF EXISTS token_blacklist` |

---

## 4. Rollback Procedure

If a migration fails or must be rolled back:

1. Identify the failed migration recorded in `schema_migrations`:
   ```sql
   SELECT * FROM schema_migrations ORDER BY id DESC;
   ```
2. For schema changes where rolling back individual DDL is required:
   ```sql
   -- Example: removing an index
   ALTER TABLE products DROP INDEX idx_products_status_created;
   -- Remove migration tracking record
   DELETE FROM schema_migrations WHERE filename = '0004_performance_indexes.sql';
   ```
3. For destructive migrations (e.g. `0001_remove_payments.sql`), restore from the pre-migration snapshot:
   ```bash
   mysql -h localhost -u bylot_user -p bylot < backup_before_migration.sql
   ```
