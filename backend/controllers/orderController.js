const { pool } = require("../config/db");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildMeta } = require("../utils/pagination");

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

    const productIds = items.map((item) => Number(item.productId)).filter((id) => Number.isInteger(id) && id > 0);
    if (productIds.length !== items.length) {
      throw new AppError("Invalid order items", 400);
    }

    if (!sellerId || Number.isNaN(Number(sellerId))) {
      throw new AppError("Invalid sellerId", 400);
    }

    const placeholders = productIds.map(() => "?").join(",");
    const [products] = await connection.execute(
      `SELECT id, seller_id, name, selling_price, stock_quantity FROM products
       WHERE id IN (${placeholders}) AND seller_id = ? AND status = 'active' FOR UPDATE`,
      [...productIds, sellerId]
    );

    if (products.length !== productIds.length) throw new AppError("One or more products are unavailable", 400);

    let subtotal = 0;
    const itemRows = items.map((item) => {
      const product = products.find((row) => row.id === Number(item.productId));
      if (product.stock_quantity < Number(item.quantity)) {
        throw new AppError(`${product.name} has insufficient stock`, 400);
      }
      const total = Number(product.selling_price) * Number(item.quantity);
      subtotal += total;
      return { product, quantity: Number(item.quantity), total };
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
        [orderResult.insertId, row.product.id, row.product.name, row.quantity, row.product.selling_price, row.total]
      );
      await connection.execute(
        "UPDATE products SET stock_quantity = stock_quantity - ?, status = IF(stock_quantity - ? <= 0, 'out_of_stock', status) WHERE id = ?",
        [row.quantity, row.quantity, row.product.id]
      );
    }

    await connection.commit();
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
  const { page, limit, offset } = getPagination(req.query);
  const params = req.user.role === "admin" ? [] : [req.user.id];
  const where = req.user.role === "admin" ? "1=1" : "o.user_id = ?";
  const [[count], [orders]] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total FROM orders o WHERE ${where}`, params),
    pool.execute(
      `SELECT o.*, s.business_name AS seller_name
       FROM orders o JOIN sellers s ON s.id = o.seller_id
       WHERE ${where}
       ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  return success(res, "Orders fetched successfully", orders, 200, buildMeta(count[0].total, page, limit));
});

const cancelOrder = asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute("SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE", [req.params.id, req.user.id]);
    const order = orders[0];
    if (!order) throw new AppError("Order not found", 404);
    if (!["pending", "confirmed"].includes(order.status)) throw new AppError("Order can no longer be cancelled", 400);

    const [items] = await connection.execute("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [order.id]);
    for (const item of items) {
      await connection.execute(
        "UPDATE products SET stock_quantity = stock_quantity + ?, status = IF(status = 'out_of_stock', 'active', status) WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    await connection.execute(
      "UPDATE orders SET status = 'cancelled', cancelled_reason = ? WHERE id = ?",
      [req.body.reason || null, order.id]
    );
    await connection.commit();
    return success(res, "Order cancelled successfully", null);
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

module.exports = {
  createOrder,
  getOrders,
  cancelOrder,
  trackOrder
};
