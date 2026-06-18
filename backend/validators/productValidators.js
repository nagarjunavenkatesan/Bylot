const { body, query, param } = require("express-validator");

const productId = [
  param("id").isInt({ min: 1 })
];

const productList = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("categoryId").optional().isInt({ min: 1 }),
  query("sellerId").optional().isInt({ min: 1 }),
  query("minPrice").optional().isFloat({ min: 0 }),
  query("maxPrice").optional().isFloat({ min: 0 }),
  query("q").optional().trim().isLength({ max: 120 }),
  query("type").optional().isIn(["daily_essential", "near_expiry", "discount", "corporate_clearance"]),
  query("sort").optional().isIn(["newest", "price_asc", "price_desc", "discount_desc", "expiry_asc"])
];

const nearby = [
  query("latitude").isFloat({ min: -90, max: 90 }),
  query("longitude").isFloat({ min: -180, max: 180 }),
  query("radiusKm").optional().isFloat({ min: 1, max: 100 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 })
];

const createProduct = [
  body("categoryId").isInt({ min: 1 }),
  body("name").trim().isLength({ min: 2, max: 180 }),
  body("description").optional({ nullable: true }).trim(),
  body("sku").optional({ nullable: true }).trim().isLength({ max: 80 }),
  body("brand").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("mrp").isFloat({ min: 0 }),
  body("sellingPrice").isFloat({ min: 0 }),
  body("stockQuantity").isInt({ min: 0 }),
  body("lowStockThreshold").optional().isInt({ min: 0 }),
  body("expiryDate").optional({ nullable: true }).isISO8601(),
  body("manufactureDate").optional({ nullable: true }).isISO8601(),
  body("batchNumber").optional({ nullable: true }).trim().isLength({ max: 80 }),
  body("productType").optional().isIn(["daily_essential", "near_expiry", "discount", "corporate_clearance"]),
  body("imageUrl").optional({ nullable: true }).isString(),
  body("status").optional().isIn(["draft", "active", "inactive", "out_of_stock"])
];

const updateProduct = [
  body("categoryId").optional().isInt({ min: 1 }),
  body("name").optional().trim().isLength({ min: 2, max: 180 }),
  body("description").optional({ nullable: true }).trim(),
  body("sku").optional({ nullable: true }).trim().isLength({ max: 80 }),
  body("brand").optional({ nullable: true }).trim().isLength({ max: 120 }),
  body("mrp").optional().isFloat({ min: 0 }),
  body("sellingPrice").optional().isFloat({ min: 0 }),
  body("stockQuantity").optional().isInt({ min: 0 }),
  body("lowStockThreshold").optional().isInt({ min: 0 }),
  body("expiryDate").optional({ nullable: true }).isISO8601(),
  body("manufactureDate").optional({ nullable: true }).isISO8601(),
  body("batchNumber").optional({ nullable: true }).trim().isLength({ max: 80 }),
  body("productType").optional().isIn(["daily_essential", "near_expiry", "discount", "corporate_clearance"]),
  body("imageUrl").optional({ nullable: true }).isString(),
  body("status").optional().isIn(["draft", "active", "inactive", "out_of_stock"])
];

const inventory = [
  body("stockQuantity").isInt({ min: 0 }),
  body("lowStockThreshold").optional().isInt({ min: 0 }),
  body("status").optional().isIn(["draft", "active", "inactive", "out_of_stock"])
];

module.exports = {
  productId,
  productList,
  nearby,
  createProduct,
  updateProduct,
  inventory
};
