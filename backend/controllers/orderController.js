const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");
const { findSellerByUserId } = require("../models/sellerModel");
const { clearHotCache } = require("./productController");

function orderNumber() {
  return `BYL${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

const createOrder = asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { sellerId, locationId = null, items, notes = null } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError("Order items are required", 400);
    }

    if (!sellerId || Number.isNaN(Number(sellerId))) {
      throw new AppError("Invalid sellerId", 400);
    }

    // IDOR Check on locationId: ensure location belongs to the ordering user
    if (locationId) {
      const [locations] = await connection.execute(
        "SELECT id FROM locations WHERE id = ? AND user_id = ? LIMIT 1",
        [locationId, req.user.id]
      );
      if (locations.length === 0) {
        throw new AppError("Delivery address not found or does not belong to you", 404);
      }
    }

    // Merge duplicate lines for the same product (sum quantities) before validating stock
    const mergedMap = new Map();
    for (const item of items) {
      const pId = Number(item.productId);
      const qty = Number(item.quantity);
      if (!Number.isInteger(pId) || pId <= 0) {
        throw new AppError("Invalid product ID in order items", 400);
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new AppError("Item quantity must be a positive integer", 400);
      }
      if (mergedMap.has(pId)) {
        mergedMap.get(pId).quantity += qty;
      } else {
        mergedMap.set(pId, { productId: pId, quantity: qty });
      }
    }
    const mergedItems = Array.from(mergedMap.values());
    const productIds = mergedItems.map((item) => item.productId);

    // Verify products belong to seller, and require: product active, seller approved, seller active, and seller user active
    const placeholders = productIds.map(() => "?").join(",");
    const [products] = await connection.execute(
      `SELECT p.id, p.seller_id, p.name, p.selling_price, p.stock_quantity
       FROM products p
       JOIN sellers s ON s.id = p.seller_id
       JOIN users u ON u.id = s.user_id
       WHERE p.id IN (${placeholders})
         AND p.seller_id = ?
         AND p.status = 'active'
         AND s.approval_status = 'approved'
         AND s.status = 'active'
         AND u.status = 'active'
       FOR UPDATE`,
      [...productIds, sellerId]
    );

    if (products.length !== productIds.length) {
      throw new AppError("One or more products are unavailable, out of stock, or from an unapproved seller", 400);
    }

    // Recompute totals on the server from database prices and refuse non-positive prices
    let subtotal = 0;
    const itemRows = mergedItems.map((item) => {
      const product = products.find((row) => row.id === item.productId);
      const unitPrice = Number(product.selling_price);

      if (Number.isNaN(unitPrice) || unitPrice <= 0) {
        throw new AppError(`Product '${product.name}' has an invalid or non-positive price`, 400);
      }
      if (product.stock_quantity < item.quantity) {
        throw new AppError(`${product.name} has insufficient stock (available: ${product.stock_quantity})`, 400);
      }

      const total = unitPrice * item.quantity;
      subtotal += total;
      return { product, quantity: item.quantity, unitPrice, total };
    });

    const deliveryFee = subtotal >= 499 ? 0 : 30;
    const taxTotal = 0;
    const discountTotal = 0;
    const grandTotal = subtotal + deliveryFee + taxTotal - discountTotal;

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (order_number, user_id, seller_id, location_id, subtotal, discount_total, delivery_fee, tax_total, grand_total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber(), req.user.id, sellerId, locationId, subtotal, discountTotal, deliveryFee, taxTotal, grandTotal, notes]
    );

    for (const row of itemRows) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderResult.insertId, row.product.id, row.product.name, row.quantity, row.unitPrice, row.total]
      );
      await connection.execute(
        "UPDATE products SET stock_quantity = stock_quantity - ?, status = IF(stock_quantity <= 0, 'out_of_stock', status) WHERE id = ?",
        [row.quantity, row.product.id]
      );
    }

    await connection.commit();
    clearHotCache();

    const [orders] = await pool.execute("SELECT * FROM orders WHERE id = ?", [orderResult.insertId]);
    return success(res, "Order created successfully", orders[0], 201);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

const getOrders = asyncHandler(async (req, res) => {
  const { page, limit } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  const safePage = Math.max(1, Number(page) || 1);
  const safeOffset = (safePage - 1) * safeLimit;

  const params = req.user.role === "admin" ? [] : [req.user.id];
  const where = req.user.role === "admin" ? "1=1" : "o.user_id = ?";

  const [[count], [orders]] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total FROM orders o WHERE ${where}`, params),
    pool.execute(
      `SELECT o.*, s.business_name AS seller_name
       FROM orders o JOIN sellers s ON s.id = o.seller_id
       WHERE ${where}
       ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    )
  ]);
  return success(res, "Orders fetched successfully", orders, 200, buildMeta(count[0].total, safePage, safeLimit));
});

const cancelOrder = asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const params = req.user.role === "admin" ? [req.params.id] : [req.params.id, req.user.id];
    const userWhere = req.user.role === "admin" ? "WHERE id = ?" : "WHERE id = ? AND user_id = ?";

    const [orders] = await connection.execute(`SELECT * FROM orders ${userWhere} FOR UPDATE`, params);
    const order = orders[0];
    if (!order) throw new AppError("Order not found", 404);
    if (!["pending", "confirmed"].includes(order.status)) {
      throw new AppError("Order can no longer be cancelled in its current state", 400);
    }

    const [items] = await connection.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [order.id]);
    for (const item of items) {
      await connection.execute(
        "UPDATE products SET stock_quantity = stock_quantity + ?, status = IF(status = 'out_of_stock', 'active', status) WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    await connection.execute(
      "UPDATE orders SET status = 'cancelled', cancelled_reason = ? WHERE id = ?",
      [req.body.reason || "Customer cancelled order", order.id]
    );

    await connection.commit();
    clearHotCache();
    return success(res, "Order cancelled successfully and stock restored", null);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

const trackOrder = asyncHandler(async (req, res) => {
  const [orders] = await pool.execute(
    `SELECT o.*, s.business_name AS seller_name
     FROM orders o JOIN sellers s ON s.id = o.seller_id
     WHERE o.id = ? AND (o.user_id = ? OR ? = 'admin') LIMIT 1`,
    [req.params.id, req.user.id, req.user.role]
  );
  if (!orders[0]) throw new AppError("Order not found", 404);

  const [items] = await pool.execute("SELECT * FROM order_items WHERE order_id = ?", [req.params.id]);
  return success(res, "Order tracking fetched successfully", {
    order: orders[0],
    items,
    timeline: [
      { status: "pending", completed: true },
      { status: "confirmed", completed: ["confirmed", "packed", "shipped", "delivered"].includes(orders[0].status) },
      { status: "packed", completed: ["packed", "shipped", "delivered"].includes(orders[0].status) },
      { status: "shipped", completed: ["shipped", "delivered"].includes(orders[0].status) },
      { status: "delivered", completed: orders[0].status === "delivered" }
    ]
  });
});

// Seller Order Management
const getSellerOrders = asyncHandler(async (req, res) => {
  const seller = await findSellerByUserId(req.user.id);
  if (!seller && req.user.role !== "admin") {
    throw new AppError("Seller profile not found", 404);
  }

  const sellerId = req.user.role === "admin" && req.query.sellerId ? Number(req.query.sellerId) : seller.id;
  const { page, limit } = getPagination(req.query);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  const safePage = Math.max(1, Number(page) || 1);
  const safeOffset = (safePage - 1) * safeLimit;

  const [[count], [orders]] = await Promise.all([
    pool.execute("SELECT COUNT(*) AS total FROM orders WHERE seller_id = ?", [sellerId]),
    pool.execute(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.seller_id = ?
       ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [sellerId, safeLimit, safeOffset]
    )
  ]);

  if (orders.length > 0) {
    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => "?").join(",");
    const [itemRows] = await pool.execute(
      `SELECT oi.*, p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (${placeholders})`,
      orderIds
    );
    const itemsByOrder = new Map();
    for (const row of itemRows) {
      if (!itemsByOrder.has(row.order_id)) itemsByOrder.set(row.order_id, []);
      itemsByOrder.get(row.order_id).push(row);
    }
    for (const order of orders) {
      order.items = itemsByOrder.get(order.id) || [];
    }
  }

  return success(res, "Seller orders fetched successfully", orders, 200, buildMeta(count[0].total, safePage, safeLimit));
});

const updateSellerOrderStatus = asyncHandler(async (req, res) => {
  const seller = await findSellerByUserId(req.user.id);
  const isAdmin = req.user.role === "admin";
  if (!seller && !isAdmin) {
    throw new AppError("Seller profile not found", 404);
  }

  const rawStatus = req.body.status;
  const statusMap = { ready: "packed", completed: "delivered", rejected: "cancelled" };
  const status = statusMap[rawStatus] || rawStatus;
  const reason = req.body.reason;

  const allowedStatuses = ["confirmed", "packed", "shipped", "delivered", "cancelled"];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(`Invalid status. Allowed values: confirmed, ready/packed, completed/delivered, rejected/cancelled`, 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sellerFilter = isAdmin ? "" : "AND seller_id = ?";
    const params = isAdmin ? [req.params.id] : [req.params.id, seller.id];

    const [orders] = await connection.execute(
      `SELECT * FROM orders WHERE id = ? ${sellerFilter} FOR UPDATE`,
      params
    );
    const order = orders[0];
    if (!order) throw new AppError("Order not found", 404);

    // State machine check
    const current = order.status;
    const validTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["packed", "cancelled"],
      packed: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: []
    };

    if (!isAdmin && !validTransitions[current]?.includes(status)) {
      throw new AppError(`Cannot transition order from '${current}' to '${status}'`, 400);
    }

    // If order is cancelled by seller/admin, restore stock
    if (status === "cancelled" && current !== "cancelled") {
      const [items] = await connection.execute(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
        [order.id]
      );
      for (const item of items) {
        await connection.execute(
          "UPDATE products SET stock_quantity = stock_quantity + ?, status = IF(status = 'out_of_stock', 'active', status) WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }
    }

    await connection.execute(
      "UPDATE orders SET status = ?, cancelled_reason = IF(? = 'cancelled', COALESCE(?, cancelled_reason), cancelled_reason) WHERE id = ?",
      [status, status, reason || "Order rejected/cancelled by shop", order.id]
    );

    await connection.commit();
    clearHotCache();

    const [updated] = await pool.execute("SELECT * FROM orders WHERE id = ?", [order.id]);
    return success(res, `Order marked as ${status}`, updated[0]);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

module.exports = {
  createOrder,
  getOrders,
  cancelOrder,
  trackOrder,
  getSellerOrders,
  updateSellerOrderStatus
};
