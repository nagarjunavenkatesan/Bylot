const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { createTestUser, createTestSeller, createTestProduct, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");

describe("Seller and Product Rule Tests", () => {
  const testEmails = [];
  const testProducts = [];
  const testSellers = [];

  afterAll(async () => {
    await cleanTestData(testEmails, testProducts, [], testSellers);
  });

  test("A new customer who posts a product is rejected (not an approved seller)", async () => {
    const customer = await createTestUser({ email: `plaincust_${Date.now()}@example.com`, role: "customer" });
    testEmails.push(customer.email);
    const token = signAccessToken(customer);

    const res = await request(app)
      .post("/api/sellers/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Unauthorized Apple",
        categoryId: 1,
        price: 50,
        mrp: 100,
        stockQuantity: 10
      });

    expect(res.status).toBe(403);
  });

  test("A rejected seller cannot re-approve themselves and cannot create products", async () => {
    const user = await createTestUser({ email: `rejseller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user, approvalStatus: "rejected", status: "inactive" });
    testEmails.push(user.email);
    testSellers.push(seller.id);
    const token = signAccessToken(user);

    // Try to self-approve via profile update
    const profileRes = await request(app)
      .post("/api/sellers/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        businessName: "Hacked Approval Mart",
        approvalStatus: "approved"
      });
    expect(profileRes.status).toBe(200);

    // Verify approval_status is STILL rejected
    const [rows] = await pool.execute("SELECT approval_status FROM sellers WHERE id = ?", [seller.id]);
    expect(rows[0].approval_status).toBe("rejected");

    // Cannot create product
    const prodRes = await request(app)
      .post("/api/sellers/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Should Fail Product",
        categoryId: 1,
        sellingPrice: 40,
        mrp: 80,
        stockQuantity: 5
      });
    expect(prodRes.status).toBe(403);
  });

  test("A seller cannot unblock an admin-blocked product", async () => {
    const user = await createTestUser({ email: `unblock_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user, approvalStatus: "approved", status: "active" });
    const product = await createTestProduct({ sellerId: seller.id, status: "blocked" });
    testEmails.push(user.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);
    const token = signAccessToken(user);

    const res = await request(app)
      .put(`/api/sellers/products/${product.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "active"
      });

    expect(res.status).toBe(403);
    const [rows] = await pool.execute("SELECT status FROM products WHERE id = ?", [product.id]);
    expect(rows[0].status).toBe("blocked");
  });

  test("Products of rejected or blocked sellers never appear in public listing", async () => {
    const user = await createTestUser({ email: `hidden_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user, approvalStatus: "rejected", status: "inactive" });
    const product = await createTestProduct({ sellerId: seller.id, name: "Secret Hidden Item", status: "active" });
    testEmails.push(user.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);

    // Public list
    const listRes = await request(app).get("/api/products");
    expect(listRes.status).toBe(200);
    const foundInList = listRes.body.data.some(p => p.id === product.id);
    expect(foundInList).toBe(false);

    // Public detail
    const detailRes = await request(app).get(`/api/products/${product.id}`);
    expect(detailRes.status).toBe(404);
  });

  test("Negative, non-numeric, above-MRP prices and negative stock are rejected with 4xx", async () => {
    const user = await createTestUser({ email: `validator_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user, approvalStatus: "approved", status: "active" });
    testEmails.push(user.email);
    testSellers.push(seller.id);
    const token = signAccessToken(user);

    // Negative price
    const negPrice = await request(app)
      .post("/api/sellers/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Neg Price Item", sellingPrice: -50, mrp: 100, stockQuantity: 5 });
    expect(negPrice.status).toBeGreaterThanOrEqual(400);
    expect(negPrice.status).toBeLessThan(500);

    // Above MRP
    const aboveMrp = await request(app)
      .post("/api/sellers/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Above MRP Item", sellingPrice: 150, mrp: 100, stockQuantity: 5 });
    expect(aboveMrp.status).toBeGreaterThanOrEqual(400);
    expect(aboveMrp.status).toBeLessThan(500);

    // Negative stock
    const negStock = await request(app)
      .post("/api/sellers/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Neg Stock Item", sellingPrice: 50, mrp: 100, stockQuantity: -5 });
    expect(negStock.status).toBeGreaterThanOrEqual(400);
    expect(negStock.status).toBeLessThan(500);

    // Stock 0 stays 0
    const zeroStock = await request(app)
      .post("/api/sellers/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Zero Stock Item", categoryId: 1, sellingPrice: 50, mrp: 100, stockQuantity: 0 });
    expect(zeroStock.status).toBe(201);
    expect(zeroStock.body.data.stock_quantity).toBe(0);
    testProducts.push(zeroStock.body.data.id);
  });

  test("Soft delete of a product that has existing orders preserves order history and sets status to deleted", async () => {
    const sellerUser = await createTestUser({ email: `softdel_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    const product = await createTestProduct({ sellerId: seller.id, price: 90, mrp: 150, stock: 10 });
    const buyer = await createTestUser({ email: `softdel_buyer_${Date.now()}@example.com` });

    testEmails.push(sellerUser.email, buyer.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);

    const buyerToken = signAccessToken(buyer);
    const sellerToken = signAccessToken(sellerUser);

    // Place an order on the product
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        sellerId: seller.id,
        items: [{ productId: product.id, quantity: 1 }]
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    // Seller deletes product with existing orders
    const delRes = await request(app)
      .delete(`/api/sellers/products/${product.id}`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(delRes.status).toBe(200);

    // Product must be soft-deleted, not hard-deleted
    const [prodRows] = await pool.execute("SELECT status FROM products WHERE id = ?", [product.id]);
    expect(prodRows.length).toBe(1);
    expect(prodRows[0].status).toBe("deleted");

    // Order and order items must still exist intact
    const [orderRows] = await pool.execute("SELECT id, status FROM orders WHERE id = ?", [orderId]);
    expect(orderRows.length).toBe(1);
    const [itemRows] = await pool.execute("SELECT id, product_name FROM order_items WHERE order_id = ?", [orderId]);
    expect(itemRows.length).toBe(1);
  });

  test("Upload quota enforcement: exceeding daily quota returns 429", async () => {
    const sellerUser = await createTestUser({ email: `quota_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    testEmails.push(sellerUser.email);
    testSellers.push(seller.id);
    const sellerToken = signAccessToken(sellerUser);

    const { userUploadQuotas } = require("../middleware/uploadMiddleware");
    // Artificially max out user's quota for the day
    userUploadQuotas.set(String(sellerUser.id), {
      count: 35,
      totalBytes: 50 * 1024 * 1024,
      resetAt: Date.now() + 60000
    });

    const validPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const uploadRes = await request(app)
      .post("/api/sellers/uploads/product-image")
      .set("Authorization", `Bearer ${sellerToken}`)
      .attach("productImage", validPng, "quota_test.png");

    expect(uploadRes.status).toBe(429);
    expect(uploadRes.body.message).toMatch(/upload quota exceeded/i);
  });
});
