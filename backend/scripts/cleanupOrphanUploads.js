#!/usr/bin/env node
/**
 * Orphan Upload Cleaner for Bylot Marketplace.
 * Scans the uploads/ directory and deletes unreferenced image files
 * that are not stored in any database row and are older than 1 hour.
 * 
 * Usage:
 *   node backend/scripts/cleanupOrphanUploads.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const isDryRun = process.argv.includes("--dry-run");

async function run() {
  console.log("[ORPHAN-CLEANUP] Starting scan for unreferenced upload files...");

  const uploadDir = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");
  if (!fs.existsSync(uploadDir)) {
    console.log("[ORPHAN-CLEANUP] Upload directory does not exist:", uploadDir);
    return;
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "bylot"
  });

  try {
    // Collect all referenced image URLs from database
    const [userRows] = await connection.query("SELECT profile_image FROM users WHERE profile_image IS NOT NULL");
    const [productRows] = await connection.query("SELECT image_url FROM products WHERE image_url IS NOT NULL");

    const referenced = new Set();

    for (const row of userRows) {
      if (row.profile_image) referenced.add(row.profile_image.trim());
    }
    for (const row of productRows) {
      if (row.image_url) referenced.add(row.image_url.trim());
    }

    console.log(`[ORPHAN-CLEANUP] Found ${referenced.size} referenced image URLs in database.`);

    // Recursively scan uploadDir
    function scanFiles(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else {
          results.push({ fullPath, mtime: stat.mtimeMs });
        }
      }
      return results;
    }

    const files = scanFiles(uploadDir);
    console.log(`[ORPHAN-CLEANUP] Found ${files.length} physical files in uploads directory.`);

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const fileObj of files) {
      const relPath = path.relative(uploadDir, fileObj.fullPath).replace(/\\/g, "/");
      const expectedUrl = `/uploads/${relPath}`;

      // Grace period: do not delete files uploaded less than 1 hour ago
      if (now - fileObj.mtime < ONE_HOUR_MS) {
        continue;
      }

      if (!referenced.has(expectedUrl)) {
        const stat = fs.statSync(fileObj.fullPath);
        deletedBytes += stat.size;
        deletedCount++;

        if (isDryRun) {
          console.log(`[ORPHAN-CLEANUP] [DRY RUN] Would delete orphan file: ${expectedUrl} (${Math.round(stat.size / 1024)} KB)`);
        } else {
          fs.unlinkSync(fileObj.fullPath);
          console.log(`[ORPHAN-CLEANUP] Deleted orphan file: ${expectedUrl}`);
        }
      }
    }

    console.log(`\n[ORPHAN-CLEANUP] Scan complete. ${deletedCount} orphan file(s) (${(deletedBytes / (1024 * 1024)).toFixed(2)} MB) ${isDryRun ? "identified" : "removed"}.`);
  } catch (err) {
    console.error("[ORPHAN-CLEANUP] Fatal error:", err.message);
  } finally {
    await connection.end();
  }
}

run();
