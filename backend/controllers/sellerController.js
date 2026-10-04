const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require("../utils/slugify");
const { getPagination, buildMeta } = require("../utils/pagination");
const { findSellerByUserId } = require("../models/sellerModel");
const { findProductById } = require("../models/productModel");
const { publicFileUrl, deleteUploadedFile } = require("../middleware/uploadMiddleware");
const { clearHotCache } = require("./productController");

async function requireSeller(userId) {
  const seller = await findSellerByUserId(userId);
  if (!seller) throw new AppError("Seller profile not found", 404);
  return seller;
}

async function requireApprovedSeller(user) {
  if (user.status !== "active") {
    throw new AppError("Your user account is suspended or inactive", 403);
  }
  const seller = await findSellerByUserId(user.id);
  if (!seller) {
    throw new AppError("Seller profile not found. Please register your seller profile first.", 403);
  }
  if (seller.approval_status !== "approved" || seller.status !== "active") {
    throw new AppError("Your seller account is pending admin approval or is inactive", 403);
  }
  return seller;
}

function discountPercent(mrp, sellingPrice) {
  if (!mrp || Number(mrp) <= 0) return 0;
  return Math.max(0, Number((((mrp - sellingPrice) / mrp) * 100).toFixed(2)));
}

async function resolveCategoryId(categoryInput) {
  if (categoryInput !== undefined && categoryInput !== null && Number.isInteger(Number(categoryInput)) && Number(categoryInput) > 0) {
    const [rows] = await pool.execute("SELECT id FROM categories WHERE id = ? AND is_active = 1 LIMIT 1", [Number(categoryInput)]);
    if (rows.length > 0) {
      return rows[0].id;
    }
    throw new AppError("Selected category does not exist", 400);
  }
  const categoryName = (typeof categoryInput === 'string' && categoryInput.trim()) ? categoryInput.trim() : 'Daily Essentials';
  const slug = slugify(categoryName);
  const [rows] = await pool.execute("SELECT id FROM categories WHERE name = ? OR slug = ? LIMIT 1", [categoryName, slug]);
  if (rows.length > 0) {
    return rows[0].id;
  }
  const [ins] = await pool.execute(
    "INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, 1)",
    [categoryName, slug, `${categoryName} category`, 1]
  );
  return ins.insertId;
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
  // Product creation requires role seller/admin and approval_status = 'approved' and user status active
  const seller = req.user.role === "admin"
    ? (await findSellerByUserId(req.user.id)) || { id: 1 }
    : await requireApprovedSeller(req.user);

  const body = req.body;
  const name = body.name ? String(body.name).trim() : '';
  if (!name || name.length < 2 || name.length > 180) {
    throw new AppError("Product name must be between 2 and 180 characters", 400);
  }

  const categoryId = await resolveCategoryId(body.categoryId ?? body.category);
  const sellingPrice = Number(body.sellingPrice ?? body.price ?? 0);
  const mrp = Number(body.mrp ?? body.originalPrice ?? sellingPrice);

  if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
    throw new AppError("Selling price must be greater than or equal to 0", 400);
  }
  if (Number.isNaN(mrp) || mrp < 0) {
    throw new AppError("MRP must be greater than or equal to 0", 400);
  }
  if (sellingPrice > mrp) {
    throw new AppError("Selling price cannot exceed MRP", 400);
  }

  // Stock quantity must correctly accept 0 without defaulting to 10
  const stockQuantity = body.stockQuantity !== undefined ? Number(body.stockQuantity) : 0;
  if (Number.isNaN(stockQuantity) || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new AppError("Stock quantity must be a non-negative integer", 400);
  }

  // Sellers may set only 'active' or 'inactive' on their own products
  const productStatus = body.status === "inactive" ? "inactive" : (stockQuantity === 0 ? "out_of_stock" : "active");
  const slug = `${slugify(name)}-${Date.now()}`;
  const discount = discountPercent(mrp, sellingPrice);
  const productItemId = await generateProductItemId();

  let imageUrl = body.imageUrl || null;
  if (req.file) {
    imageUrl = publicFileUrl(req, req.file);
  } else if (body.image && typeof body.image === 'string' && body.image.startsWith('http')) {
    imageUrl = body.image;
  }

  let result;
  try {
    [result] = await pool.execute(
      `INSERT INTO products
       (product_item_id, seller_id, category_id, name, slug, description, sku, brand, mrp, selling_price, discount_percent,
        stock_quantity, low_stock_threshold, expiry_date, manufacture_date, batch_number, product_type, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productItemId,
        seller.id,
        categoryId,
        name,
        slug,
        body.description || null,
        body.sku || null,
        body.brand || null,
        mrp,
        sellingPrice,
        discount,
        stockQuantity,
        Number(body.lowStockThreshold) || 5,
        body.expiryDate || null,
        body.manufactureDate || null,
        body.batchNumber || null,
        body.productType || "daily_essential",
        imageUrl,
        productStatus
      ]
    );
  } catch (err) {
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }
    throw err;
  }

  clearHotCache();
  const product = await findProductById(result.insertId, true);
  return success(res, "Product added successfully", product, 201);
});

const upsertSellerProfile = asyncHandler(async (req, res) => {
  const body = req.body;
  const existing = await findSellerByUserId(req.user.id);

  if (existing) {
    // CRITICAL SECURITY: Saving a profile MUST NEVER change approval_status or status
    await pool.execute(
      `UPDATE sellers SET business_name = ?, business_type = ?, gst_number = ?, license_number = ?,
       contact_email = ?, contact_phone = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?,
       postal_code = ?, country = ?, latitude = ?, longitude = ?
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
    // New sellers start as pending. Only an admin can approve a seller.
    await pool.execute(
      `INSERT INTO sellers
       (user_id, business_name, business_type, gst_number, license_number, contact_email, contact_phone,
        address_line1, address_line2, city, state, postal_code, country, latitude, longitude, approval_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'inactive')`,
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
  const updatedSeller = await findSellerByUserId(req.user.id);
  const msg = existing
    ? "Seller profile updated successfully"
    : "Seller application submitted successfully and is pending administrative review";
  return success(res, msg, updatedSeller, existing ? 200 : 201);
});

const getSellerProfile = asyncHandler(async (req, res) => {
  const seller = await findSellerByUserId(req.user.id);
  if (!seller) throw new AppError("Seller profile not found", 404);
  return success(res, "Seller profile fetched successfully", seller);
});

const uploadProductImage = asyncHandler(async (req, res) => {
  // Only approved sellers or admins can upload product images
  if (req.user.role !== "admin") {
    await requireApprovedSeller(req.user);
  }

  if (!req.file) throw new AppError("Product image is required", 400);
  const fileUrl = publicFileUrl(req, req.file);
  return success(res, "Product image uploaded successfully", {
    imageUrl: fileUrl,
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype
  }, 201);
});

const editProduct = asyncHandler(async (req, res) => {
  const product = await findProductById(req.params.id, true);
  if (!product) throw new AppError("Product not found", 404);

  const isAdmin = req.user.role === 'admin';
  const seller = await findSellerByUserId(req.user.id);
  const isOwner = seller && product.seller_id === seller.id;

  if (!isOwner && !isAdmin) {
    throw new AppError("You do not have permission to edit this product", 403);
  }

  if (!isAdmin) {
    if (req.user.status !== "active" || seller.approval_status !== "approved" || seller.status !== "active") {
      throw new AppError("Your seller account is not approved or is inactive", 403);
    }
    // Sellers CANNOT modify or unblock a product the admin blocked
    if (product.status === "blocked") {
      throw new AppError("This product was blocked by administrator and cannot be modified", 403);
    }
  }

  let imageUrl = req.body.imageUrl;
  if (req.file) {
    imageUrl = publicFileUrl(req, req.file);
  }

  let categoryId = undefined;
  if (req.body.categoryId !== undefined || req.body.category !== undefined) {
    categoryId = await resolveCategoryId(req.body.categoryId ?? req.body.category);
  }

  const sellingPrice = req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : (req.body.price !== undefined ? Number(req.body.price) : undefined);
  const mrp = req.body.mrp !== undefined ? Number(req.body.mrp) : (req.body.originalPrice !== undefined ? Number(req.body.originalPrice) : undefined);

  if (sellingPrice !== undefined && (Number.isNaN(sellingPrice) || sellingPrice < 0)) {
    throw new AppError("Selling price must be greater than or equal to 0", 400);
  }
  if (mrp !== undefined && (Number.isNaN(mrp) || mrp < 0)) {
    throw new AppError("MRP must be greater than or equal to 0", 400);
  }

  const effectiveSellingPrice = sellingPrice !== undefined ? sellingPrice : Number(product.selling_price);
  const effectiveMrp = mrp !== undefined ? mrp : Number(product.mrp);
  if (effectiveSellingPrice > effectiveMrp) {
    throw new AppError("Selling price cannot exceed MRP", 400);
  }

  let statusToSet = undefined;
  if (req.body.status !== undefined) {
    if (isAdmin) {
      if (!["active", "inactive", "blocked", "out_of_stock"].includes(req.body.status)) {
        throw new AppError("Invalid product status", 400);
      }
      statusToSet = req.body.status;
    } else {
      // Sellers may change ONLY 'active' and 'inactive'
      if (!["active", "inactive"].includes(req.body.status)) {
        throw new AppError("Sellers can only set status to 'active' or 'inactive'", 400);
      }
      statusToSet = req.body.status;
    }
  }

  const stockQuantity = req.body.stockQuantity !== undefined ? Number(req.body.stockQuantity) : undefined;
  if (stockQuantity !== undefined && (Number.isNaN(stockQuantity) || !Number.isInteger(stockQuantity) || stockQuantity < 0)) {
    throw new AppError("Stock quantity must be a non-negative integer", 400);
  }

  // Auto-mark out_of_stock if stock is set to 0 and seller left status as active
  if (stockQuantity === 0 && (!statusToSet || statusToSet === "active")) {
    statusToSet = "out_of_stock";
  }

  const updates = {
    category_id: categoryId,
    name: req.body.name ? String(req.body.name).trim() : undefined,
    description: req.body.description !== undefined ? req.body.description : undefined,
    sku: req.body.sku !== undefined ? req.body.sku : undefined,
    brand: req.body.brand !== undefined ? req.body.brand : undefined,
    mrp: mrp !== undefined ? mrp : undefined,
    selling_price: sellingPrice !== undefined ? sellingPrice : undefined,
    discount_percent: discountPercent(effectiveMrp, effectiveSellingPrice),
    stock_quantity: stockQuantity !== undefined ? stockQuantity : undefined,
    low_stock_threshold: req.body.lowStockThreshold !== undefined ? Number(req.body.lowStockThreshold) : undefined,
    expiry_date: req.body.expiryDate !== undefined ? req.body.expiryDate : undefined,
    manufacture_date: req.body.manufactureDate !== undefined ? req.body.manufactureDate : undefined,
    batch_number: req.body.batchNumber !== undefined ? req.body.batchNumber : undefined,
    product_type: req.body.productType !== undefined ? req.body.productType : undefined,
    image_url: imageUrl,
    status: statusToSet
  };

  const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (fields.length) {
    try {
      await pool.execute(
        `UPDATE products SET ${fields.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`,
        [...fields.map(([, value]) => value), req.params.id]
      );
      if (req.file && product.image_url && product.image_url.startsWith("/uploads/")) {
        deleteUploadedFile(product.image_url);
      }
    } catch (err) {
      if (req.file) {
        deleteUploadedFile(req.file.path);
      }
      throw err;
    }
  }

  clearHotCache();
  return success(res, "Product updated successfully", await findProductById(req.params.id, true));
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await findProductById(req.params.id, true);
  if (!product) throw new AppError("Product not found", 404);

  const seller = await findSellerByUserId(req.user.id);
  const isOwner = seller && product.seller_id === seller.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError("You do not have permission to delete this product", 403);
  }

  // Soft delete: set status to deleted (preserves orders history)
  await pool.execute("UPDATE products SET status = 'deleted' WHERE id = ?", [req.params.id]);
  clearHotCache();
  return success(res, "Product deleted successfully", null);
});

const updateInventory = asyncHandler(async (req, res) => {
  const seller = await requireApprovedSeller(req.user);
  const stockQuantity = Number(req.body.stockQuantity);
  if (Number.isNaN(stockQuantity) || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new AppError("Stock quantity must be a non-negative integer", 400);
  }

  const [existingProduct] = await pool.execute("SELECT status FROM products WHERE id = ? AND seller_id = ?", [req.params.id, seller.id]);
  if (!existingProduct[0]) throw new AppError("Product not found", 404);
  if (existingProduct[0].status === "blocked") {
    throw new AppError("Blocked product cannot be modified", 403);
  }

  const status = req.body.status || (stockQuantity === 0 ? "out_of_stock" : "active");
  const [result] = await pool.execute(
    "UPDATE products SET stock_quantity = ?, low_stock_threshold = COALESCE(?, low_stock_threshold), status = ? WHERE id = ? AND seller_id = ?",
    [stockQuantity, req.body.lowStockThreshold !== undefined ? Number(req.body.lowStockThreshold) : null, status, req.params.id, seller.id]
  );
  if (!result.affectedRows) throw new AppError("Product not found", 404);

  clearHotCache();
  return success(res, "Inventory updated successfully", await findProductById(req.params.id, true));
});

const sellerDashboard = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const [[productStats], [orderStats], [lowStock]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS totalProducts, SUM(stock_quantity) AS totalStock FROM products WHERE seller_id = ?", [seller.id]),
    pool.execute("SELECT COUNT(*) AS totalOrders, COALESCE(SUM(grand_total), 0) AS totalSales FROM orders WHERE seller_id = ?", [seller.id]),
    pool.execute("SELECT id, name, stock_quantity, low_stock_threshold FROM products WHERE seller_id = ? AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC LIMIT 10", [seller.id])
  ]);

  return success(res, "Seller dashboard fetched successfully", {
    seller,
    stats: {
      totalProducts: productStats[0].totalProducts,
      totalStock: productStats[0].totalStock || 0,
      totalOrders: orderStats[0].totalOrders,
      totalSales: orderStats[0].totalSales
    },
    lowStock: lowStock
  });
});

const listSellerProducts = asyncHandler(async (req, res) => {
  const seller = await requireSeller(req.user.id);
  const { page, limit } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  const safePage = Math.max(1, Number(page) || 1);
  const safeOffset = (safePage - 1) * safeLimit;

  const [[count], [rows]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM products WHERE seller_id = ?", [seller.id]),
    pool.query("SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?", [seller.id, safeLimit, safeOffset])
  ]);
  return success(res, "Seller products fetched successfully", rows, 200, buildMeta(count[0].total, safePage, safeLimit));
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
