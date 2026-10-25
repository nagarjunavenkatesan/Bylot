const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const archiver = require("archiver");
const sharp = require("sharp");
const { pool } = require("../config/db");
const env = require("../config/env");
const auditLogger = require("../security/auditLogger");
const { encryptPII, decryptPII } = require("../security/cryptoUtil");
const AppError = require("../utils/AppError");

// Directory structure for private storage
const PRIVATE_DIR = path.resolve(process.cwd(), "private");
const REPORTS_STORAGE_DIR = path.join(PRIVATE_DIR, "reports");
const TEMP_DIR = path.join(PRIVATE_DIR, "temp");

// In-memory mutex lock for active generation jobs
const activeGenerationLocks = new Set();

/**
 * Ensures required private storage directories exist with restricted access.
 */
function ensureStorageDirectories() {
  if (!fs.existsSync(PRIVATE_DIR)) {
    fs.mkdirSync(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(REPORTS_STORAGE_DIR)) {
    fs.mkdirSync(REPORTS_STORAGE_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Safely removes a directory recursively.
 */
function removeDirSyncSafe(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  } catch (err) {
    console.warn(`[ReportArchive] Failed to cleanup temp directory ${dirPath}:`, err.message);
  }
}

/**
 * Calculates SHA-256 hash of a file or buffer.
 */
function calculateSha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Calculates SHA-256 of a file on disk.
 */
function getFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

/**
 * Formats a Date object as YYYY-MM-DD.
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Query sanitized data for buyers.
 */
async function fetchBuyerData(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at, u.updated_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS total_orders,
            (SELECT COUNT(*) FROM product_reports pr WHERE pr.reporter_id = u.id) AS total_complaints
     FROM users u
     WHERE u.role = 'customer'
       AND (u.created_at BETWEEN ? AND ? OR EXISTS (
         SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.created_at BETWEEN ? AND ?
       ))
     ORDER BY u.id ASC`,
    [startDate, endDate, startDate, endDate]
  );

  return rows.map((u) => ({
    user_id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    total_orders: u.total_orders,
    total_complaints: u.total_complaints,
    registered_at: u.created_at,
    last_updated_at: u.updated_at
  }));
}

/**
 * Query sanitized data for sellers.
 */
async function fetchSellerData(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT s.id, s.user_id, s.business_name, s.business_type, s.gst_number, s.license_number,
            s.contact_email, s.contact_phone, s.address_line1, s.city, s.state, s.postal_code, s.country,
            s.approval_status, s.status, s.created_at, s.updated_at,
            (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id) AS total_products,
            (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id AND o.created_at BETWEEN ? AND ?) AS total_orders
     FROM sellers s
     ORDER BY s.id ASC`,
    [startDate, endDate]
  );

  return rows.map((s) => ({
    seller_id: s.id,
    user_id: s.user_id,
    business_name: s.business_name,
    business_type: s.business_type,
    gst_number: s.gst_number,
    license_number: s.license_number,
    contact_email: s.contact_email,
    contact_phone: s.contact_phone,
    address: s.address_line1,
    city: s.city,
    state: s.state,
    postal_code: s.postal_code,
    country: s.country,
    approval_status: s.approval_status,
    status: s.status,
    total_products: s.total_products,
    total_period_orders: s.total_orders,
    created_at: s.created_at,
    updated_at: s.updated_at
  }));
}

/**
 * Query sanitized data for products including full location hierarchy.
 */
async function fetchProductData(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT p.id, p.product_item_id, p.seller_id, p.category_id, p.name, p.description,
            p.sku, p.brand, p.mrp, p.selling_price, p.discount_percent, p.stock_quantity,
            p.low_stock_threshold, p.expiry_date, p.manufacture_date, p.batch_number,
            p.product_type, p.image_url, p.status, p.country, p.state, p.district, p.city, p.locality,
            p.created_at, p.updated_at,
            c.name AS category_name, s.business_name AS seller_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN sellers s ON s.id = p.seller_id
     WHERE p.created_at BETWEEN ? AND ?
        OR p.updated_at BETWEEN ? AND ?
        OR EXISTS (
          SELECT 1 FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.created_at BETWEEN ? AND ?
        )
     ORDER BY p.id ASC`,
    [startDate, endDate, startDate, endDate, startDate, endDate]
  );

  return rows.map((p) => ({
    product_id: p.id,
    product_item_id: p.product_item_id || `PRD-${p.id}`,
    seller_id: p.seller_id,
    seller_name: p.seller_name,
    category_id: p.category_id,
    category_name: p.category_name,
    title: p.name,
    description: p.description,
    sku: p.sku,
    brand: p.brand,
    mrp: Number(p.mrp),
    selling_price: Number(p.selling_price),
    discount_percent: Number(p.discount_percent),
    stock_quantity: p.stock_quantity,
    low_stock_threshold: p.low_stock_threshold,
    expiry_date: p.expiry_date,
    manufacture_date: p.manufacture_date,
    batch_number: p.batch_number,
    product_type: p.product_type,
    image_url: p.image_url,
    status: p.status,
    location: {
      country: p.country || "India",
      state: p.state,
      district: p.district,
      city: p.city,
      locality: p.locality
    },
    created_at: p.created_at,
    updated_at: p.updated_at
  }));
}

/**
 * Query sanitized order data.
 */
async function fetchOrderData(startDate, endDate) {
  const [orders] = await pool.query(
    `SELECT o.id, o.order_number, o.user_id, o.seller_id, o.status,
            o.subtotal, o.delivery_fee, o.grand_total,
            o.created_at, o.updated_at
     FROM orders o
     WHERE o.created_at BETWEEN ? AND ?
     ORDER BY o.id ASC`,
    [startDate, endDate]
  );

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [items] = await pool.query(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
            p.name AS product_name, p.product_item_id
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id IN (?)`,
    [orderIds]
  );

  const itemsMap = new Map();
  items.forEach((it) => {
    if (!itemsMap.has(it.order_id)) itemsMap.set(it.order_id, []);
    itemsMap.get(it.order_id).push({
      item_id: it.id,
      product_id: it.product_id,
      product_item_id: it.product_item_id || `PRD-${it.product_id}`,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      total_price: Number(it.total_price)
    });
  });

  return orders.map((o) => ({
    order_id: o.id,
    order_number: o.order_number,
    buyer_id: o.user_id,
    seller_id: o.seller_id,
    order_status: o.status,
    subtotal: Number(o.subtotal),
    delivery_fee: Number(o.delivery_fee),
    total_amount: Number(o.grand_total),
    items: itemsMap.get(o.id) || [],
    created_at: o.created_at,
    updated_at: o.updated_at
  }));
}

/**
 * Query sanitized complaints/reports data.
 */
async function fetchComplaintData(startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.product_id, pr.reporter_id, pr.reason, pr.description,
            pr.status, pr.admin_note, pr.created_at, pr.resolved_at,
            p.name AS product_name, p.product_item_id, u.email AS reporter_email
     FROM product_reports pr
     LEFT JOIN products p ON p.id = pr.product_id
     LEFT JOIN users u ON u.id = pr.reporter_id
     WHERE pr.created_at BETWEEN ? AND ?
     ORDER BY pr.id ASC`,
    [startDate, endDate]
  );

  return rows.map((r) => ({
    complaint_id: r.id,
    product_id: r.product_id,
    product_item_id: r.product_item_id || `PRD-${r.product_id}`,
    product_name: r.product_name,
    reporter_id: r.reporter_id,
    reporter_email: r.reporter_email,
    reason: r.reason,
    description: r.description,
    status: r.status,
    admin_action: r.admin_note || null,
    created_at: r.created_at,
    resolved_at: r.resolved_at
  }));
}

/**
 * Query sanitized admin audit events.
 */
async function fetchAuditLogData(startDate, endDate) {
  const recentLogs = auditLogger.getRecentLogs(500);
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  return recentLogs
    .filter((log) => {
      const logMs = new Date(log.timestamp).getTime();
      return logMs >= startMs && logMs <= endMs;
    })
    .map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      type: log.type,
      severity: log.severity,
      admin_id: log.userId,
      ip: log.ip,
      path: log.path,
      method: log.method,
      details: log.details
    }));
}

/**
 * Compresses product images to WebP format with deduplication and creates thumbnails.
 * Live images are strictly read-only and never modified or overwritten!
 */
async function processReportImages(products, targetImagesDir) {
  const processedMap = new Map(); // hash -> { productWebpPath, thumbWebpPath }
  let processedCount = 0;

  for (const product of products) {
    if (!product.image_url) continue;

    const rawUrl = product.image_url;
    let localImagePath = null;

    if (rawUrl.startsWith("/uploads/")) {
      localImagePath = path.join(process.cwd(), rawUrl);
    } else if (rawUrl.startsWith("uploads/")) {
      localImagePath = path.join(process.cwd(), rawUrl);
    }

    if (!localImagePath || !fs.existsSync(localImagePath)) {
      continue;
    }

    try {
      // Safe read buffer (read-only)
      const imageBuffer = fs.readFileSync(localImagePath);
      const imageHash = calculateSha256(imageBuffer);

      const prdDirName = product.product_item_id || `PRD-${product.product_id}`;
      const prdFolder = path.join(targetImagesDir, prdDirName);
      if (!fs.existsSync(prdFolder)) {
        fs.mkdirSync(prdFolder, { recursive: true });
      }

      const destProductPath = path.join(prdFolder, "product.webp");
      const destThumbPath = path.join(prdFolder, "thumbnail.webp");

      if (processedMap.has(imageHash)) {
        // Reuse previously compressed image buffer to deduplicate and save processing
        const cached = processedMap.get(imageHash);
        fs.copyFileSync(cached.productPath, destProductPath);
        fs.copyFileSync(cached.thumbPath, destThumbPath);
        processedCount++;
        continue;
      }

      // 1. Full evidence image: max 1200x1200, WebP, quality 80, EXIF stripped
      const fullWebp = await sharp(imageBuffer)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      fs.writeFileSync(destProductPath, fullWebp);

      // 2. Thumbnail: max 300x300, WebP, quality 75
      const thumbWebp = await sharp(imageBuffer)
        .rotate()
        .resize({ width: 300, height: 300, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75, effort: 3 })
        .toBuffer();

      fs.writeFileSync(destThumbPath, thumbWebp);

      processedMap.set(imageHash, { productPath: destProductPath, thumbPath: destThumbPath });
      processedCount++;
    } catch (err) {
      console.warn(`[ReportArchive] Image processing skipped for product ${product.product_id}:`, err.message);
    }
  }

  return processedCount;
}

/**
 * Builds the unencrypted ZIP archive with all required evidence directories and files.
 */
function createArchiveZip(stagingDir, outputZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 } // Maximum compression
    });

    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(stagingDir, false);
    archive.finalize();
  });
}

/**
 * Encrypts a plaintext file with AES-256-GCM envelope encryption.
 * Generates a unique 256-bit DEK, fresh 12-byte IV, calculates SHA-256 hashes,
 * wraps DEK with master encryption key, and writes ciphertext to destination.
 */
function encryptArchiveFile(plaintextZipPath, ciphertextEncPath) {
  return new Promise((resolve, reject) => {
    try {
      // 1. Generate unique 256-bit random Data Encryption Key (DEK)
      const dek = crypto.randomBytes(32);
      // 2. Fresh 12-byte IV for AES-GCM
      const iv = crypto.randomBytes(12);

      const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
      const plaintextHash = crypto.createHash("sha256");
      const ciphertextHash = crypto.createHash("sha256");

      const readStream = fs.createReadStream(plaintextZipPath);
      const writeStream = fs.createWriteStream(ciphertextEncPath);

      readStream.on("data", (chunk) => plaintextHash.update(chunk));

      cipher.on("data", (chunk) => {
        ciphertextHash.update(chunk);
      });

      writeStream.on("finish", () => {
        const tag = cipher.getAuthTag();
        const plaintextSha256 = plaintextHash.digest("hex");
        const ciphertextSha256 = ciphertextHash.digest("hex");
        const fileSize = fs.statSync(ciphertextEncPath).size;

        // Wrap DEK using Master Key via AES-256-GCM
        const encryptedDek = encryptPII(dek.toString("hex"));

        resolve({
          fileSize,
          plaintextSha256,
          ciphertextSha256,
          iv: iv.toString("hex"),
          tag: tag.toString("hex"),
          encryptedDek
        });
      });

      writeStream.on("error", reject);
      readStream.on("error", reject);
      cipher.on("error", reject);

      readStream.pipe(cipher).pipe(writeStream);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Asynchronous worker that executes the end-to-end report generation pipeline.
 */
async function executeReportGenerationJob(reportRecordId, reportId, startDateStr, endDateStr, periodDays, adminUserId) {
  ensureStorageDirectories();
  const jobTempDir = path.join(TEMP_DIR, `job_${reportId}`);
  const tempZipPath = path.join(TEMP_DIR, `${reportId}.tmp.zip`);
  const finalEncPath = path.join(REPORTS_STORAGE_DIR, `${reportId}.zip.enc`);

  try {
    // 1. Transition status to GENERATING
    await pool.execute(
      "UPDATE admin_report_archives SET status = 'GENERATING', updated_at = NOW() WHERE id = ?",
      [reportRecordId]
    );

    // 2. Create clean staging directory structure
    if (fs.existsSync(jobTempDir)) fs.rmSync(jobTempDir, { recursive: true, force: true });
    fs.mkdirSync(jobTempDir, { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "buyers"), { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "sellers"), { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "products"), { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "orders"), { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "reports"), { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "audit"), { recursive: true });
    fs.mkdirSync(path.join(jobTempDir, "images"), { recursive: true });

    // Start of day to end of day boundaries
    const startIso = `${startDateStr} 00:00:00`;
    const endIso = `${endDateStr} 23:59:59`;

    // 3. Collect sanitized evidence datasets
    const [buyers, sellers, products, orders, complaints, auditLogs] = await Promise.all([
      fetchBuyerData(startIso, endIso),
      fetchSellerData(startIso, endIso),
      fetchProductData(startIso, endIso),
      fetchOrderData(startIso, endIso),
      fetchComplaintData(startIso, endIso),
      fetchAuditLogData(startIso, endIso)
    ]);

    // 4. Compress evidence images into WebP
    const imagesCount = await processReportImages(products, path.join(jobTempDir, "images"));

    // 5. Write structured evidence JSON files
    fs.writeFileSync(path.join(jobTempDir, "buyers", "buyer-data.json"), JSON.stringify(buyers, null, 2), "utf8");
    fs.writeFileSync(path.join(jobTempDir, "sellers", "seller-data.json"), JSON.stringify(sellers, null, 2), "utf8");
    fs.writeFileSync(path.join(jobTempDir, "products", "product-data.json"), JSON.stringify(products, null, 2), "utf8");
    fs.writeFileSync(path.join(jobTempDir, "orders", "order-data.json"), JSON.stringify(orders, null, 2), "utf8");
    fs.writeFileSync(path.join(jobTempDir, "reports", "complaints.json"), JSON.stringify(complaints, null, 2), "utf8");
    fs.writeFileSync(path.join(jobTempDir, "audit", "admin-actions.json"), JSON.stringify(auditLogs, null, 2), "utf8");

    // 6. Generate README.txt
    const readmeText = `================================================================================
BYLOT EVIDENCE REPORT ARCHIVE
Report ID: ${reportId}
Period: ${startDateStr} to ${endDateStr} (${periodDays} days)
Generated: ${new Date().toISOString()}
Standard: AES-256-GCM Envelope Encryption
================================================================================
Contents:
- buyers/buyer-data.json       : Sanitized buyer evidence records
- sellers/seller-data.json     : Sanitized seller profiles & performance
- products/product-data.json   : Product listings & location hierarchy
- orders/order-data.json       : Orders & delivery references (No payments)
- reports/complaints.json      : Product disputes & dispute logs
- audit/admin-actions.json     : Administrative action audit records
- images/                      : Compressed WebP evidence images & thumbnails
- manifest.json                : Cryptographic manifest and integrity metadata
- checksums.sha256             : SHA-256 checksums for internal files
================================================================================`;
    fs.writeFileSync(path.join(jobTempDir, "README.txt"), readmeText, "utf8");

    // 7. Calculate SHA-256 checksums for all files in staging directory
    const fileChecksums = [];
    async function collectChecksums(currentDir, relativePrefix = "") {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const ent of entries) {
        const fullP = path.join(currentDir, ent.name);
        const relP = path.posix.join(relativePrefix, ent.name);
        if (ent.isDirectory()) {
          await collectChecksums(fullP, relP);
        } else if (ent.isFile() && ent.name !== "checksums.sha256" && ent.name !== "manifest.json") {
          const hash = await getFileSha256(fullP);
          const size = fs.statSync(fullP).size;
          fileChecksums.push({ path: relP, sha256: hash, size });
        }
      }
    }
    await collectChecksums(jobTempDir);

    // Write checksums.sha256
    const checksumsFileLines = fileChecksums.map((f) => `${f.sha256}  ${f.path}`).join("\n");
    fs.writeFileSync(path.join(jobTempDir, "checksums.sha256"), checksumsFileLines, "utf8");

    // 8. Generate manifest.json
    const manifest = {
      report_id: reportId,
      report_period: {
        start: startDateStr,
        end: endDateStr,
        days: periodDays
      },
      created_at: new Date().toISOString(),
      application_version: "1.0.0",
      schema_version: "0007",
      encryption_algorithm: "AES-256-GCM",
      encryption_version: "1.0",
      image_processing_version: "sharp-webp-v1",
      counts: {
        buyers: buyers.length,
        sellers: sellers.length,
        products: products.length,
        orders: orders.length,
        complaints: complaints.length,
        audit_logs: auditLogs.length,
        images_processed: imagesCount
      },
      files: fileChecksums
    };
    fs.writeFileSync(path.join(jobTempDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    // 9. Compress staging directory into temporary ZIP archive
    await createArchiveZip(jobTempDir, tempZipPath);

    // 10. Encrypt the ZIP archive into permanent encrypted storage (.zip.enc)
    const encryptionResult = await encryptArchiveFile(tempZipPath, finalEncPath);

    // 11. Update database record to READY
    await pool.execute(
      `UPDATE admin_report_archives
       SET status = 'READY',
           file_path = ?,
           file_size = ?,
           checksum_sha256 = ?,
           plaintext_sha256 = ?,
           ciphertext_sha256 = ?,
           encryption_algorithm = 'AES-256-GCM',
           encryption_iv = ?,
           encryption_tag = ?,
           encrypted_dek = ?,
           manifest_summary = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        finalEncPath,
        encryptionResult.fileSize,
        encryptionResult.plaintextSha256,
        encryptionResult.plaintextSha256,
        encryptionResult.ciphertextSha256,
        encryptionResult.iv,
        encryptionResult.tag,
        encryptionResult.encryptedDek,
        JSON.stringify(manifest.counts),
        reportRecordId
      ]
    );

    auditLogger.logEvent("REPORT_CREATED", null, {
      userId: adminUserId,
      reportId,
      details: {
        reportId,
        periodStart: startDateStr,
        periodEnd: endDateStr,
        fileSize: encryptionResult.fileSize,
        checksum: encryptionResult.plaintextSha256
      }
    });
  } catch (err) {
    console.error(`[ReportArchive] Error generating report ${reportId}:`, err);
    await pool.execute(
      `UPDATE admin_report_archives
       SET status = 'FAILED',
           error_message = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [err.message.slice(0, 250), reportRecordId]
    );

    auditLogger.logEvent("REPORT_GENERATION_FAILED", null, {
      userId: adminUserId,
      reportId,
      severity: "HIGH",
      details: { reportId, error: err.message }
    });
  } finally {
    // 12. Strict cleanup: delete all temporary unencrypted files and folders
    removeDirSyncSafe(jobTempDir);
    if (fs.existsSync(tempZipPath)) {
      try { fs.unlinkSync(tempZipPath); } catch {}
    }
    activeGenerationLocks.delete(reportId);
  }
}

/**
 * Initiates non-blocking background report generation.
 * Enforces single job concurrency and prevents duplicate runs.
 */
async function initiateReportGeneration({ days = null, startDate = null, endDate = null, adminUserId }) {
  ensureStorageDirectories();

  const reportPeriodDays = days ? Number(days) : (Number(env.reportPeriodDays) || 30);
  const retentionDays = Number(env.archiveRetentionDays) || 365;

  let endD = new Date();
  let startD = new Date();

  if (startDate && endDate) {
    startD = new Date(startDate);
    endD = new Date(endDate);
  } else {
    startD.setDate(endD.getDate() - reportPeriodDays);
  }

  const startStr = formatDate(startD);
  const endStr = formatDate(endD);
  const reportId = `BYLOT-REPORT-${startStr}_to_${endStr}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // Check if an identical period job is already active or generating
  if (activeGenerationLocks.has(reportId)) {
    throw new AppError("A report generation job for this period is already running. Please wait for completion.", 409);
  }

  const [activeJobs] = await pool.execute(
    `SELECT id, report_id, status FROM admin_report_archives
     WHERE period_start = ? AND period_end = ? AND status IN ('PENDING', 'GENERATING')
     LIMIT 1`,
    [startStr, endStr]
  );

  if (activeJobs.length > 0) {
    throw new AppError(`A report for period ${startStr} to ${endStr} is already being generated (ID: ${activeJobs[0].report_id}).`, 409);
  }

  // Calculate expiration date for archive retention
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  // Insert initial PENDING record
  const [insertResult] = await pool.execute(
    `INSERT INTO admin_report_archives
     (report_id, period_start, period_end, period_days, status, created_by, expires_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
    [reportId, startStr, endStr, reportPeriodDays, adminUserId, expiresAt]
  );

  activeGenerationLocks.add(reportId);

  // Trigger async generation in background (non-blocking)
  setImmediate(() => {
    executeReportGenerationJob(insertResult.insertId, reportId, startStr, endStr, reportPeriodDays, adminUserId);
  });

  return {
    id: insertResult.insertId,
    reportId,
    status: "PENDING",
    periodStart: startStr,
    periodEnd: endStr,
    periodDays: reportPeriodDays,
    expiresAt
  };
}

/**
 * Returns list of reports for the Admin UI.
 */
async function listReportArchives({ page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(50, Math.max(1, Number(limit) || 20));
  const offset = (p - 1) * l;

  const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM admin_report_archives");
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT a.id, a.report_id, a.period_start, a.period_end, a.period_days, a.status,
            a.file_size, a.checksum_sha256, a.plaintext_sha256, a.ciphertext_sha256,
            a.encryption_algorithm, a.manifest_summary, a.error_message,
            a.created_by, u.name AS created_by_name, u.email AS created_by_email,
            a.expires_at, a.created_at, a.updated_at
     FROM admin_report_archives a
     LEFT JOIN users u ON u.id = a.created_by
     ORDER BY a.id DESC
     LIMIT ? OFFSET ?`,
    [l, offset]
  );

  return {
    reports: rows.map((r) => ({
      id: r.id,
      reportId: r.report_id,
      periodStart: formatDate(r.period_start),
      periodEnd: formatDate(r.period_end),
      periodDays: r.period_days,
      status: r.status,
      fileSize: Number(r.file_size),
      checksum: r.checksum_sha256 || r.plaintext_sha256,
      ciphertextChecksum: r.ciphertext_sha256,
      encryptionStatus: r.status === "READY" ? "AES-256-GCM Encrypted" : "N/A",
      encryptionAlgorithm: r.encryption_algorithm,
      manifestSummary: typeof r.manifest_summary === "string" ? JSON.parse(r.manifest_summary) : r.manifest_summary,
      errorMessage: r.error_message,
      createdBy: r.created_by_name || r.created_by_email || `Admin #${r.created_by}`,
      expiresAt: r.expires_at,
      createdAt: r.created_at
    })),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: Math.ceil(total / l)
    }
  };
}

/**
 * Finds a report by internal ID or human-readable report_id string.
 */
async function findReportArchive(idOrReportId) {
  const isNumeric = /^\d+$/.test(String(idOrReportId));
  const query = isNumeric
    ? "SELECT * FROM admin_report_archives WHERE id = ? LIMIT 1"
    : "SELECT * FROM admin_report_archives WHERE report_id = ? LIMIT 1";

  const [rows] = await pool.execute(query, [idOrReportId]);
  return rows[0] || null;
}

/**
 * Streams the decrypted report archive to the response.
 * Uses AES-256-GCM authenticated decryption.
 * If tampered or wrong key, throws immediately.
 */
async function streamDecryptedArchive(report, res, adminUserId) {
  if (report.status !== "READY") {
    throw new AppError(`Report is not ready for download (current status: ${report.status})`, 400);
  }

  if (!report.file_path || !fs.existsSync(report.file_path)) {
    throw new AppError("Archived report file not found on storage.", 404);
  }

  // Decrypt wrapped DEK using Master key
  const dekHex = decryptPII(report.encrypted_dek);
  if (!dekHex || dekHex === "[DECRYPTION_ERROR]") {
    throw new AppError("Failed to unwrap report encryption key. Verify master key configuration.", 500);
  }

  const dek = Buffer.from(dekHex, "hex");
  const iv = Buffer.from(report.encryption_iv, "hex");
  const tag = Buffer.from(report.encryption_tag, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAuthTag(tag);

  const downloadFilename = `${report.report_id}.zip`;

  res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Report-Id", report.report_id);
  res.setHeader("X-Report-Checksum", report.plaintext_sha256 || report.checksum_sha256 || "");

  const readStream = fs.createReadStream(report.file_path);

  readStream.pipe(decipher).pipe(res);

  decipher.on("error", (err) => {
    console.error(`[ReportArchive] Decryption failed for report ${report.report_id}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Report decryption failed. Integrity check mismatch." });
    }
  });

  auditLogger.logEvent("REPORT_DOWNLOAD", null, {
    userId: adminUserId,
    reportId: report.report_id,
    details: {
      reportId: report.report_id,
      downloadFilename
    }
  });
}

/**
 * Securely deletes an archived report.
 * Deletes ONLY the encrypted file on disk and the report metadata.
 * Live application data (users, sellers, products, orders, live images) is NEVER deleted!
 */
async function deleteReportArchive(idOrReportId, adminUserId) {
  const report = await findReportArchive(idOrReportId);
  if (!report) {
    throw new AppError("Report not found", 404);
  }

  // Delete encrypted file on disk
  if (report.file_path && fs.existsSync(report.file_path)) {
    try {
      fs.unlinkSync(report.file_path);
    } catch (err) {
      console.warn(`[ReportArchive] Failed to delete file ${report.file_path}:`, err.message);
    }
  }

  // Mark status as DELETED and clear key material and file path
  await pool.execute(
    `UPDATE admin_report_archives
     SET status = 'DELETED',
         file_path = NULL,
         file_size = 0,
         encrypted_dek = NULL,
         encryption_iv = NULL,
         encryption_tag = NULL,
         updated_at = NOW()
     WHERE id = ?`,
    [report.id]
  );

  auditLogger.logEvent("REPORT_DELETE", null, {
    userId: adminUserId,
    reportId: report.report_id,
    severity: "MEDIUM",
    details: {
      reportId: report.report_id,
      deletedFile: report.file_path
    }
  });

  return {
    deleted: true,
    reportId: report.report_id,
    message: "Report archive deleted successfully. Live application data remains untouched."
  };
}

/**
 * Scheduled/callable retention cleanup function.
 * Cleans up reports older than ARCHIVE_RETENTION_DAYS.
 * Only deletes expired archive files; NEVER touches live data!
 */
async function cleanExpiredArchives() {
  const [expired] = await pool.query(
    "SELECT id, report_id, file_path FROM admin_report_archives WHERE expires_at <= NOW() AND status != 'DELETED'"
  );

  let cleanedCount = 0;
  for (const item of expired) {
    if (item.file_path && fs.existsSync(item.file_path)) {
      try {
        fs.unlinkSync(item.file_path);
      } catch (err) {
        console.warn(`[ReportArchive] Failed to delete expired file ${item.file_path}:`, err.message);
      }
    }
    await pool.execute(
      `UPDATE admin_report_archives
       SET status = 'DELETED',
           file_path = NULL,
           encrypted_dek = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [item.id]
    );

    auditLogger.logEvent("REPORT_AUTO_EXPIRED", null, {
      reportId: item.report_id,
      details: { reportId: item.report_id, action: "AUTO_EXPIRED_CLEANUP" }
    });
    cleanedCount++;
  }

  return { cleanedCount };
}

module.exports = {
  initiateReportGeneration,
  executeReportGenerationJob,
  listReportArchives,
  findReportArchive,
  streamDecryptedArchive,
  deleteReportArchive,
  cleanExpiredArchives,
  formatDate
};
