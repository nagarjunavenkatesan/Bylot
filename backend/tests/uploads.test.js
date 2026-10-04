const request = require("supertest");
const app = require("../app");
const { createTestUser, createTestSeller, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");
const fs = require("fs");
const path = require("path");

describe("File Uploads Security and Validation", () => {
  const testEmails = [];
  const testSellerIds = [];
  let customerToken;
  let pendingSellerToken;
  let approvedSellerToken;
  let uploadedFilePath = null;

  beforeAll(async () => {
    // 1. Regular customer
    const customer = await createTestUser({ email: `upload_cust_${Date.now()}@example.com`, role: "customer" });
    testEmails.push(customer.email);
    customerToken = signAccessToken({ id: customer.id, email: customer.email, role: customer.role });

    // 2. Pending seller
    const pendingUser = await createTestUser({ email: `upload_pending_${Date.now()}@example.com`, role: "seller" });
    testEmails.push(pendingUser.email);
    const pendingSeller = await createTestSeller({ user: pendingUser, approvalStatus: "pending", status: "inactive" });
    testSellerIds.push(pendingSeller.id);
    pendingSellerToken = signAccessToken({ id: pendingUser.id, email: pendingUser.email, role: pendingUser.role });

    // 3. Approved seller
    const approvedUser = await createTestUser({ email: `upload_approved_${Date.now()}@example.com`, role: "seller" });
    testEmails.push(approvedUser.email);
    const approvedSeller = await createTestSeller({ user: approvedUser, approvalStatus: "approved", status: "active" });
    testSellerIds.push(approvedSeller.id);
    approvedSellerToken = signAccessToken({ id: approvedUser.id, email: approvedUser.email, role: approvedUser.role });
  });

  afterAll(async () => {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch {}
    }
    await cleanTestData(testEmails, [], [], testSellerIds);
  });

  test("A text or HTML file renamed to .png is rejected with 400", async () => {
    const fakeImageBuffer = Buffer.from("<html><body><script>alert(1)</script></body></html>");
    const res = await request(app)
      .post("/api/sellers/uploads/product-image")
      .set("Authorization", `Bearer ${approvedSellerToken}`)
      .attach("productImage", fakeImageBuffer, "exploit.png");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid image file/i);
  });

  test("Only approved sellers can upload product images (customer rejected with 403)", async () => {
    const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const res = await request(app)
      .post("/api/sellers/uploads/product-image")
      .set("Authorization", `Bearer ${customerToken}`)
      .attach("productImage", validPng, "dot.png");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("Pending seller cannot upload product images (rejected with 403)", async () => {
    const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const res = await request(app)
      .post("/api/sellers/uploads/product-image")
      .set("Authorization", `Bearer ${pendingSellerToken}`)
      .attach("productImage", validPng, "dot.png");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("Approved seller can upload valid image and stored name is random .webp", async () => {
    const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const res = await request(app)
      .post("/api/sellers/uploads/product-image")
      .set("Authorization", `Bearer ${approvedSellerToken}`)
      .attach("productImage", validPng, "original-name.png");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.filename).toBeDefined();
    // Stored name should not match original-name.png, but should end with .webp
    expect(res.body.data.filename).not.toContain("original-name");
    expect(res.body.data.filename).toMatch(/^[0-9a-f-]{36}\.webp$/i);

    // Track path for cleanup
    uploadedFilePath = path.join(process.cwd(), "uploads", "products", res.body.data.filename);
  });

  test("An oversized file returns 413", async () => {
    // 6MB buffer (limit is 5MB)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
    const res = await request(app)
      .post("/api/sellers/uploads/product-image")
      .set("Authorization", `Bearer ${approvedSellerToken}`)
      .attach("productImage", largeBuffer, "large.jpg");

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/exceeds/i);
  });
});
