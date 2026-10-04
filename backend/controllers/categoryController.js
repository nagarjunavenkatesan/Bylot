const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");
const { baseProductQuery, baseProductCountQuery } = require("../models/productModel");

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
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new AppError("Invalid category ID", 400);
  }

  const { page, limit } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  const safePage = Math.max(1, Number(page) || 1);
  const safeOffset = (safePage - 1) * safeLimit;

  const [categories] = await pool.execute("SELECT id, name FROM categories WHERE id = ? AND is_active = TRUE", [categoryId]);
  if (!categories[0]) throw new AppError("Category not found", 404);

  const whereClause = "p.category_id = ?";
  const [[countRows], [products]] = await Promise.all([
    pool.query(baseProductCountQuery(whereClause), [categoryId]),
    pool.query(
      `${baseProductQuery(whereClause)} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [categoryId, safeLimit, safeOffset]
    )
  ]);

  return success(res, "Category products fetched successfully", products, 200, buildMeta(countRows[0]?.total || 0, safePage, safeLimit));
});

module.exports = {
  getCategories,
  getCategoryProducts
};
