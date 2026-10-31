const request = require("supertest");
const app = require("../app");
const fs = require("fs");
const crypto = require("crypto");
const { pool } = require("../config/db");
const { createTestUser, createTestSeller, createTestProduct, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");
const reportArchiveService = require("../services/reportArchiveService");
const { decryptPII } = require("../security/cryptoUtil");

function extractZipFilenames(buffer) {
  const filenames = [];
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) === 0x02014b50) {
      const fileNameLen = buffer.readUInt16LE(offset + 28);
      const extraLen = buffer.readUInt16LE(offset + 30);
      const commentLen = buffer.readUInt16LE(offset + 32);
      const name = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLen);
      filenames.push(name.replace(/\\/g, "/"));
      offset += 46 + fileNameLen + extraLen + commentLen;
    } else {
      offset++;
    }
  }
  return filenames;
}

describe("Seller Product Deletion & 30-Day Report Integration", () => {
  const testEmails = [];
  const testProductIds = [];
  const testSellerIds = [];
  const testOrderIds = [];

  let adminUser = null;
  let adminToken = null;
  let sellerUserA = null;
  let sellerA = null;
  let sellerTokenA = null;
  let sellerUserB = null;
  let sellerB = null;
  let sellerTokenB = null;
  let buyerUser = null;
  let buyerToken = null;

  let productA = null;
  let productB = null;
  let productWithOrder = null;
  let testOrderId = null;

  beforeAll(async () => {
    // 1. Admin
    const adminEmail = `admin_del_${Date.now()}@bylot.test`;
    testEmails.push(adminEmail);
    adminUser = await createTestUser({ email: adminEmail, role: "admin", enable2FA: true });
    adminToken = signAccessToken(adminUser);

    // 2. Seller A
    const sellerEmailA = `sellerA_del_${Date.now()}@bylot.test`;
    testEmails.push(sellerEmailA);
    sellerUserA = await createTestUser({ email: sellerEmailA, role: "seller" });
    sellerA = await createTestSeller({ user: sellerUserA, businessName: "Seller A Supermart" });
    testSellerIds.push(sellerA.id);
    sellerTokenA = signAccessToken(sellerUserA);

    // 3. Seller B
    const sellerEmailB = `sellerB_del_${Date.now()}@bylot.test`;
    testEmails.push(sellerEmailB);
    sellerUserB = await createTestUser({ email: sellerEmailB, role: "seller" });
    sellerB = await createTestSeller({ user: sellerUserB, businessName: "Seller B Fresh Store" });
    testSellerIds.push(sellerB.id);
    sellerTokenB = signAccessToken(sellerUserB);

    // 4. Buyer
    const buyerEmail = `buyer_del_${Date.now()}@bylot.test`;
    testEmails.push(buyerEmail);
    buyerUser = await createTestUser({ email: buyerEmail, role: "customer" });
    buyerToken = signAccessToken(buyerUser);

    // 5. Products
    productA = await createTestProduct({
      sellerId: sellerA.id,
      name: "Organic Honey Jar",
      price: 250,
      mrp: 300,
      status: "active"
    });
    testProductIds.push(productA.id);

    // Give productA full India location
    await pool.execute(
      "UPDATE products SET country = 'India', state = 'Karnataka', district = 'Bengaluru Urban', city = 'Bengaluru', locality = 'Indiranagar' WHERE id = ?",
      [productA.id]
    );

    productB = await createTestProduct({
      sellerId: sellerB.id,
      name: "Whole Wheat Bread",
      price: 45,
      mrp: 50,
      status: "active"
    });
    testProductIds.push(productB.id);

    productWithOrder = await createTestProduct({
      sellerId: sellerA.id,
      name: "Cold Pressed Olive Oil",
      price: 400,
      mrp: 500,
      status: "active"
    });
    testProductIds.push(productWithOrder.id);

    // Create an order for productWithOrder to verify order preservation
    const orderNumber = `BYL-TEST-ORD-${Date.now()}`;
    const [ordResult] = await pool.execute(
      `INSERT INTO orders (order_number, user_id, seller_id, status, subtotal, discount_total, delivery_fee, tax_total, grand_total, created_at)
       VALUES (?, ?, ?, 'delivered', 400.00, 0.00, 0.00, 0.00, 400.00, NOW())`,
      [orderNumber, buyerUser.id, sellerA.id]
    );
    testOrderId = ordResult.insertId;
    testOrderIds.push(testOrderId);

    await pool.execute(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount_amount, total_price)
       VALUES (?, ?, 'Cold Pressed Olive Oil', 1, 400.00, 0.00, 400.00)`,
      [testOrderId, productWithOrder.id]
    );
  });

  afterAll(async () => {
    if (testOrderIds.length > 0) {
      await pool.query("DELETE FROM order_items WHERE order_id IN (?)", [testOrderIds]);
      await pool.query("DELETE FROM orders WHERE id IN (?)", [testOrderIds]);
    }
    await pool.execute("DELETE FROM admin_report_archives WHERE created_by = ?", [adminUser.id]);
    await cleanTestData(testEmails, testProductIds, [], testSellerIds);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & AUTHORIZATION (Sections 3 & 19)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Authentication & Authorization Enforcement", () => {
    test("Unauthenticated DELETE request is rejected with 401", async () => {
      const res = await request(app).delete(`/api/sellers/products/${productA.id}`);
      expect(res.status).toBe(401);

      const resGeneric = await request(app).delete(`/api/products/${productA.id}`);
      expect(resGeneric.status).toBe(401);
    });

    test("Non-existent product deletion returns 404", async () => {
      const res = await request(app)
        .delete("/api/sellers/products/99999999")
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("IDOR / BOLA Prevention: Seller B cannot delete Seller A's product (HTTP 403)", async () => {
      const res = await request(app)
        .delete(`/api/sellers/products/${productA.id}`)
        .set("Authorization", `Bearer ${sellerTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Verify product A remains active in DB
      const [rows] = await pool.execute("SELECT status, deleted_at FROM products WHERE id = ?", [productA.id]);
      expect(rows[0].status).toBe("active");
      expect(rows[0].deleted_at).toBeNull();
    });

    test("IDOR / BOLA Prevention: Seller B via /api/products/:id cannot delete Seller A's product", async () => {
      const res = await request(app)
        .delete(`/api/products/${productA.id}`)
        .set("Authorization", `Bearer ${sellerTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test("Customer/buyer cannot delete any product (HTTP 403)", async () => {
      const res = await request(app)
        .delete(`/api/sellers/products/${productA.id}`)
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SUCCESSFUL SELLER DELETION & DATABASE STATE (Sections 2, 5, 7, 14)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Successful Seller Product Deletion", () => {
    test("Authorized seller deletes their own product: returns 200 and soft-deletes", async () => {
      const res = await request(app)
        .delete(`/api/sellers/products/${productA.id}`)
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Item deleted successfully/i);

      // Verify database state
      const [rows] = await pool.execute(
        "SELECT id, status, deleted_at, deleted_by, deletion_reason FROM products WHERE id = ?",
        [productA.id]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("deleted");
      expect(rows[0].deleted_at).not.toBeNull();
      expect(new Date(rows[0].deleted_at).getTime()).toBeLessThanOrEqual(Date.now() + 5000);
      expect(Number(rows[0].deleted_by)).toBe(sellerUserA.id);
      expect(rows[0].deletion_reason).toBe("SELLER_DELETED");
    });

    test("Deletion audit event is logged with PRODUCT_DELETED action", async () => {
      const auditLogger = require("../security/auditLogger");
      const recentLogs = auditLogger.getRecentLogs(50);
      const audit = recentLogs.find(
        (log) => log.type === "PRODUCT_DELETED" && (Number(log.userId) === Number(sellerUserA.id) || (typeof log.details === "string" && log.details.includes(String(productA.id))))
      );

      expect(audit).toBeDefined();
      expect(audit.type).toBe("PRODUCT_DELETED");
      const details = typeof audit.details === "string" ? JSON.parse(audit.details) : audit.details;
      expect(Number(details.productId)).toBe(Number(productA.id));
      expect(Number(details.sellerId)).toBe(Number(sellerA.id));
      expect(details.productName).toBe("Organic Honey Jar");
      expect(details.categoryName).toBeDefined();
    });

    test("Deleting already deleted product returns 404", async () => {
      const res = await request(app)
        .delete(`/api/sellers/products/${productA.id}`)
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. MARKETPLACE & ACTIVE LISTING EXCLUSION (Sections 4 & 15)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Marketplace & Active Listing Filtering", () => {
    test("Deleted product does NOT appear in public /api/products listing", async () => {
      const res = await request(app).get("/api/products");
      expect(res.status).toBe(200);
      const items = res.body.data || res.body;
      const found = items.find((p) => Number(p.id) === Number(productA.id));
      expect(found).toBeUndefined();
    });

    test("Deleted product does NOT appear in public product detail endpoint", async () => {
      const res = await request(app).get(`/api/products/${productA.id}`);
      expect(res.status).toBe(404);
    });

    test("Deleted product does NOT appear in seller active products list", async () => {
      const res = await request(app)
        .get("/api/sellers/products")
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(res.status).toBe(200);
      const products = res.body.data || res.body;
      const found = products.find((p) => Number(p.id) === Number(productA.id));
      expect(found).toBeUndefined();
    });

    test("Seller dashboard excludes deleted products from total products count", async () => {
      const res = await request(app)
        .get("/api/sellers/dashboard")
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(res.status).toBe(200);
      const stats = res.body.data?.stats || res.body.stats;
      // Seller A only has productWithOrder active now (productA is deleted)
      expect(stats.totalProducts).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. HISTORICAL ORDER & BUYER PRESERVATION (Sections 4 & 14)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Historical Data Preservation", () => {
    test("Deleting product with sales history preserves orders, order_items, and buyers", async () => {
      // Seller A deletes productWithOrder via /api/products/:id
      const delRes = await request(app)
        .delete(`/api/products/${productWithOrder.id}`)
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(delRes.status).toBe(200);

      // Verify product row is soft-deleted, not removed
      const [prodRows] = await pool.execute("SELECT status, deleted_at FROM products WHERE id = ?", [productWithOrder.id]);
      expect(prodRows.length).toBe(1);
      expect(prodRows[0].status).toBe("deleted");
      expect(prodRows[0].deleted_at).not.toBeNull();

      // Verify order and order items are completely intact
      const [ordRows] = await pool.execute("SELECT * FROM orders WHERE id = ?", [testOrderId]);
      expect(ordRows.length).toBe(1);
      expect(ordRows[0].user_id).toBe(buyerUser.id);

      const [itemRows] = await pool.execute("SELECT * FROM order_items WHERE order_id = ?", [testOrderId]);
      expect(itemRows.length).toBe(1);
      expect(itemRows[0].product_id).toBe(productWithOrder.id);
      expect(itemRows[0].product_name).toBe("Cold Pressed Olive Oil");

      // Verify buyer user is completely intact
      const [buyerRows] = await pool.execute("SELECT id, email, status FROM users WHERE id = ?", [buyerUser.id]);
      expect(buyerRows.length).toBe(1);
      expect(buyerRows[0].status).toBe("active");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ADMIN DELETED PRODUCTS ENDPOINT (Section 10)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Admin Deleted Products Endpoint", () => {
    test("Non-admin cannot access GET /api/admin/products/deleted", async () => {
      const res = await request(app)
        .get("/api/admin/products/deleted")
        .set("Authorization", `Bearer ${sellerTokenA}`);

      expect(res.status).toBe(403);
    });

    test("Admin can retrieve deleted products with seller, location, and order reference", async () => {
      const res = await request(app)
        .get("/api/admin/products/deleted")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const deletedA = res.body.data.find((p) => Number(p.id) === Number(productA.id));
      expect(deletedA).toBeDefined();
      expect(deletedA.name).toBe("Organic Honey Jar");
      expect(deletedA.seller_name).toBe(sellerA.business_name);
      expect(deletedA.deleted_at).not.toBeNull();
      expect(deletedA.state).toBe("Karnataka");
      expect(deletedA.city).toBe("Bengaluru");

      const deletedWithOrder = res.body.data.find((p) => Number(p.id) === Number(productWithOrder.id));
      expect(deletedWithOrder).toBeDefined();
      expect(deletedWithOrder.latest_order_number).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. 30-DAY REPORT ARCHIVE INTEGRATION & ENCRYPTION E2E (Sections 6, 8, 11, 12, 22)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("30-Day Encrypted Report Archive Integration", () => {
    let generatedReport = null;

    test("Generating report archive includes deleted-products and deletion-actions", async () => {
      // Generate 30-day report archive
      const now = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const startIso = thirtyDaysAgo.toISOString();
      const endIso = now.toISOString();

      // Test helper fetch methods directly first
      const deletedData = await reportArchiveService.fetchDeletedProductData(startIso, endIso);
      expect(Array.isArray(deletedData)).toBe(true);
      const targetInFetch = deletedData.find((p) => Number(p.product_id) === Number(productA.id) || p.productId === productA.product_item_id);
      expect(targetInFetch).toBeDefined();
      expect(targetInFetch.productTitle).toBe("Organic Honey Jar");
      expect(targetInFetch.sellerName).toBe(sellerA.business_name);
      expect(targetInFetch.status).toBe("DELETED");
      expect(targetInFetch.location.state).toBe("Karnataka");
      expect(targetInFetch.deletedAt).toBeDefined();

      const deletionAudits = await reportArchiveService.fetchProductDeletionAuditData(startIso, endIso);
      expect(Array.isArray(deletionAudits)).toBe(true);
      expect(deletionAudits.length).toBeGreaterThan(0);

      // Trigger full report archive generation job
      const reportRes = await request(app)
        .post("/api/admin/archives/generate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ days: 30 });

      expect(reportRes.status).toBe(202);
      expect(reportRes.body.success).toBe(true);

      const reportId = reportRes.body.data?.reportId;
      expect(reportId).toBeDefined();

      // Poll until READY
      let attempts = 0;
      let status = "PENDING";
      let reportRow = null;

      while (attempts < 20 && status !== "READY" && status !== "FAILED") {
        await new Promise((r) => setTimeout(r, 600));
        const [rows] = await pool.execute(
          "SELECT * FROM admin_report_archives WHERE report_id = ?",
          [reportId]
        );
        if (rows.length > 0) {
          reportRow = rows[0];
          status = reportRow.status;
        }
        attempts++;
      }

      expect(status).toBe("READY");
      generatedReport = reportRow;
    }, 30000);

    test("Decrypted report archive ZIP contains products/deleted-products.json and audit/product-deletion-actions.json", async () => {
      expect(generatedReport).toBeDefined();

      // Decrypt DEK
      const dekHex = decryptPII(generatedReport.encrypted_dek);
      expect(dekHex).not.toBe("[DECRYPTION_ERROR]");
      const dek = Buffer.from(dekHex, "hex");
      const iv = Buffer.from(generatedReport.encryption_iv, "hex");
      const tag = Buffer.from(generatedReport.encryption_tag, "hex");

      // Decrypt ciphertext
      const ciphertext = fs.readFileSync(generatedReport.file_path);
      const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
      decipher.setAuthTag(tag);
      const zipBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      // Extract ZIP directory entries
      const filePaths = extractZipFilenames(zipBuffer);

      // Verify expected paths in archive
      expect(filePaths).toContain("products/deleted-products.json");
      expect(filePaths).toContain("audit/product-deletion-actions.json");
      expect(filePaths).toContain("manifest.json");
      expect(filePaths).toContain("README.txt");
      expect(filePaths).toContain("checksums.sha256");

      // Verify manifest and deleted products appear in the zip archive
      const zipLatin = zipBuffer.toString("latin1");
      expect(zipLatin).toContain("products/deleted-products.json");
      expect(zipLatin).toContain("audit/product-deletion-actions.json");
    });

    test("Admin can download report archive and temporary plaintext files are not leaked", async () => {
      const dlRes = await request(app)
        .get(`/api/admin/reports/${generatedReport.report_id}/download`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(dlRes.status).toBe(200);
      expect(dlRes.headers["content-type"]).toBe("application/zip");

      // Verify that no plaintext zip exists at file_path without .enc extension
      const plainZipPath = generatedReport.file_path.replace(/\.enc$/, "");
      expect(fs.existsSync(plainZipPath)).toBe(false);
    });
  });
});
