const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { comparePassword } = require("../utils/password");
const { signAccessToken, signRefreshToken, hashToken } = require("../utils/token");
const { getPagination, buildMeta } = require("../utils/pagination");
const { findUserByEmail, findUserById, saveRefreshToken } = require("../models/userModel");

const adminLogin = asyncHandler(async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  if (!user || user.role !== "admin" || user.status !== "active" || !(await comparePassword(req.body.password, user.password_hash))) {
    throw new AppError("Invalid email or password. Please try again.", 401);
  }

  const publicUser = await findUserById(user.id);
  const refreshToken = signRefreshToken(publicUser);
  await saveRefreshToken(user.id, hashToken(refreshToken));
  return success(res, "Admin login successful", {
    user: publicUser,
    accessToken: signAccessToken(publicUser),
    refreshToken
  });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const [[count], [users]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM users"),
    pool.query(`SELECT id, name, email, phone, role, status, created_at FROM users ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`)
  ]);
  return success(res, "Users fetched successfully", users, 200, buildMeta(count[0].total, page, limit));
});

const getSellers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const [[count], [sellers]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM sellers"),
    pool.query(
      `SELECT s.*, u.name, u.email, u.status AS user_status
       FROM sellers s JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`
    )
  ]);
  return success(res, "Sellers fetched successfully", sellers, 200, buildMeta(count[0].total, page, limit));
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
  const [result] = await pool.execute("UPDATE users SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  if (!result.affectedRows) throw new AppError("User not found", 404);
  return success(res, "User status updated successfully", null);
});

const dashboardAnalytics = asyncHandler(async (req, res) => {
  const [[users], [sellers], [products], [orders], [revenue]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'customer'"),
    pool.execute("SELECT COUNT(*) AS total FROM sellers"),
    pool.execute("SELECT COUNT(*) AS total FROM products"),
    pool.execute("SELECT COUNT(*) AS total FROM orders"),
    pool.execute("SELECT COALESCE(SUM(grand_total), 0) AS total FROM orders WHERE payment_status = 'paid'")
  ]);

  return success(res, "Dashboard analytics fetched successfully", {
    totalUsers: users[0]?.total || 0,
    totalSellers: sellers[0]?.total || 0,
    totalProducts: products[0]?.total || 0,
    totalOrders: orders[0]?.total || 0,
    revenue: revenue[0]?.total || 0
  });
});

const manageProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const q = req.query.q ? req.query.q.trim() : '';
  let whereClause = '';
  let params = [];

  if (q) {
    whereClause = 'WHERE (p.name LIKE ? OR p.product_item_id LIKE ?)';
    const like = `%${q}%`;
    params = [like, like];
  }

  const [[count], [products]] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM products p ${whereClause}`, params),
    pool.query(
      `SELECT p.*, c.name AS category_name, s.business_name AS seller_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       ${whereClause}
       ORDER BY p.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    )
  ]);
  return success(res, "Products fetched successfully", products, 200, buildMeta(count[0].total, page, limit));
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const [result] = await pool.execute("UPDATE products SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  if (!result.affectedRows) throw new AppError("Product not found", 404);
  return success(res, "Product status updated successfully", null);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const [result] = await pool.execute("DELETE FROM products WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError("Product not found", 404);
  return success(res, "Product deleted successfully", null);
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
  districtAnalytics,
  getReports,
  resolveReport,
  searchProductByItemId
};
