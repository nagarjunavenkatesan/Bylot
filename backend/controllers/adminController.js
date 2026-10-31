const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { comparePassword } = require("../utils/password");
const { getPagination, buildMeta } = require("../utils/pagination");
const { findUserByEmail, findUserById } = require("../models/userModel");
const { findProductById } = require("../models/productModel");
const { issueTokens } = require("./authController");
const { clearHotCache } = require("./productController");
const { deleteUploadedFile } = require("../middleware/uploadMiddleware");
const auditLogger = require("../security/auditLogger");
const twoFactorService = require("../services/twoFactorService");
const cryptoUtil = require("../security/cryptoUtil");
const accountLockout = require("../security/accountLockout");
const { normalizeEmail } = require("../utils/email");

const DUMMY_HASH = "$2b$12$e80yvV8Q0qC82n04K71Q2uQnffc1GfG5ZcR2WvY3eK7jM9mO8oDqm";

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || "127.0.0.1";
}

const adminLogin = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const clientIp = getClientIp(req);

  const lockState = accountLockout.isLocked(email, clientIp, req);
  if (lockState.locked) {
    throw new AppError(
      `Account temporarily locked due to excessive failed attempts. Try again in ${lockState.remainingSeconds} seconds.`,
      429
    );
  }

  const user = await findUserByEmail(email);
  const candidateHash = user && user.password_hash ? user.password_hash : DUMMY_HASH;
  const passwordMatch = await comparePassword(password, candidateHash);

  if (!user || user.role !== "admin" || !passwordMatch) {
    accountLockout.recordFailure(email, clientIp, req);
    throw new AppError("Invalid email or password. Please try again.", 401);
  }

  if (user.status !== "active") {
    throw new AppError("Your account is not active. Please contact support.", 401);
  }

  accountLockout.recordSuccess(email, clientIp, req);

  const admin2fa = await twoFactorService.getAdmin2FARecord(user.id);
  if (admin2fa && admin2fa.enabled) {
    const challenge = await twoFactorService.createChallenge(user.id, "login");
    return success(res, "Two-step verification required", {
      requires2FA: true,
      challengeId: challenge.challengeId,
      expiresIn: challenge.expiresIn
    });
  } else {
    const secret = twoFactorService.generateTotpSecret();
    const uri = twoFactorService.generateProvisioningUri(user.email, secret);
    const qrCodeUrl = await twoFactorService.generateQrCode(uri);
    const challenge = await twoFactorService.createChallenge(user.id, "setup", secret);
    auditLogger.logEvent("ADMIN_2FA_ENROLL_STARTED", req, {
      userId: user.id,
      details: "Admin started first-time 2FA enrollment"
    });
    return success(res, "Two-step verification setup required", {
      requires2FASetup: true,
      challengeId: challenge.challengeId,
      qrCodeUrl,
      manualKey: secret,
      provisioningUri: uri,
      expiresIn: challenge.expiresIn
    });
  }
});

const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const [[count], [users]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM users"),
    pool.query("SELECT id, name, email, phone, role, status, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?", [safeLimit, safeOffset])
  ]);
  return success(res, "Users fetched successfully", users, 200, buildMeta(count[0].total, page, safeLimit));
});

const getSellers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const [[count], [sellers]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM sellers"),
    pool.query(
      `SELECT s.*, u.name, u.email, u.status AS user_status
       FROM sellers s JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [safeLimit, safeOffset]
    )
  ]);
  return success(res, "Sellers fetched successfully", sellers, 200, buildMeta(count[0].total, page, safeLimit));
});

const approveSeller = asyncHandler(async (req, res) => {
  const sellerStatus = req.body.approvalStatus === "approved" ? "active" : "inactive";
  const [result] = await pool.execute(
    "UPDATE sellers SET approval_status = ?, status = ?, approved_by = ?, approved_at = IF(? = 'approved', CURRENT_TIMESTAMP, NULL) WHERE id = ?",
    [req.body.approvalStatus, sellerStatus, req.user.id, req.body.approvalStatus, req.params.id]
  );
  if (!result.affectedRows) throw new AppError("Seller not found", 404);
  return success(res, "Seller approval updated successfully", null);
});

const blockUser = asyncHandler(async (req, res) => {
  const targetUserId = Number(req.params.id);
  const currentAdminId = Number(req.user.id);

  if (targetUserId === currentAdminId) {
    throw new AppError("Administrators cannot alter their own account status or role", 400);
  }

  const [targetRows] = await pool.execute("SELECT id, role, status FROM users WHERE id = ? LIMIT 1", [targetUserId]);
  const targetUser = targetRows[0];
  if (!targetUser) {
    throw new AppError("User not found", 404);
  }

  // Prevent blocking or demoting the last active administrator
  if (targetUser.role === "admin" && targetUser.status === "active") {
    if (req.body.status && req.body.status !== "active") {
      const [adminRows] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'active'");
      const activeAdminCount = Number(adminRows[0]?.total || 0);
      if (activeAdminCount <= 1) {
        throw new AppError("Cannot deactivate the last remaining active administrator", 400);
      }
    }
  }

  const newStatus = req.body.status || "blocked";
  await pool.execute("UPDATE users SET status = ? WHERE id = ?", [newStatus, targetUserId]);
  return success(res, "User status updated successfully", null);
});

const dashboardAnalytics = asyncHandler(async (req, res) => {
  const [[usersRows], [sellersRows], [productsRows], [ordersRows], [expiredRows]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'customer'"),
    pool.execute("SELECT COUNT(*) AS total FROM sellers"),
    pool.execute("SELECT COUNT(*) AS total FROM products WHERE status != 'deleted'"),
    pool.execute("SELECT COUNT(*) AS total FROM orders"),
    pool.execute("SELECT COUNT(*) AS total FROM products WHERE status != 'deleted' AND expiry_date IS NOT NULL AND expiry_date < CURDATE()")
  ]);

  return success(res, "Dashboard analytics fetched successfully", {
    totalUsers: usersRows[0]?.total || 0,
    totalSellers: sellersRows[0]?.total || 0,
    totalProducts: productsRows[0]?.total || 0,
    totalOrders: ordersRows[0]?.total || 0,
    totalExpired: expiredRows[0]?.total || 0
  });
});

const manageProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const q = req.query.q ? req.query.q.trim() : "";
  let whereClause = "WHERE p.status != 'deleted'";
  let countParams;
  let selectParams;

  if (q) {
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    const like = `%${escaped}%`;
    whereClause += " AND (p.name LIKE ? OR p.product_item_id LIKE ?)";
    countParams = [like, like];
    selectParams = [like, like, safeLimit, safeOffset];
  } else {
    countParams = [];
    selectParams = [safeLimit, safeOffset];
  }

  const [[count], [products]] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, countParams),
    pool.query(
      `SELECT p.*, c.name AS category_name, s.business_name AS seller_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       ${whereClause}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      selectParams
    )
  ]);
  return success(res, "Products fetched successfully", products, 200, buildMeta(count[0].total, page, safeLimit));
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const [result] = await pool.execute("UPDATE products SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  if (!result.affectedRows) throw new AppError("Product not found", 404);
  return success(res, "Product status updated successfully", null);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const product = await findProductById(productId, true);
  if (!product) throw new AppError("Product not found", 404);

  if (product.status === "deleted") {
    throw new AppError("Product has already been deleted", 404);
  }

  const deletedAt = new Date();
  const deletedBy = req.user.id;
  const deletionReason = (req.body && req.body.reason) ? String(req.body.reason).trim().slice(0, 255) : "Admin deletion";

  // Soft delete preserves order history and avoids foreign key constraint failure
  await pool.execute(
    "UPDATE products SET status = 'deleted', deleted_at = UTC_TIMESTAMP(), deleted_by = ?, deletion_reason = ? WHERE id = ?",
    [deletedBy, deletionReason, productId]
  );

  clearHotCache();

  auditLogger.logEvent("PRODUCT_DELETED", req, {
    userId: req.user.id,
    severity: "INFO",
    details: {
      action: "PRODUCT_DELETED",
      productId: product.id,
      productItemId: product.product_item_id || `PRD-${product.id}`,
      productName: product.name,
      sellerId: product.seller_id,
      sellerName: product.seller_name,
      deletedByUserId: req.user.id,
      deletedByRole: req.user.role,
      originalCreatedAt: product.created_at,
      deletedAt: deletedAt.toISOString(),
      deletionDate: deletedAt.toISOString().slice(0, 10),
      deletionTime: deletedAt.toISOString().slice(11, 19),
      deletionReason,
      categoryName: product.category_name,
      sellingPrice: product.selling_price,
      mrp: product.mrp,
      location: {
        country: product.country || "India",
        state: product.state,
        district: product.district,
        city: product.city,
        locality: product.locality
      },
      imageUrl: product.image_url || null,
      deletionResult: "SUCCESS"
    }
  });

  return success(res, "Product deleted successfully", {
    id: product.id,
    product_item_id: product.product_item_id || `PRD-${product.id}`,
    name: product.name,
    status: "deleted",
    deleted_at: deletedAt.toISOString(),
    deleted_by: deletedBy
  });
});

const getDeletedProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const q = req.query.q ? req.query.q.trim() : "";

  let whereClause = "WHERE p.status = 'deleted'";
  let countParams = [];
  let selectParams = [];

  if (q) {
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    const like = `%${escaped}%`;
    whereClause += " AND (p.name LIKE ? OR p.product_item_id LIKE ?)";
    countParams.push(like, like);
    selectParams.push(like, like);
  }

  selectParams.push(safeLimit, safeOffset);

  const [[count], [rows]] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, countParams),
    pool.query(
      `SELECT p.id, p.product_item_id, p.name, p.selling_price, p.mrp, p.status,
              p.country, p.state, p.district, p.city, p.locality,
              p.created_at, p.updated_at, p.deleted_at, p.deleted_by, p.deletion_reason,
              c.name AS category_name, s.business_name AS seller_name, s.contact_email AS seller_email,
              del_u.name AS deleted_by_name, del_u.email AS deleted_by_email,
              (
                SELECT o.order_number 
                FROM order_items oi 
                JOIN orders o ON o.id = oi.order_id 
                WHERE oi.product_id = p.id 
                ORDER BY o.created_at DESC 
                LIMIT 1
              ) AS order_reference,
              (
                SELECT o.order_number 
                FROM order_items oi 
                JOIN orders o ON o.id = oi.order_id 
                WHERE oi.product_id = p.id 
                ORDER BY o.created_at DESC 
                LIMIT 1
              ) AS latest_order_number
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sellers s ON s.id = p.seller_id
       LEFT JOIN users del_u ON del_u.id = p.deleted_by
       ${whereClause}
       ORDER BY p.deleted_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      selectParams
    )
  ]);

  return success(res, "Deleted products fetched successfully", rows, 200, buildMeta(count[0].total, page, safeLimit));
});

// ── Expired Products Management ────────────────────────────────────────────

async function cleanupProductImages(imageUrls) {
  if (!imageUrls || !imageUrls.length) return;
  const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
  for (const imgUrl of uniqueUrls) {
    if (typeof imgUrl !== "string" || !imgUrl.startsWith("/uploads/")) continue;
    try {
      const [usage] = await pool.query(
        "SELECT COUNT(*) AS count FROM products WHERE image_url = ? AND status != 'deleted'",
        [imgUrl]
      );
      if (usage[0]?.count === 0) {
        deleteUploadedFile(imgUrl);
      }
    } catch {
      // Non-blocking cleanup
    }
  }
}

const getExpiredProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const q = req.query.q ? req.query.q.trim() : "";

  let whereClause = "WHERE p.status != 'deleted' AND p.expiry_date IS NOT NULL AND p.expiry_date < CURDATE()";
  let countParams;
  let selectParams;

  if (q) {
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    const like = `%${escaped}%`;
    whereClause += " AND (p.name LIKE ? OR p.product_item_id LIKE ? OR s.business_name LIKE ? OR c.name LIKE ?)";
    countParams = [like, like, like, like];
    selectParams = [like, like, like, like, safeLimit, safeOffset];
  } else {
    countParams = [];
    selectParams = [safeLimit, safeOffset];
  }

  const [[filteredCount], [authoritativeCount], [products]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sellers s ON s.id = p.seller_id
       ${whereClause}`,
      countParams
    ),
    pool.query(
      "SELECT COUNT(*) AS total FROM products WHERE status != 'deleted' AND expiry_date IS NOT NULL AND expiry_date < CURDATE()"
    ),
    pool.query(
      `SELECT p.id, p.product_item_id, p.seller_id, p.category_id, p.name, p.slug, p.sku, p.brand,
              p.mrp, p.selling_price, p.discount_percent, p.stock_quantity, p.low_stock_threshold,
              p.expiry_date, p.manufacture_date, p.batch_number, p.product_type, p.image_url,
              p.status, p.created_at, p.updated_at,
              c.name AS category_name,
              s.business_name AS seller_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sellers s ON s.id = p.seller_id
       ${whereClause}
       ORDER BY p.expiry_date ASC, p.id DESC
       LIMIT ? OFFSET ?`,
      selectParams
    )
  ]);

  const meta = buildMeta(filteredCount[0]?.total || 0, page, safeLimit);
  meta.authoritativeTotal = authoritativeCount[0]?.total || 0;

  return success(res, "Expired products fetched successfully", products, 200, meta);
});

const getExpiredProductsCount = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM products WHERE status != 'deleted' AND expiry_date IS NOT NULL AND expiry_date < CURDATE()"
  );
  return success(res, "Expired products count fetched successfully", {
    count: rows[0]?.total || 0
  });
});

const deleteAllExpiredProducts = asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [expiredRows] = await connection.query(
      `SELECT id, image_url 
       FROM products 
       WHERE status != 'deleted' 
         AND expiry_date IS NOT NULL 
         AND expiry_date < CURDATE() 
       FOR UPDATE`
    );

    if (expiredRows.length === 0) {
      await connection.rollback();
      return success(res, "No expired products found to delete", { deletedCount: 0 });
    }

    const [result] = await connection.query(
      `UPDATE products 
       SET status = 'deleted' 
       WHERE status != 'deleted' 
         AND expiry_date IS NOT NULL 
         AND expiry_date < CURDATE()`
    );

    await connection.commit();

    clearHotCache();

    cleanupProductImages(expiredRows.map(r => r.image_url)).catch(() => {});

    auditLogger.logEvent("ADMIN_ACTION", req, {
      severity: "INFO",
      details: `Admin deleted all expired products: count=${result.affectedRows}`
    });

    return success(res, `${result.affectedRows} expired products deleted successfully`, {
      deletedCount: result.affectedRows
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

const deleteSelectedExpiredProducts = asyncHandler(async (req, res) => {
  const rawIds = req.body.productIds;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    throw new AppError("productIds must be a non-empty array", 400);
  }

  const uniqueIds = [...new Set(rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
  if (uniqueIds.length === 0) {
    throw new AppError("No valid product IDs provided", 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [eligibleRows] = await connection.query(
      `SELECT id, name, image_url, expiry_date, status
       FROM products
       WHERE id IN (?)
         AND status != 'deleted'
         AND expiry_date IS NOT NULL
         AND expiry_date < CURDATE()
       FOR UPDATE`,
      [uniqueIds]
    );

    if (eligibleRows.length === 0) {
      const [activeRows] = await connection.query(
        `SELECT id, name FROM products 
         WHERE id IN (?) 
           AND status != 'deleted' 
           AND (expiry_date IS NULL OR expiry_date >= CURDATE())`,
        [uniqueIds]
      );
      await connection.rollback();

      if (activeRows.length > 0) {
        throw new AppError("Cannot delete active or non-expired products via the expired products endpoint", 400);
      }

      return success(res, "No eligible expired products were deleted", {
        deletedCount: 0,
        skippedCount: uniqueIds.length
      });
    }

    const eligibleIds = eligibleRows.map(r => r.id);

    const [result] = await connection.query(
      "UPDATE products SET status = 'deleted' WHERE id IN (?)",
      [eligibleIds]
    );

    await connection.commit();

    clearHotCache();

    cleanupProductImages(eligibleRows.map(r => r.image_url)).catch(() => {});

    const deletedCount = result.affectedRows;
    const skippedCount = uniqueIds.length - deletedCount;

    auditLogger.logEvent("ADMIN_ACTION", req, {
      severity: "INFO",
      details: `Admin deleted selected expired products: deleted=${deletedCount}, skipped=${skippedCount}`
    });

    const msg = skippedCount > 0
      ? `${deletedCount} expired products deleted successfully (${skippedCount} non-expired product(s) protected)`
      : `${deletedCount} expired products deleted successfully`;

    return success(res, msg, {
      deletedCount,
      skippedCount
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

const deleteSingleExpiredProduct = asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, image_url, expiry_date, status 
       FROM products 
       WHERE id = ? FOR UPDATE`,
      [productId]
    );

    if (!rows[0]) {
      await connection.rollback();
      throw new AppError("Product not found", 404);
    }

    const product = rows[0];
    if (product.status === "deleted") {
      await connection.rollback();
      throw new AppError("Product has already been deleted", 400);
    }

    const isExpired = product.expiry_date && new Date(product.expiry_date) < new Date();
    if (!isExpired) {
      await connection.rollback();
      throw new AppError("Cannot delete active or non-expired product via the expired products endpoint", 400);
    }

    await connection.query("UPDATE products SET status = 'deleted' WHERE id = ?", [productId]);
    await connection.commit();

    clearHotCache();

    cleanupProductImages([product.image_url]).catch(() => {});

    auditLogger.logEvent("ADMIN_ACTION", req, {
      severity: "INFO",
      details: `Admin deleted single expired product: id=${productId}`
    });

    return success(res, "Expired product deleted successfully", { deletedCount: 1 });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// ── Fraud Reports ──────────────────────────────────────────────────────────

const getReports = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const statusFilter = req.query.status ? "WHERE r.status = ?" : "WHERE 1=1";
  const params = req.query.status ? [req.query.status] : [];

  try {
    const [[count], [reports]] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM product_reports r ${statusFilter}`, params),
      pool.query(
        `SELECT r.*,
                p.name AS product_name, p.image_url AS product_image,
                u.name AS reporter_name, u.email AS reporter_email,
                s.business_name AS seller_name
         FROM product_reports r
         JOIN products p ON p.id = r.product_id
         JOIN users u    ON u.id = r.reporter_id
         JOIN sellers s  ON s.id = p.seller_id
         ${statusFilter}
         ORDER BY r.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params
      )
    ]);
    return success(res, "Reports fetched successfully", reports, 200, buildMeta(count[0].total, page, limit));
  } catch (err) {
    console.warn("Product reports query fallback:", err.message);
    return success(res, "Reports fetched successfully", [], 200, buildMeta(0, page, limit));
  }
});

const resolveReport = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const [result] = await pool.execute(
    `UPDATE product_reports
     SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, adminNote || null, req.user.id, req.params.id]
  );
  if (!result.affectedRows) throw new AppError("Report not found", 404);

  // Auto-block product when report is resolved as genuine
  if (status === "resolved") {
    const [rpt] = await pool.execute("SELECT product_id FROM product_reports WHERE id = ?", [req.params.id]);
    if (rpt[0]) {
      await pool.execute("UPDATE products SET status = 'blocked' WHERE id = ?", [rpt[0].product_id]);
    }
  }
  return success(res, "Report updated successfully", null);
});

const districtAnalytics = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT
      cities.district,
      COALESCE(prod.sellCount, 0) AS sellCount,
      COALESCE(prod.sellValue, 0) AS sellValue,
      COALESCE(ord.buyCount, 0)   AS buyCount,
      COALESCE(ord.buyValue, 0)   AS buyValue
    FROM (
      SELECT DISTINCT COALESCE(city, 'Unknown') AS district FROM sellers
    ) cities
    LEFT JOIN (
      SELECT
        COALESCE(s.city, 'Unknown') AS district,
        COUNT(p.id) AS sellCount,
        COALESCE(SUM(p.selling_price), 0) AS sellValue
      FROM sellers s
      JOIN products p ON p.seller_id = s.id AND p.status = 'active'
      GROUP BY COALESCE(s.city, 'Unknown')
    ) prod ON prod.district = cities.district
    LEFT JOIN (
      SELECT
        COALESCE(s.city, 'Unknown') AS district,
        COUNT(o.id) AS buyCount,
        COALESCE(SUM(o.grand_total), 0) AS buyValue
      FROM sellers s
      JOIN orders o ON o.seller_id = s.id
      GROUP BY COALESCE(s.city, 'Unknown')
    ) ord ON ord.district = cities.district
    ORDER BY sellCount DESC
    LIMIT 30
  `);

  const totals = rows.reduce(
    (acc, r) => ({
      sellCount: acc.sellCount + Number(r.sellCount),
      sellValue: acc.sellValue + Number(r.sellValue),
      buyCount:  acc.buyCount  + Number(r.buyCount),
      buyValue:  acc.buyValue  + Number(r.buyValue),
    }),
    { sellCount: 0, sellValue: 0, buyCount: 0, buyValue: 0 }
  );

  return res.json({ success: true, message: "District analytics fetched", data: rows, totals });
});

const searchProductByItemId = asyncHandler(async (req, res) => {
  const { product_item_id } = req.query;
  if (!product_item_id) throw new AppError("product_item_id query parameter is required", 400);

  const numericId = Number(String(product_item_id).replace(/\D/g, ''));
  const [products] = await pool.query(
    `SELECT p.*, c.name AS category_name, s.business_name AS seller_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN sellers s ON s.id = p.seller_id
     WHERE p.product_item_id = ? OR p.id = ?
     LIMIT 1`,
    [product_item_id, numericId || 0]
  );

  if (!products.length) throw new AppError("No product found with that ID", 404);
  return success(res, "Product found", products[0]);
});

// ── Admin 2FA Management Endpoints ──────────────────────────────────────────

const verifyLogin2FA = asyncHandler(async (req, res) => {
  const { challengeId } = req.body;
  const totpCode = req.body.code !== undefined ? req.body.code : req.body.totpCode;
  const challenge = await twoFactorService.getChallenge(challengeId, "login");
  if (!challenge) {
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      details: "Attempted verification on invalid or expired challenge"
    });
    throw new AppError("Invalid or expired authentication code.", 401);
  }

  const admin2fa = await twoFactorService.getAdmin2FARecord(challenge.admin_user_id);
  if (!admin2fa || !admin2fa.enabled) {
    await twoFactorService.deleteChallenge(challengeId);
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      userId: challenge.admin_user_id,
      details: "2FA not enabled for administrator challenge"
    });
    throw new AppError("Invalid verification code. Please try again.", 401);
  }

  const secret = cryptoUtil.decryptPII(admin2fa.secret_encrypted);
  const result = twoFactorService.verifyTotp(secret, totpCode, admin2fa.last_used_time_step);

  const secretDecryptedOk = Boolean(secret && secret !== "[DECRYPTION_ERROR]" && secret.length >= 16);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(Date.now() / 30000);

  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[2FA Diagnostic] verify-login: challengeId=${challengeId.slice(0, 8)}... ` +
      `totpConfigLoaded=yes secretDecrypted=${secretDecryptedOk ? "yes" : "no"} ` +
      `serverUnixTime=${currentTimestamp} timeStep=${currentStep} ` +
      `verified=${result.valid ? "yes" : "no"} resultReason=${result.reason || "SUCCESS"}`
    );
  }

  if (!result.valid) {
    const failure = await twoFactorService.recordChallengeFailure(challengeId, req);
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      userId: challenge.admin_user_id,
      details: result.reason === "REPLAY_DETECTED" ? "Replay of TOTP code detected" : "Invalid TOTP code provided"
    });
    if (failure.invalidated) {
      throw new AppError("Too many failed attempts. Authentication challenge invalidated. Please sign in again.", 401);
    }
    throw new AppError("Invalid verification code. Please try again.", 401);
  }

  // Update last_used_time_step to prevent replay attacks
  await twoFactorService.updateLastUsedTimeStep(challenge.admin_user_id, result.timeStep);
  await twoFactorService.deleteChallenge(challengeId);

  const user = await findUserById(challenge.admin_user_id);
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AppError("User account not found or inactive.", 401);
  }

  await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  const data = await issueTokens(user, req, res);

  auditLogger.logEvent("ADMIN_2FA_LOGIN_SUCCESS", req, {
    userId: user.id,
    details: "Admin successfully completed two-step verification"
  });

  return success(res, "Admin login successful", data);
});

const verifySetup2FA = asyncHandler(async (req, res) => {
  const { challengeId } = req.body;
  const totpCode = req.body.code !== undefined ? req.body.code : req.body.totpCode;
  const challenge = await twoFactorService.getChallenge(challengeId, "setup");
  if (!challenge || !challenge.temp_secret_encrypted) {
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      details: "Attempted setup verification on invalid or expired setup challenge"
    });
    throw new AppError("Invalid or expired setup session. Please sign in again.", 401);
  }

  const tempSecret = cryptoUtil.decryptPII(challenge.temp_secret_encrypted);
  const result = twoFactorService.verifyTotp(tempSecret, totpCode);

  const secretDecryptedOk = Boolean(tempSecret && tempSecret !== "[DECRYPTION_ERROR]" && tempSecret.length >= 16);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(Date.now() / 30000);

  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[2FA Diagnostic] verify-setup: challengeId=${challengeId.slice(0, 8)}... ` +
      `totpConfigLoaded=yes secretDecrypted=${secretDecryptedOk ? "yes" : "no"} ` +
      `serverUnixTime=${currentTimestamp} timeStep=${currentStep} ` +
      `verified=${result.valid ? "yes" : "no"} resultReason=${result.reason || "SUCCESS"}`
    );
  }

  if (!result.valid) {
    const failure = await twoFactorService.recordChallengeFailure(challengeId, req);
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      userId: challenge.admin_user_id,
      details: "Invalid code provided during 2FA setup enrollment"
    });
    if (failure.invalidated) {
      throw new AppError("Too many failed attempts. Setup session invalidated. Please sign in again.", 401);
    }
    throw new AppError("Invalid authentication code. Please check your authenticator app and try again.", 400);
  }

  const { recoveryCodes } = await twoFactorService.enableAdmin2FA(challenge.admin_user_id, tempSecret, result.timeStep);
  await twoFactorService.deleteChallenge(challengeId);

  const user = await findUserById(challenge.admin_user_id);
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AppError("User account not found or inactive.", 401);
  }

  await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  const data = await issueTokens(user, req, res);

  auditLogger.logEvent("ADMIN_2FA_ENABLED", req, {
    userId: user.id,
    details: "Admin successfully enabled two-step verification and generated recovery codes"
  });

  return success(res, "Two-step verification enabled successfully", {
    ...data,
    recoveryCodes // Displayed ONLY ONCE to administrator
  });
});

const recoveryLogin2FA = asyncHandler(async (req, res) => {
  const { challengeId } = req.body;
  const recoveryCode = req.body.recoveryCode !== undefined ? req.body.recoveryCode : req.body.code;
  const challenge = await twoFactorService.getChallenge(challengeId, "login");
  if (!challenge) {
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      details: "Attempted recovery code verification on invalid or expired challenge"
    });
    throw new AppError("Invalid or expired authentication code.", 401);
  }

  const valid = await twoFactorService.verifyAndConsumeRecoveryCode(challenge.admin_user_id, recoveryCode);
  if (!valid) {
    const failure = await twoFactorService.recordChallengeFailure(challengeId, req);
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      userId: challenge.admin_user_id,
      details: "Invalid or already used recovery code"
    });
    if (failure.invalidated) {
      throw new AppError("Too many failed attempts. Authentication challenge invalidated. Please sign in again.", 401);
    }
    throw new AppError("Invalid verification code. Please try again.", 401);
  }

  await twoFactorService.deleteChallenge(challengeId);

  const user = await findUserById(challenge.admin_user_id);
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AppError("User account not found or inactive.", 401);
  }

  await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  const data = await issueTokens(user, req, res);

  auditLogger.logEvent("ADMIN_2FA_RECOVERY_USED", req, {
    severity: "HIGH",
    userId: user.id,
    details: "Admin successfully authenticated using a one-time recovery code"
  });

  return success(res, "Recovery code verified successfully", data);
});

const get2FAStatus = asyncHandler(async (req, res) => {
  const status = await twoFactorService.getAdmin2FAStatus(req.user.id);
  return success(res, "2FA status fetched successfully", status);
});

const initiate2FASetup = asyncHandler(async (req, res) => {
  const secret = twoFactorService.generateTotpSecret();
  const uri = twoFactorService.generateProvisioningUri(req.user.email, secret);
  const qrCodeUrl = await twoFactorService.generateQrCode(uri);
  const challenge = await twoFactorService.createChallenge(req.user.id, "setup", secret);

  auditLogger.logEvent("ADMIN_2FA_ENROLL_STARTED", req, {
    userId: req.user.id,
    details: "Admin initiated 2FA setup from settings dashboard"
  });

  return success(res, "2FA setup initiated successfully", {
    challengeId: challenge.challengeId,
    qrCodeUrl,
    manualKey: secret,
    provisioningUri: uri,
    expiresIn: challenge.expiresIn
  });
});

const regenerateRecoveryCodes = asyncHandler(async (req, res) => {
  const { currentTotp } = req.body;
  const admin2fa = await twoFactorService.getAdmin2FARecord(req.user.id);
  if (!admin2fa || !admin2fa.enabled) {
    throw new AppError("Two-step verification is not enabled.", 400);
  }

  const secret = cryptoUtil.decryptPII(admin2fa.secret_encrypted);
  const verifyResult = twoFactorService.verifyTotp(secret, currentTotp);
  if (!verifyResult.valid) {
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      userId: req.user.id,
      details: "Failed TOTP verification during recovery code regeneration"
    });
    throw new AppError("Invalid authentication code.", 401);
  }

  const { recoveryCodes } = await twoFactorService.regenerateRecoveryCodes(req.user.id);

  auditLogger.logEvent("ADMIN_2FA_RECOVERY_CODES_REGENERATED", req, {
    userId: req.user.id,
    details: "Admin regenerated 2FA recovery codes"
  });

  return success(res, "Recovery codes regenerated successfully", { recoveryCodes });
});

const disable2FA = asyncHandler(async (req, res) => {
  const { currentTotp, password } = req.body;
  const admin2fa = await twoFactorService.getAdmin2FARecord(req.user.id);
  if (!admin2fa || !admin2fa.enabled) {
    throw new AppError("Two-step verification is not enabled.", 400);
  }

  if (!password) {
    throw new AppError("Current admin password is required to disable 2FA.", 401);
  }

  const [rows] = await pool.execute("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [req.user.id]);
  if (!rows[0] || !(await comparePassword(password, rows[0].password_hash))) {
    throw new AppError("Invalid password.", 401);
  }

  const secret = cryptoUtil.decryptPII(admin2fa.secret_encrypted);
  const verifyResult = twoFactorService.verifyTotp(secret, currentTotp);
  if (!verifyResult.valid) {
    auditLogger.logEvent("ADMIN_2FA_LOGIN_FAILED", req, {
      userId: req.user.id,
      details: "Failed TOTP verification during 2FA disable attempt"
    });
    throw new AppError("Invalid authentication code.", 401);
  }

  await twoFactorService.disableAdmin2FA(req.user.id);

  auditLogger.logEvent("ADMIN_2FA_DISABLED", req, {
    severity: "HIGH",
    userId: req.user.id,
    details: "Admin disabled two-step verification"
  });

  return success(res, "Two-step verification has been disabled successfully.", null);
});

module.exports = {
  adminLogin,
  verifyLogin2FA,
  verifySetup2FA,
  recoveryLogin2FA,
  get2FAStatus,
  initiate2FASetup,
  regenerateRecoveryCodes,
  disable2FA,
  getAllUsers,
  getSellers,
  approveSeller,
  blockUser,
  dashboardAnalytics,
  manageProducts,
  updateProductStatus,
  deleteProduct,
  getExpiredProducts,
  getExpiredProductsCount,
  deleteAllExpiredProducts,
  deleteSelectedExpiredProducts,
  deleteSingleExpiredProduct,
  districtAnalytics,
  getReports,
  resolveReport,
  searchProductByItemId,
  getDeletedProducts
};
