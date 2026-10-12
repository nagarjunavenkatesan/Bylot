const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { createTestUser, createTestSeller, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");

describe("Admin Expired Products Management System Tests", () => {
  const testEmails = [];
  const testProducts = [];
  const testSellers = [];
  let adminUser;
  let adminToken;
  let normalUser;
  let normalToken;
  let sellerObj;

  beforeAll(async () => {
    // 1. Create Admin
    adminUser = await createTestUser({
      email: `admin_exp_${Date.now()}@example.com`,
      role: "admin"
    });
    testEmails.push(adminUser.email);
    adminToken = signAccessToken(adminUser);

    // 2. Create Normal User
    normalUser = await createTestUser({
      email: `customer_exp_${Date.now()}@example.com`,
      role: "customer"
    });
    testEmails.push(normalUser.email);
    normalToken = signAccessToken(normalUser);

    // 3. Create Seller
    const sellerUser = await createTestUser({
      email: `seller_exp_${Date.now()}@example.com`,
      role: "seller"
    });
    testEmails.push(sellerUser.email);
    sellerObj = await createTestSeller({ user: sellerUser });
    testSellers.push(sellerObj.id);
  });

  afterAll(async () => {
    await cleanTestData(testEmails, testProducts, [], testSellers);
  });

  async function createProductWithExpiry(name, expiryDate, status = "active") {
    const [res] = await pool.execute(
      `INSERT INTO products (product_item_id, seller_id, category_id, name, slug, mrp, selling_price, stock_quantity, status, expiry_date)
       VALUES (?, ?, 1, ?, ?, 100, 50, 10, ?, ?)`,
      [
        `PRD${Date.now()}${Math.floor(Math.random() * 10000)}`,
        sellerObj.id,
        name,
        `slug-${Date.now()}-${Math.random()}`,
        status,
        expiryDate
      ]
    );
    testProducts.push(res.insertId);
    return res.insertId;
  }

  test("1. Unauthenticated request to /api/admin/products/expired is rejected with 401", async () => {
    const res = await request(app).get("/api/admin/products/expired");
    expect(res.status).toBe(401);
  });

  test("2. Normal customer cannot access expired products endpoint (rejected with 403)", async () => {
    const res = await request(app)
      .get("/api/admin/products/expired")
      .set("Authorization", `Bearer ${normalToken}`);
    expect(res.status).toBe(403);
  });

  test("3. Admin can retrieve expired products and authoritative count", async () => {
    const exp1 = await createProductWithExpiry("Expired Milk 1", "2020-01-01");
    const exp2 = await createProductWithExpiry("Expired Cheese 2", "2021-06-15");
    const act1 = await createProductWithExpiry("Fresh Apple 3", "2099-12-31");

    const res = await request(app)
      .get("/api/admin/products/expired")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.authoritativeTotal).toBeGreaterThanOrEqual(2);

    const returnedIds = res.body.data.map(p => p.id);
    expect(returnedIds).toContain(exp1);
    expect(returnedIds).toContain(exp2);
    expect(returnedIds).not.toContain(act1);

    // Test count endpoint
    const countRes = await request(app)
      .get("/api/admin/products/expired/count")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(countRes.status).toBe(200);
    expect(countRes.body.data.count).toBeGreaterThanOrEqual(2);
  });

  test("4. Delete Selected permanently removes only eligible expired products and returns accurate deletedCount", async () => {
    const expA = await createProductWithExpiry("Expired Yogurt A", "2020-02-02");
    const expB = await createProductWithExpiry("Expired Juice B", "2020-03-03");
    const expC = await createProductWithExpiry("Expired Bread C", "2020-04-04");

    const delRes = await request(app)
      .delete("/api/admin/products/expired/selected")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productIds: [expA, expB] });

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.data.deletedCount).toBe(2);

    // Verify in DB that expA and expB are soft-deleted ('deleted')
    const [rowsA] = await pool.query("SELECT status FROM products WHERE id = ?", [expA]);
    const [rowsB] = await pool.query("SELECT status FROM products WHERE id = ?", [expB]);
    const [rowsC] = await pool.query("SELECT status FROM products WHERE id = ?", [expC]);

    expect(rowsA[0].status).toBe("deleted");
    expect(rowsB[0].status).toBe("deleted");
    expect(rowsC[0].status).toBe("active"); // expC remains
  });

  test("5. Active or non-expired product cannot be deleted via expired endpoint", async () => {
    const activeProd = await createProductWithExpiry("Active Orange", "2099-05-05");

    const delRes = await request(app)
      .delete("/api/admin/products/expired/selected")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productIds: [activeProd] });

    // Must reject attempt to delete active products
    expect(delRes.status).toBe(400);

    // Active product status remains untouched
    const [rows] = await pool.query("SELECT status FROM products WHERE id = ?", [activeProd]);
    expect(rows[0].status).toBe("active");
  });

  test("6. Mixed selection (expired + active) deletes ONLY expired products and protects active products", async () => {
    const expProd = await createProductWithExpiry("Expired Mixed Jam", "2020-01-01");
    const actProd = await createProductWithExpiry("Active Mixed Honey", "2099-01-01");

    const delRes = await request(app)
      .delete("/api/admin/products/expired/selected")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productIds: [expProd, actProd] });

    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deletedCount).toBe(1);
    expect(delRes.body.data.skippedCount).toBe(1);

    const [rowsExp] = await pool.query("SELECT status FROM products WHERE id = ?", [expProd]);
    const [rowsAct] = await pool.query("SELECT status FROM products WHERE id = ?", [actProd]);
    expect(rowsExp[0].status).toBe("deleted");
    expect(rowsAct[0].status).toBe("active");
  });

  test("7. Single product deletion endpoint enforces expiry check", async () => {
    const expSingle = await createProductWithExpiry("Expired Butter Single", "2020-05-05");
    const actSingle = await createProductWithExpiry("Active Butter Single", "2099-05-05");

    // Attempting single delete on active product fails
    const failRes = await request(app)
      .delete(`/api/admin/products/expired/${actSingle}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(failRes.status).toBe(400);

    // Single delete on expired product succeeds
    const successRes = await request(app)
      .delete(`/api/admin/products/expired/${expSingle}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.data.deletedCount).toBe(1);

    const [rows] = await pool.query("SELECT status FROM products WHERE id = ?", [expSingle]);
    expect(rows[0].status).toBe("deleted");
  });

  test("8. Pagination does NOT limit Delete All: deletes across all pages server-side", async () => {
    // Clean existing test expired products first
    await pool.query("UPDATE products SET status = 'deleted' WHERE expiry_date IS NOT NULL AND expiry_date < CURDATE()");

    // Create 25 expired products (exceeding default page size of 20)
    const batchIds = [];
    for (let i = 1; i <= 25; i++) {
      const id = await createProductWithExpiry(`Bulk Expired Item ${i}`, "2020-01-01");
      batchIds.push(id);
    }

    // Verify page 1 only returns 20 items with total = 25
    const page1Res = await request(app)
      .get("/api/admin/products/expired?limit=20&page=1")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(page1Res.status).toBe(200);
    expect(page1Res.body.data.length).toBe(20);
    expect(page1Res.body.meta.total).toBe(25);

    // Delete All Expired Products
    const delAllRes = await request(app)
      .delete("/api/admin/products/expired")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(delAllRes.status).toBe(200);
    // Must delete all 25 across both pages!
    expect(delAllRes.body.data.deletedCount).toBe(25);

    // Authoritative expired count is now 0
    const countCheck = await request(app)
      .get("/api/admin/products/expired/count")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(countCheck.body.data.count).toBe(0);
  });

  test("9. Deleted products disappear from public listings and SEO route returns 404", async () => {
    const testExp = await createProductWithExpiry("Disappearing Biscuit", "2020-01-01");

    // Before deletion: admin deletes it
    await request(app)
      .delete(`/api/admin/products/expired/${testExp}`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Public API query
    const publicRes = await request(app).get(`/api/products/${testExp}`);
    expect(publicRes.status).toBe(404);

    // SEO HTML route check
    const seoRes = await request(app).get(`/product/${testExp}`);
    expect(seoRes.status).toBe(404);
  });

  test("10. Invalid request payloads are rejected safely", async () => {
    const res1 = await request(app)
      .delete("/api/admin/products/expired/selected")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productIds: [] });
    expect(res1.status).toBe(422);

    const res2 = await request(app)
      .delete("/api/admin/products/expired/selected")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ productIds: ["malicious'; DROP TABLE products;--"] });
    expect(res2.status).toBe(422);
  });
});
