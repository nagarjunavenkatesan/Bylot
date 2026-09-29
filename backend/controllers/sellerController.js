const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require("../utils/slugify");
const { getPagination, buildMeta } = require("../utils/pagination");
const { findSellerByUserId } = require("../models/sellerModel");
const { findProductById } = require("../models/productModel");
const { publicFileUrl } = require("../middleware/uploadMiddleware");

async function requireSeller(userId) {
  const seller = await findSellerByUserId(userId);
  if (!seller) throw new AppError("Seller profile not found", 404);
  if (seller.approval_status !== "approved") throw new AppError("Seller account is not approved", 403);
  return seller;
}

function discountPercent(mrp, sellingPrice) {
  if (!mrp || Number(mrp) <= 0) return 0;
  return Math.max(0, Number((((mrp - sellingPrice) / mrp) * 100).toFixed(2)));
}

async function generateProductItemId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let isUnique = false;
  let productItemId = '';
  while (!isUnique) {
    let id = 'PRD-';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    const [existing] = await pool.execute(
      'SELECT id FROM products WHERE product_item_id = ? LIMIT 1',
      [id]
    );
    if (!existing || existing.length === 0) {
      productItemId = id;
      isUnique = true;
    }
  }
  return productItemId;
}

const addProduct = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const body = req.body;
  const slug = `${slugify(body.name)}-${Date.now()}`;
  const discount = discountPercent(body.mrp, body.sellingPrice);
  const productItemId = await generateProductItemId();

  const [result] = await pool.execute(
    `INSERT INTO products
     (product_item_id, seller_id, category_id, name, slug, description, sku, brand, mrp, selling_price, discount_percent,
      stock_quantity, low_stock_threshold, expiry_date, manufacture_date, batch_number, product_type, image_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productItemId,
      seller.id,
      body.categoryId,
      body.name,
      slug,
      body.description || null,
      body.sku || null,
      body.brand || null,
      body.mrp,
      body.sellingPrice,
      discount,
      body.stockQuantity,
      body.lowStockThreshold || 5,
      body.expiryDate || null,
      body.manufactureDate || null,
      body.batchNumber || null,
      body.productType || "daily_essential",
      body.imageUrl || null,
      body.status || "active"
    ]
  );

  const product = await findProductById(result.insertId);
  return success(res, "Product added successfully", product, 201);
});

const upsertSellerProfile = asyncHandler(async (req, res) => {
  const body = req.body;
  const existing = await findSellerByUserId(req.user.id);
  if (existing) {
    await pool.execute(
      `UPDATE sellers SET business_name = ?, business_type = ?, gst_number = ?, license_number = ?,
       contact_email = ?, contact_phone = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?,
       postal_code = ?, country = ?, latitude = ?, longitude = ?, approval_status = 'pending', status = 'inactive'
       WHERE user_id = ?`,
      [
        body.businessName,
        body.businessType || "mixed",
        body.gstNumber || null,
        body.licenseNumber || null,
        body.contactEmail || null,
        body.contactPhone || null,
        body.addressLine1 || null,
        body.addressLine2 || null,
        body.city || null,
        body.state || null,
        body.postalCode || null,
        body.country || "India",
        body.latitude || null,
        body.longitude || null,
        req.user.id
      ]
    );
  } else {
    await pool.execute(
      `INSERT INTO sellers
       (user_id, business_name, business_type, gst_number, license_number, contact_email, contact_phone,
        address_line1, address_line2, city, state, postal_code, country, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        body.businessName,
        body.businessType || "mixed",
        body.gstNumber || null,
        body.licenseNumber || null,
        body.contactEmail || null,
        body.contactPhone || null,
        body.addressLine1 || null,
        body.addressLine2 || null,
        body.city || null,
        body.state || null,
        body.postalCode || null,
        body.country || "India",
        body.latitude || null,
        body.longitude || null
      ]
    );
  }

  await pool.execute("UPDATE users SET role = 'seller' WHERE id = ? AND role = 'customer'", [req.user.id]);
  return success(res, "Seller profile submitted for approval", await findSellerByUserId(req.user.id), existing ? 200 : 201);
});

const getSellerProfile = asyncHandler(async (req, res) => {
  const seller = await findSellerByUserId(req.user.id);
  if (!seller) throw new AppError("Seller profile not found", 404);
  return success(res, "Seller profile fetched successfully", seller);
});

const uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("Product image is required", 400);
  return success(res, "Product image uploaded successfully", { imageUrl: publicFileUrl(req, req.file) }, 201);
});

const editProduct = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const product = await findProductById(req.params.id);
  if (!product || product.seller_id !== seller.id) throw new AppError("Product not found", 404);

  const updates = {
    category_id: req.body.categoryId,
    name: req.body.name,
    description: req.body.description,
    sku: req.body.sku,
    brand: req.body.brand,
    mrp: req.body.mrp,
    selling_price: req.body.sellingPrice,
    discount_percent: req.body.mrp && req.body.sellingPrice ? discountPercent(req.body.mrp, req.body.sellingPrice) : undefined,
    stock_quantity: req.body.stockQuantity,
    low_stock_threshold: req.body.lowStockThreshold,
    expiry_date: req.body.expiryDate,
    manufacture_date: req.body.manufactureDate,
    batch_number: req.body.batchNumber,
    product_type: req.body.productType,
    image_url: req.body.imageUrl,
    status: req.body.status
  };

  const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (fields.length) {
    await pool.execute(
      `UPDATE products SET ${fields.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ? AND seller_id = ?`,
      [...fields.map(([, value]) => value), req.params.id, seller.id]
    );
  }

  return success(res, "Product updated successfully", await findProductById(req.params.id));
});

const deleteProduct = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const [result] = await pool.execute("UPDATE products SET status = 'inactive' WHERE id = ? AND seller_id = ?", [req.params.id, seller.id]);
  if (!result.affectedRows) throw new AppError("Product not found", 404);
  return success(res, "Product deleted successfully", null);
});

const updateInventory = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const status = req.body.status || (Number(req.body.stockQuantity) === 0 ? "out_of_stock" : "active");
  const [result] = await pool.execute(
    "UPDATE products SET stock_quantity = ?, low_stock_threshold = COALESCE(?, low_stock_threshold), status = ? WHERE id = ? AND seller_id = ?",
    [req.body.stockQuantity, req.body.lowStockThreshold || null, status, req.params.id, seller.id]
  );
  if (!result.affectedRows) throw new AppError("Product not found", 404);
  return success(res, "Inventory updated successfully", await findProductById(req.params.id));
});

const sellerDashboard = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const [[productStats], [orderStats], [lowStock]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS totalProducts, SUM(stock_quantity) AS totalStock FROM products WHERE seller_id = ?", [seller.id]),
    pool.execute("SELECT COUNT(*) AS totalOrders, COALESCE(SUM(grand_total), 0) AS revenue FROM orders WHERE seller_id = ?", [seller.id]),
    pool.execute("SELECT id, name, stock_quantity, low_stock_threshold FROM products WHERE seller_id = ? AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC LIMIT 10", [seller.id])
  ]);

  return success(res, "Seller dashboard fetched successfully", {
    seller,
    stats: {
      totalProducts: productStats[0].totalProducts,
      totalStock: productStats[0].totalStock || 0,
      totalOrders: orderStats[0].totalOrders,
      revenue: orderStats[0].revenue
    },
    lowStock: lowStock
  });
});

const listSellerProducts = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const { page, limit, offset } = getPagination(req.query);
  const [[count], [rows]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM products WHERE seller_id = ?", [seller.id]),
    pool.query("SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", [seller.id, limit, offset])
  ]);
  return success(res, "Seller products fetched successfully", rows, 200, buildMeta(count[0].total, page, limit));
});

module.exports = {
  upsertSellerProfile,
  getSellerProfile,
  uploadProductImage,
  addProduct,
  editProduct,
  deleteProduct,
  updateInventory,
  sellerDashboard,
  listSellerProducts
};
