const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");
const { baseProductQuery } = require("../models/productModel");

let cachedCategories = null;
let cachedCategoriesTimestamp = 0;
const CATEGORY_CACHE_TTL_MS = 60 * 1000; // 60 seconds

const getCategories = asyncHandler(async (req, res) => {
  const now = Date.now();
  if (cachedCategories && (now - cachedCategoriesTimestamp < CATEGORY_CACHE_TTL_MS)) {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return success(res, "Categories fetched successfully (cached)", cachedCategories);
  }

  const [rows] = await pool.execute("SELECT * FROM categories WHERE is_active = TRUE ORDER BY name ASC");
  cachedCategories = rows;
  cachedCategoriesTimestamp = now;

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  return success(res, "Categories fetched successfully", rows);
});

const getCategoryProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const [categories] = await pool.execute("SELECT id, name FROM categories WHERE id = ? AND is_active = TRUE", [req.params.id]);
  if (!categories[0]) throw new AppError("Category not found", 404);

  const [[count], [products]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND status = 'active'", [req.params.id]),
    pool.query(`${baseProductQuery("p.category_id = ? AND p.status = 'active'")} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [req.params.id, limit, offset])
  ]);

  return success(res, "Category products fetched successfully", products, 200, buildMeta(count[0].total, page, limit));
});

module.exports = {
  getCategories,
  getCategoryProducts
};
