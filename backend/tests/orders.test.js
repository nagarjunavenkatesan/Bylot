const request = require("supertest");
const app = require("../app");
const { pool } = require("../config/db");
const { createTestUser, createTestSeller, createTestProduct, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");

describe("Order Rules and Concurrency Tests", () => {
  const testEmails = [];
  const testProducts = [];
  const testOrders = [];
  const testSellers = [];

  afterAll(async () => {
    await cleanTestData(testEmails, testProducts, testOrders, testSellers);
  });

  test("Cannot read, track or cancel another user's order (404)", async () => {
    const sellerUser = await createTestUser({ email: `ord_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    const product = await createTestProduct({ sellerId: seller.id, price: 100, mrp: 150, stock: 20 });

    const victim = await createTestUser({ email: `victim_${Date.now()}@example.com` });
    const attacker = await createTestUser({ email: `attacker_${Date.now()}@example.com` });
    testEmails.push(sellerUser.email, victim.email, attacker.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);

    const victimToken = signAccessToken(victim);
    const attackerToken = signAccessToken(attacker);

    // Victim creates order
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${victimToken}`)
      .send({
        sellerId: seller.id,
        items: [{ productId: product.id, quantity: 1 }]
      });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id;
    testOrders.push(orderId);

    // Attacker attempts to read order
    const readRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${attackerToken}`);
    expect(readRes.status).toBe(404);

    // Attacker attempts to track order
    const trackRes = await request(app)
      .get(`/api/orders/${orderId}/track`)
      .set("Authorization", `Bearer ${attackerToken}`);
    expect(trackRes.status).toBe(404);

    // Attacker attempts to cancel order
    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ reason: "Malicious cancellation" });
    expect(cancelRes.status).toBe(404);
  }, 30000);

  test("Duplicate product lines in cart are merged and total matches database prices", async () => {
    const sellerUser = await createTestUser({ email: `dup_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    const product = await createTestProduct({ sellerId: seller.id, price: 50, mrp: 100, stock: 10 });
    const customer = await createTestUser({ email: `dup_cust_${Date.now()}@example.com` });
    testEmails.push(sellerUser.email, customer.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);
    const custToken = signAccessToken(customer);

    // Send duplicate product lines: 2 of product, then 3 of product
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${custToken}`)
      .send({
        sellerId: seller.id,
        items: [
          { productId: product.id, quantity: 2 },
          { productId: product.id, quantity: 3 }
        ]
      });

    expect(orderRes.status).toBe(201);
    const order = orderRes.body.data;
    testOrders.push(order.id);

    // Total should be 5 items * 50 = 250 + delivery fee (30) = 280
    expect(Number(order.subtotal ?? order.total_amount)).toBe(250);
    expect(Number(order.grand_total)).toBe(280);

    // Stock should be reduced by merged 5 items (10 - 5 = 5)
    const [rows] = await pool.execute("SELECT stock_quantity FROM products WHERE id = ?", [product.id]);
    expect(rows[0].stock_quantity).toBe(5);
  });

  test("15 parallel orders for 1 item in stock gives exactly 1 success", async () => {
    const sellerUser = await createTestUser({ email: `race_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    // Product has EXACTLY 1 item in stock
    const product = await createTestProduct({ sellerId: seller.id, price: 100, mrp: 150, stock: 1 });
    testEmails.push(sellerUser.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);

    // Create 15 distinct customers
    const customers = [];
    for (let i = 0; i < 15; i++) {
      const u = await createTestUser({ email: `race_buyer_${i}_${Date.now()}@example.com` });
      customers.push(u);
      testEmails.push(u.email);
    }

    // Fire 15 orders simultaneously
    const promises = customers.map(u => {
      const token = signAccessToken(u);
      return request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          sellerId: seller.id,
          items: [{ productId: product.id, quantity: 1 }]
        });
    });

    const results = await Promise.all(promises);
    const successes = results.filter(r => r.status === 201);
    const failures = results.filter(r => r.status !== 201);

    for (const s of successes) {
      testOrders.push(s.body.data.id);
    }

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(14);

    // Stock must be 0
    const [prodRows] = await pool.execute("SELECT stock_quantity FROM products WHERE id = ?", [product.id]);
    expect(prodRows[0].stock_quantity).toBe(0);
  }, 30000);

  test("Cancel restores stock and is allowed only in valid states", async () => {
    const sellerUser = await createTestUser({ email: `canc_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    const product = await createTestProduct({ sellerId: seller.id, price: 50, mrp: 100, stock: 10 });
    const customer = await createTestUser({ email: `canc_cust_${Date.now()}@example.com` });
    testEmails.push(sellerUser.email, customer.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);
    const token = signAccessToken(customer);

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sellerId: seller.id,
        items: [{ productId: product.id, quantity: 4 }]
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;
    testOrders.push(orderId);

    // Stock reduced to 6
    let [rows] = await pool.execute("SELECT stock_quantity FROM products WHERE id = ?", [product.id]);
    expect(rows[0].stock_quantity).toBe(6);

    // Cancel order
    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Changed mind" });
    expect(cancelRes.status).toBe(200);

    // Stock restored to 10
    [rows] = await pool.execute("SELECT stock_quantity FROM products WHERE id = ?", [product.id]);
    expect(rows[0].stock_quantity).toBe(10);

    // Second cancel is rejected (state is already cancelled)
    const secondCancel = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "Cancel again" });
    expect(secondCancel.status).toBe(400);
  });

  test("Seller order state machine: view own orders, execute valid transitions, reject illegal transitions", async () => {
    const sellerUser = await createTestUser({ email: `fsm_seller_${Date.now()}@example.com`, role: "seller" });
    const seller = await createTestSeller({ user: sellerUser });
    const product = await createTestProduct({ sellerId: seller.id, price: 80, mrp: 120, stock: 15 });
    const buyer = await createTestUser({ email: `fsm_buyer_${Date.now()}@example.com` });

    testEmails.push(sellerUser.email, buyer.email);
    testSellers.push(seller.id);
    testProducts.push(product.id);

    const buyerToken = signAccessToken(buyer);
    const sellerToken = signAccessToken(sellerUser);

    // Customer places order
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        sellerId: seller.id,
        items: [{ productId: product.id, quantity: 2 }]
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;
    testOrders.push(orderId);

    // 1. Seller lists own orders
    const listRes = await request(app)
      .get("/api/sellers/orders")
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(listRes.status).toBe(200);
    const foundOrder = listRes.body.data.find(o => o.id === orderId);
    expect(foundOrder).toBeDefined();
    expect(foundOrder.status).toBe("pending");

    // 2. Illegal transition: pending -> completed (jumping states directly is rejected)
    const illegalJump = await request(app)
      .patch(`/api/sellers/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "completed" });
    expect(illegalJump.status).toBe(400);
    expect(illegalJump.body.message).toMatch(/cannot transition/i);

    // 3. Valid transition: pending -> confirmed
    const confirmRes = await request(app)
      .patch(`/api/sellers/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "confirmed" });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("confirmed");

    // 4. Valid transition: confirmed -> ready (packed)
    const readyRes = await request(app)
      .patch(`/api/sellers/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "ready" });
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.data.status).toBe("packed");

    // 5. Valid transition: packed -> shipped
    const shipRes = await request(app)
      .patch(`/api/sellers/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "shipped" });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.status).toBe("shipped");

    // 6. Valid transition: shipped -> completed (delivered)
    const deliverRes = await request(app)
      .patch(`/api/sellers/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "completed" });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe("delivered");

    // 7. Illegal transition from terminal state: completed -> pending (rejected)
    const illegalTerminal = await request(app)
      .patch(`/api/sellers/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "pending" });
    expect(illegalTerminal.status).toBe(400);
  });
});
