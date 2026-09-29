const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");
const { productSelect, baseProductQuery, findProductById } = require("../models/productModel");

function sortClause(sort) {
  const sorts = {
    price_asc: "p.selling_price ASC",
    price_desc: "p.selling_price DESC",
    discount_desc: "p.discount_percent DESC",
    expiry_asc: "p.expiry_date IS NULL, p.expiry_date ASC",
    newest: "p.created_at DESC"
  };
  return sorts[sort] || sorts.newest;
}

async function listProducts(req, customWhere = [], customParams = []) {
  const { page, limit, offset } = getPagination(req.query);
  const where = ["p.status = 'active'", ...customWhere];
  const params = [...customParams];

  if (req.query.categoryId) { where.push("p.category_id = ?"); params.push(req.query.categoryId); }
  if (req.query.sellerId)   { where.push("p.seller_id = ?");   params.push(req.query.sellerId); }
  if (req.query.minPrice)   { where.push("p.selling_price >= ?"); params.push(req.query.minPrice); }
  if (req.query.maxPrice)   { where.push("p.selling_price <= ?"); params.push(req.query.maxPrice); }
  if (req.query.type)       { where.push("p.product_type = ?");   params.push(req.query.type); }
  if (req.query.q) {
    where.push("(p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)");
    const q = `%${req.query.q}%`;
    params.push(q, q, q);
  }

  const whereSql = where.join(" AND ");
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p JOIN sellers s ON s.id = p.seller_id WHERE ${whereSql}`,
    params
  );
  let rows = [];
  try {
    const sql = `${baseProductQuery(whereSql)} ORDER BY ${sortClause(req.query.sort)} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const [resultRows] = await pool.query(sql, params);
    rows = resultRows;
  } catch (err) {
    // If database schema is missing p.product_item_id, retry without product_item_id
    if (err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('product_item_id')) {
      const fallbackQuery = baseProductQuery(whereSql).replace('p.product_item_id,', '');
      const sql = `${fallbackQuery} ORDER BY ${sortClause(req.query.sort)} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
      const [resultRows] = await pool.query(sql, params);
      rows = resultRows;
    } else {
      throw err;
    }
  }
  return { rows, meta: buildMeta(countRows[0]?.total || 0, page, limit) };
}

const getAllProducts = asyncHandler(async (req, res) => {
  const { rows, meta } = await listProducts(req);
  return success(res, "Products fetched successfully", rows, 200, meta);
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await findProductById(req.params.id);
  if (!product) throw new AppError("Product not found", 404);
  return success(res, "Product fetched successfully", product);
});

const searchProducts = asyncHandler(async (req, res) => {
  const { rows, meta } = await listProducts(req);
  return success(res, "Search results fetched successfully", rows, 200, meta);
});

const filterProducts = asyncHandler(async (req, res) => {
  const { rows, meta } = await listProducts(req);
  return success(res, "Filtered products fetched successfully", rows, 200, meta);
});

const discountProducts = asyncHandler(async (req, res) => {
  const { rows, meta } = await listProducts(req, ["p.discount_percent > 0"]);
  return success(res, "Discount products fetched successfully", rows, 200, meta);
});

const nearExpiryProducts = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 30), 1), 180);
  const { rows, meta } = await listProducts(req, ["p.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)"], [days]);
  return success(res, "Near expiry products fetched successfully", rows, 200, meta);
});

const nearbyProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const lat = Number(req.query.latitude);
  const lng = Number(req.query.longitude);
  const radiusKm = Math.min(Math.max(Number(req.query.radiusKm || 10), 1), 200);

  // Fast bounding-box optimization: uses idx_sellers_location (latitude, longitude)
  const latDelta = radiusKm / 111.0;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonDelta = radiusKm / (111.0 * Math.max(Math.abs(cosLat), 0.01));
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lonDelta;
  const maxLng = lng + lonDelta;

  const distanceSql = "(6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * COS(RADIANS(s.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(s.latitude))))";
  const baseWhere = "p.status = 'active' AND s.latitude BETWEEN ? AND ? AND s.longitude BETWEEN ? AND ?";
  const countParams = [minLat, maxLat, minLng, maxLng, lat, lng, lat, radiusKm];
  const selectParams = [minLat, maxLat, minLng, maxLng, lat, lng, lat, radiusKm, limit, offset];

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM (
       SELECT p.id, ${distanceSql} AS distance_km
       FROM products p JOIN sellers s ON s.id = p.seller_id
       WHERE ${baseWhere}
       HAVING distance_km <= ?
     ) nearby`,
    countParams
  );

  const [rows] = await pool.query(
    `SELECT ${productSelect}, ${distanceSql} AS distance_km
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN sellers s ON s.id = p.seller_id
     WHERE ${baseWhere}
     HAVING distance_km <= ?
     ORDER BY distance_km ASC
     LIMIT ? OFFSET ?`,
    selectParams
  );

  return success(res, "Nearby products fetched successfully", rows, 200, buildMeta(countRows[0]?.total || rows.length, page, limit));
});

// POST /api/products/:id/report  (auth required — any logged-in user)
const reportProduct = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const { reason, description } = req.body;

  const [products] = await pool.execute(
    "SELECT id FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  if (!products[0]) throw new AppError("Product not found", 404);

  // One report per user per product — re-submitting updates the reason
  await pool.execute(
    `INSERT INTO product_reports (product_id, reporter_id, reason, description)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       reason = VALUES(reason),
       description = VALUES(description),
       status = 'pending',
       updated_at = CURRENT_TIMESTAMP`,
    [productId, req.user.id, reason, description || null]
  );

  return success(res, "Fraud report submitted. Our team will review it shortly.", null, 201);
});

module.exports = {
  getAllProducts,
  getProductById,
  searchProducts,
  filterProducts,
  discountProducts,
  nearExpiryProducts,
  nearbyProducts,
  reportProduct
};
