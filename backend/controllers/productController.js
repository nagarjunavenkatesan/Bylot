const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");
const {
  productListSelect,
  PUBLIC_PRODUCT_JOINS,
  PUBLIC_PRODUCT_CONDITION,
  baseProductQuery,
  baseProductCountQuery,
  findProductById
} = require("../models/productModel");

function escapeLike(str) {
  if (typeof str !== "string") return "";
  return str.replace(/([%_\\])/g, "\\$1");
}

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

// In-memory cache for hot product endpoints (30s TTL per Phase 4)
const hotCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

function getCached(key) {
  const item = hotCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    hotCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (hotCache.size >= 100) {
    const firstKey = hotCache.keys().next().value;
    hotCache.delete(firstKey);
  }
  hotCache.set(key, { time: Date.now(), data });
}

function clearHotCache() {
  hotCache.clear();
}

async function listProducts(req, customWhere = [], customParams = []) {
  // Helper to safely get string or scalar query param (prevent array injection)
  const getParam = (val) => (Array.isArray(val) ? val[0] : val);

  const { page, limit } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  // Cap max page to prevent deep offset table scan DoS (Phase 4)
  const safePage = Math.min(Math.max(1, Number(page) || 1), 100);
  const safeOffset = (safePage - 1) * safeLimit;

  const where = ["1=1", ...customWhere];
  const params = [...customParams];

  // Keyset (cursor) pagination for O(1) unlimited deep paging
  const cursor = getParam(req.query.cursor) || getParam(req.query.afterId);
  if (cursor && Number.isInteger(Number(cursor)) && Number(cursor) > 0) {
    where.push("p.id < ?");
    params.push(Number(cursor));
  }

  const categoryId = getParam(req.query.categoryId);
  if (categoryId && Number.isInteger(Number(categoryId))) {
    where.push("p.category_id = ?");
    params.push(Number(categoryId));
  }

  const sellerId = getParam(req.query.sellerId);
  if (sellerId && Number.isInteger(Number(sellerId))) {
    where.push("p.seller_id = ?");
    params.push(Number(sellerId));
  }

  const minPrice = getParam(req.query.minPrice);
  if (minPrice !== undefined && !Number.isNaN(Number(minPrice)) && Number(minPrice) >= 0) {
    where.push("p.selling_price >= ?");
    params.push(Number(minPrice));
  }

  const maxPrice = getParam(req.query.maxPrice);
  if (maxPrice !== undefined && !Number.isNaN(Number(maxPrice)) && Number(maxPrice) >= 0) {
    where.push("p.selling_price <= ?");
    params.push(Number(maxPrice));
  }

  const type = getParam(req.query.type);
  if (type && typeof type === "string" && ["daily_essential", "near_expiry", "discount", "corporate_clearance"].includes(type)) {
    where.push("p.product_type = ?");
    params.push(type);
  }

  const rawQ = getParam(req.query.q);
  if (rawQ && typeof rawQ === "string" && rawQ.trim()) {
    const cleanQ = rawQ.trim();
    const words = cleanQ.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/).filter(w => w.length >= 3);
    if (words.length > 0) {
      where.push("MATCH(p.name, p.brand, p.description) AGAINST(? IN BOOLEAN MODE)");
      const ftQuery = words.map(w => `+${w}*`).join(" ");
      params.push(ftQuery);
    } else {
      const escaped = escapeLike(cleanQ);
      where.push("(p.name LIKE ? OR p.brand LIKE ?)");
      const prefixPattern = `${escaped}%`;
      params.push(prefixPattern, prefixPattern);
    }
  }

  const whereClause = where.join(" AND ");

  // Count and row query use EXACTLY the same joins and condition
  const countSql = baseProductCountQuery(whereClause);
  const rowSql = `${baseProductQuery(whereClause)} ORDER BY ${sortClause(getParam(req.query.sort))} LIMIT ? OFFSET ?`;

  let countRows, rows;
  try {
    [countRows] = await pool.query(countSql, params);
    [rows] = await pool.query(rowSql, [...params, safeLimit, safeOffset]);
  } catch (err) {
    if (err.code === "ER_PARSE_ERROR" || (err.message && err.message.includes("syntax error"))) {
      const fallbackWhere = ["1=1", ...customWhere, "(p.name LIKE ? OR p.brand LIKE ?)"];
      const fallbackWhereClause = fallbackWhere.join(" AND ");
      const escaped = `${escapeLike(rawQ ? String(rawQ).trim() : "")}%`;
      const [fCount] = await pool.query(baseProductCountQuery(fallbackWhereClause), [...customParams, escaped, escaped]);
      const [fRows] = await pool.query(`${baseProductQuery(fallbackWhereClause)} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [...customParams, escaped, escaped, safeLimit, safeOffset]);
      return { rows: fRows, meta: buildMeta(fCount[0]?.total || 0, safePage, safeLimit) };
    }
    throw err;
  }

  const total = countRows[0]?.total || 0;
  return { rows, meta: buildMeta(total, safePage, safeLimit) };
}

const getAllProducts = asyncHandler(async (req, res) => {
  const cacheKey = `all_${JSON.stringify(req.query)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return success(res, "Products fetched successfully", cached.rows, 200, cached.meta);
  }

  const result = await listProducts(req);
  setCached(cacheKey, result);
  res.set("X-Cache", "MISS");
  return success(res, "Products fetched successfully", result.rows, 200, result.meta);
});

const getProductById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid product ID", 400);
  }

  const product = await findProductById(id, false);
  if (!product) {
    throw new AppError("Product not found", 404);
  }
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
  const cacheKey = `discounts_${JSON.stringify(req.query)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return success(res, "Discount products fetched successfully", cached.rows, 200, cached.meta);
  }

  const result = await listProducts(req, ["p.discount_percent > 0"]);
  setCached(cacheKey, result);
  return success(res, "Discount products fetched successfully", result.rows, 200, result.meta);
});

const nearExpiryProducts = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 30), 1), 180);
  const cacheKey = `near_expiry_${days}_${JSON.stringify(req.query)}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    return success(res, "Near expiry products fetched successfully", cached.rows, 200, cached.meta);
  }

  const result = await listProducts(
    req,
    ["p.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)"],
    [days]
  );
  setCached(cacheKey, result);
  return success(res, "Near expiry products fetched successfully", result.rows, 200, result.meta);
});

const nearbyProducts = asyncHandler(async (req, res) => {
  const lat = Number(req.query.latitude);
  const lng = Number(req.query.longitude);

  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    throw new AppError("Invalid latitude (must be between -90 and 90)", 400);
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    throw new AppError("Invalid longitude (must be between -180 and 180)", 400);
  }

  const radiusKm = Math.min(Math.max(Number(req.query.radiusKm || 10), 0.1), 200);
  const { page, limit } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  const safePage = Math.max(1, Number(page) || 1);
  const safeOffset = (safePage - 1) * safeLimit;

  // Clamped bounding box
  const latDelta = radiusKm / 111.0;
  const minLat = Math.max(-90, lat - latDelta);
  const maxLat = Math.min(90, lat + latDelta);

  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonDelta = radiusKm / (111.0 * Math.max(Math.abs(cosLat), 0.01));

  let lngCondition = "s.longitude BETWEEN ? AND ?";
  let lngParams = [lng - lonDelta, lng + lonDelta];

  // Handle antimeridian wrap-around (-180 to 180)
  if (lng - lonDelta < -180) {
    lngCondition = "(s.longitude >= ? OR s.longitude <= ?)";
    lngParams = [lng - lonDelta + 360, lng + lonDelta];
  } else if (lng + lonDelta > 180) {
    lngCondition = "(s.longitude >= ? OR s.longitude <= ?)";
    lngParams = [lng - lonDelta, lng + lonDelta - 360];
  }

  const distanceSql = `(6371 * ACOS(LEAST(1, GREATEST(-1,
    COS(RADIANS(?)) * COS(RADIANS(s.latitude)) * COS(RADIANS(s.longitude) - RADIANS(?)) +
    SIN(RADIANS(?)) * SIN(RADIANS(s.latitude))
  ))))`;

  const whereClause = `
    ${PUBLIC_PRODUCT_CONDITION}
    AND s.latitude BETWEEN ? AND ?
    AND ${lngCondition}
  `;

  const baseParams = [minLat, maxLat, ...lngParams];
  const distanceParams = [lat, lng, lat];

  // Count query
  const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT p.id, ${distanceSql} AS distance_km
      ${PUBLIC_PRODUCT_JOINS}
      WHERE ${whereClause}
      HAVING distance_km <= ?
    ) nearby
  `;
  const [countRows] = await pool.query(countSql, [...distanceParams, ...baseParams, radiusKm]);
  const total = countRows[0]?.total || 0;

  // Data query
  const rowSql = `
    SELECT ${productListSelect}, ${distanceSql} AS distance_km
    ${PUBLIC_PRODUCT_JOINS}
    WHERE ${whereClause}
    HAVING distance_km <= ?
    ORDER BY distance_km ASC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(rowSql, [
    ...distanceParams,
    ...baseParams,
    radiusKm,
    safeLimit,
    safeOffset
  ]);

  return success(res, "Nearby products fetched successfully", rows, 200, buildMeta(total, safePage, safeLimit));
});

const reportProduct = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const { reason, description } = req.body;

  const [products] = await pool.execute(
    "SELECT id FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  if (!products[0]) throw new AppError("Product not found", 404);

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
  reportProduct,
  clearHotCache
};
