const { pool } = require("../config/db");
const { hashPassword } = require("../utils/password");

if (process.env.NODE_ENV === "production") {
  console.error("[TEST GUARD] FATAL: Tests cannot be run in production!");
  process.exit(1);
}

const currentDb = process.env.DB_NAME || "";
if (!currentDb.endsWith("_test")) {
  console.error(`[TEST GUARD] FATAL: Tests must use a database ending in '_test'. Current: "${currentDb}"`);
  process.exit(1);
}

async function createTestUser({ email, role = "customer", status = "active", emailVerified = true, password = "Password@123!" }) {
  const passwordHash = await hashPassword(password);
  const [res] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, role, status, email_verified_at, token_version)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      `Test User ${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      email.toLowerCase().trim(),
      passwordHash,
      role,
      status,
      emailVerified ? new Date() : null
    ]
  );
  const [rows] = await pool.execute("SELECT * FROM users WHERE id = ?", [res.insertId]);
  return rows[0];
}

async function createTestSeller({ user, approvalStatus = "approved", status = "active" }) {
  const [res] = await pool.execute(
    `INSERT INTO sellers (user_id, business_name, approval_status, status, city, latitude, longitude)
     VALUES (?, ?, ?, ?, 'Chennai', 13.0827, 80.2707)`,
    [user.id, `Seller ${Date.now()}_${Math.floor(Math.random() * 1000)}`, approvalStatus, status]
  );
  const [rows] = await pool.execute("SELECT * FROM sellers WHERE id = ?", [res.insertId]);
  return rows[0];
}

async function createTestProduct({ sellerId, categoryId = 1, name = "Test Apple", price = 50, mrp = 100, stock = 10, status = "active" }) {
  const [res] = await pool.execute(
    `INSERT INTO products (product_item_id, seller_id, category_id, name, slug, mrp, selling_price, stock_quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`PRD${Date.now()}${Math.floor(Math.random()*1000)}`, sellerId, categoryId, name, `slug-${Date.now()}-${Math.random()}`, mrp, price, stock, status]
  );
  const [rows] = await pool.execute("SELECT * FROM products WHERE id = ?", [res.insertId]);
  return rows[0];
}

async function cleanTestData(emails = [], productIds = [], orderIds = [], sellerIds = []) {
  if (orderIds.length > 0) {
    const ph = orderIds.map(() => "?").join(",");
    await pool.execute(`DELETE FROM order_items WHERE order_id IN (${ph})`, orderIds);
    await pool.execute(`DELETE FROM orders WHERE id IN (${ph})`, orderIds);
  }
  if (productIds.length > 0) {
    const ph = productIds.map(() => "?").join(",");
    await pool.execute(`DELETE FROM order_items WHERE product_id IN (${ph})`, productIds);
    await pool.execute(`DELETE FROM products WHERE id IN (${ph})`, productIds);
  }
  if (sellerIds.length > 0) {
    const ph = sellerIds.map(() => "?").join(",");
    await pool.execute(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE seller_id IN (${ph}))`, sellerIds);
    await pool.execute(`DELETE FROM orders WHERE seller_id IN (${ph})`, sellerIds);
    await pool.execute(`DELETE FROM products WHERE seller_id IN (${ph})`, sellerIds);
    await pool.execute(`DELETE FROM sellers WHERE id IN (${ph})`, sellerIds);
  }
  if (emails.length > 0) {
    const ph = emails.map(() => "?").join(",");
    await pool.execute(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email IN (${ph}))`, emails);
    await pool.execute(`DELETE FROM users WHERE email IN (${ph})`, emails);
  }
}

if (typeof afterAll === "function") {
  afterAll(async () => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });
}

module.exports = {
  createTestUser,
  createTestSeller,
  createTestProduct,
  cleanTestData
};
