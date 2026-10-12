const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { comparePassword } = require("../utils/password");
const { getPagination, buildMeta } = require("../utils/pagination");
const { findUserByEmail, findUserById } = require("../models/userModel");
const { issueTokens } = require("./authController");
const { clearHotCache } = require("./productController");
const { deleteUploadedFile } = require("../middleware/uploadMiddleware");
const auditLogger = require("../security/auditLogger");

const adminLogin = asyncHandler(async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  if (!user || user.role !== "admin" || user.status !== "active" || !(await comparePassword(req.body.password, user.password_hash))) {
    throw new AppError("Invalid email or password. Please try again.", 401);
  }

  const publicUser = await findUserById(user.id);
  const data = await issueTokens(publicUser, req, res);
  return success(res, "Admin login successful", data);
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
  // Soft delete preserves order history and avoids foreign key constraint failure
  const [result] = await pool.execute("UPDATE products SET status = 'deleted' WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError("Product not found", 404);
  return success(res, "Product deleted successfully", null);
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

module.exports = {
  adminLogin,
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
  searchProductByItemId
};
