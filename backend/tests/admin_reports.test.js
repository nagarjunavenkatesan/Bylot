const request = require("supertest");
const app = require("../app");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pool } = require("../config/db");
const { createTestUser, createTestSeller, createTestProduct, cleanTestData } = require("./setup");
const { signAccessToken } = require("../utils/token");
const reportArchiveService = require("../services/reportArchiveService");
const { decryptPII, encryptPII } = require("../security/cryptoUtil");
const { ALL_INDIA_REGIONS, INDIA_STATES, INDIA_UNION_TERRITORIES, isValidStateOrUT, resolveCanonicalState } = require("../config/indiaLocations");

describe("Admin Reports & Archives + India Locations System", () => {
  const testEmails = [];
  const testProductIds = [];
  const testSellerIds = [];
  let adminUser = null;
  let adminToken = null;
  let buyerUser = null;
  let buyerToken = null;
  let sellerUser = null;
  let seller = null;
  let testProduct = null;

  beforeAll(async () => {
    // Clear any leftover reports in test database
    await pool.execute("DELETE FROM admin_report_archives");

    // 1. Create test admin with active 2FA
    const adminEmail = `admin_rep_${Date.now()}@bylot.test`;
    testEmails.push(adminEmail);
    adminUser = await createTestUser({ email: adminEmail, role: "admin", enable2FA: true });
    adminToken = signAccessToken(adminUser);

    // 2. Create test buyer
    const buyerEmail = `buyer_rep_${Date.now()}@bylot.test`;
    testEmails.push(buyerEmail);
    buyerUser = await createTestUser({ email: buyerEmail, role: "customer" });
    buyerToken = signAccessToken(buyerUser);

    // 3. Create test seller
    const sellerEmail = `seller_rep_${Date.now()}@bylot.test`;
    testEmails.push(sellerEmail);
    sellerUser = await createTestUser({ email: sellerEmail, role: "seller" });
    seller = await createTestSeller({ user: sellerUser });
    testSellerIds.push(seller.id);

    // 4. Create test product with location
    testProduct = await createTestProduct({
      sellerId: seller.id,
      name: "Evidence Test Apple",
      price: 120,
      mrp: 150
    });
    testProductIds.push(testProduct.id);

    // Assign full India location to test product
    await pool.execute(
      "UPDATE products SET country = 'India', state = 'Tamil Nadu', district = 'Chennai', city = 'Chennai', locality = 'T Nagar' WHERE id = ?",
      [testProduct.id]
    );
  });

  afterAll(async () => {
    // Clean created reports
    await pool.execute("DELETE FROM admin_report_archives WHERE created_by = ?", [adminUser.id]);
    await cleanTestData(testEmails, testProductIds, [], testSellerIds);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. INDIA STATE & UNION TERRITORY SUITE
  // ─────────────────────────────────────────────────────────────────────────────
  describe("India State & Union Territory System", () => {
    test("Canonical dataset includes exactly 28 States and 8 Union Territories (36 total)", () => {
      expect(INDIA_STATES.length).toBe(28);
      expect(INDIA_UNION_TERRITORIES.length).toBe(8);
      expect(ALL_INDIA_REGIONS.length).toBe(36);
    });

    test("All 28 States validate successfully with case and whitespace insensitivity", () => {
      const stateNames = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
        "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
        "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
        "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
        "Uttar Pradesh", "Uttarakhand", "West Bengal"
      ];

      stateNames.forEach((name) => {
        expect(isValidStateOrUT(name)).toBe(true);
        expect(isValidStateOrUT(name.toLowerCase())).toBe(true);
        expect(isValidStateOrUT(`  ${name.toUpperCase()}  `)).toBe(true);
        expect(resolveCanonicalState(name)).toBe(name);
      });
    });

    test("All 8 Union Territories validate successfully", () => {
      const utNames = [
        "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
        "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
      ];

      utNames.forEach((name) => {
        expect(isValidStateOrUT(name)).toBe(true);
        expect(resolveCanonicalState(name)).toBe(name);
      });
    });

    test("Arbitrary strings and unknown states are strictly rejected", () => {
      expect(isValidStateOrUT("California")).toBe(false);
      expect(isValidStateOrUT("New York")).toBe(false);
      expect(isValidStateOrUT("Atlantis")).toBe(false);
      expect(isValidStateOrUT("")).toBe(false);
      expect(isValidStateOrUT(null)).toBe(false);
      expect(isValidStateOrUT("SELECT * FROM users")).toBe(false);
      expect(resolveCanonicalState("FakeState")).toBeNull();
    });

    test("GET /api/locations/states returns all 36 canonical regions", async () => {
      const res = await request(app).get("/api/locations/states");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalStates).toBe(28);
      expect(res.body.data.totalUnionTerritories).toBe(8);
      expect(res.body.data.totalRegions).toBe(36);
      expect(Array.isArray(res.body.data.regions)).toBe(true);
    });

    test("GET /api/locations/states/:code/districts returns canonical districts", async () => {
      const res = await request(app).get("/api/locations/states/TN/districts");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.state).toBe("Tamil Nadu");
      expect(res.body.data.districts).toContain("Chennai");
      expect(res.body.data.districts).toContain("Coimbatore");
    });

    test("GET /api/locations/verify confirms valid state and rejects invalid", async () => {
      const validRes = await request(app).get("/api/locations/verify?state=Karnataka");
      expect(validRes.status).toBe(200);
      expect(validRes.body.data.valid).toBe(true);
      expect(validRes.body.data.canonicalState).toBe("Karnataka");

      const invalidRes = await request(app).get("/api/locations/verify?state=InvalidState123");
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.success).toBe(false);
    });

    test("Product creation rejects arbitrary state and accepts canonical state", async () => {
      // 1. Arbitrary state should fail
      const badRes = await request(app)
        .post("/api/sellers/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Invalid State Mango",
          mrp: 100,
          sellingPrice: 80,
          stockQuantity: 10,
          state: "ArbitraryUnknownState"
        });
      expect([400, 422]).toContain(badRes.status);

      // 2. Valid state should succeed and store location
      const goodRes = await request(app)
        .post("/api/sellers/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Valid Maharashtra Orange",
          mrp: 200,
          sellingPrice: 150,
          stockQuantity: 25,
          country: "India",
          state: "Maharashtra",
          district: "Pune",
          city: "Pune",
          locality: "Kothrud"
        });
      expect(goodRes.status).toBe(201);
      expect(goodRes.body.data.state).toBe("Maharashtra");
      expect(goodRes.body.data.district).toBe("Pune");
      if (goodRes.body.data.id) {
        testProductIds.push(goodRes.body.data.id);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REPORT GENERATION & BACKGROUND JOB SUITE
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Admin Report Generation & Cryptographic Pipeline", () => {
    let generatedReportId = null;
    let generatedReportDbId = null;

    test("POST /api/admin/archives/generate initiates a 30-day report in background", async () => {
      const res = await request(app)
        .post("/api/admin/archives/generate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ days: 30 });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.periodDays).toBe(30);
      expect(res.body.data.reportId).toMatch(/^BYLOT-REPORT-/);

      generatedReportId = res.body.data.reportId;
      generatedReportDbId = res.body.data.id;
    });

    test("Wait for background report generation to finish and reach READY state", async () => {
      // Poll briefly for background job completion (usually < 2 seconds)
      let attempts = 0;
      let status = "PENDING";
      let reportRecord = null;

      while (attempts < 30 && status !== "READY" && status !== "FAILED") {
        await new Promise((r) => setTimeout(r, 300));
        const [rows] = await pool.execute(
          "SELECT * FROM admin_report_archives WHERE id = ?",
          [generatedReportDbId]
        );
        reportRecord = rows[0];
        status = reportRecord ? reportRecord.status : "NOT_FOUND";
        attempts++;
      }

      expect(status).toBe("READY");
      expect(reportRecord.file_size).toBeGreaterThan(0);
      expect(reportRecord.encryption_algorithm).toBe("AES-256-GCM");
      expect(reportRecord.encryption_iv).toBeDefined();
      expect(reportRecord.encryption_tag).toBeDefined();
      expect(reportRecord.encrypted_dek).toBeDefined();
      expect(reportRecord.plaintext_sha256).toBeDefined();
      expect(reportRecord.ciphertext_sha256).toBeDefined();

      // Verify the encrypted file exists on disk
      expect(fs.existsSync(reportRecord.file_path)).toBe(true);
      expect(reportRecord.file_path.endsWith(".zip.enc")).toBe(true);

      // Verify NO plaintext zip file remains on disk
      const tempZipPath = path.join(process.cwd(), "private", "temp", `${generatedReportId}.tmp.zip`);
      expect(fs.existsSync(tempZipPath)).toBe(false);
    });

    test("Duplicate generation job for identical period is prevented", async () => {
      const [rows] = await pool.execute(
        "SELECT period_start, period_end FROM admin_report_archives WHERE id = ?",
        [generatedReportDbId]
      );
      const start = rows[0].period_start;
      const end = rows[0].period_end;

      // Temporarily mark status as GENERATING to test mutex guard
      await pool.execute("UPDATE admin_report_archives SET status = 'GENERATING' WHERE id = ?", [generatedReportDbId]);

      const dupRes = await request(app)
        .post("/api/admin/archives/generate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          startDate: reportArchiveService.formatDate(start),
          endDate: reportArchiveService.formatDate(end)
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);

      // Restore status to READY
      await pool.execute("UPDATE admin_report_archives SET status = 'READY' WHERE id = ?", [generatedReportDbId]);
    });

    test("GET /api/admin/archives returns the report with sanitization and metadata", async () => {
      const res = await request(app)
        .get("/api/admin/archives")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.reports)).toBe(true);

      const target = res.body.data.reports.find((r) => r.reportId === generatedReportId);
      expect(target).toBeDefined();
      expect(target.status).toBe("READY");
      expect(target.encryptionStatus).toBe("AES-256-GCM Encrypted");
      expect(target.checksum).toBeDefined();
      // Verify no sensitive keys leaked in response
      expect(target.encrypted_dek).toBeUndefined();
      expect(target.encryption_iv).toBeUndefined();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. CRYPTOGRAPHIC VERIFICATION & TAMPER RESISTANCE
    // ─────────────────────────────────────────────────────────────────────────────
    test("Envelope decryption succeeds and unpacks valid ZIP", async () => {
      const [rows] = await pool.execute(
        "SELECT * FROM admin_report_archives WHERE id = ?",
        [generatedReportDbId]
      );
      const report = rows[0];

      // Unwrap DEK
      const dekHex = decryptPII(report.encrypted_dek);
      expect(dekHex).not.toBe("[DECRYPTION_ERROR]");
      const dek = Buffer.from(dekHex, "hex");
      const iv = Buffer.from(report.encryption_iv, "hex");
      const tag = Buffer.from(report.encryption_tag, "hex");

      const ciphertext = fs.readFileSync(report.file_path);
      const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
      decipher.setAuthTag(tag);

      const decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      expect(decryptedBuffer.length).toBeGreaterThan(0);

      // Verify ZIP header magic bytes (PK\x03\x04)
      expect(decryptedBuffer[0]).toBe(0x50);
      expect(decryptedBuffer[1]).toBe(0x4b);
      expect(decryptedBuffer[2]).toBe(0x03);
      expect(decryptedBuffer[3]).toBe(0x04);

      // Verify SHA-256 matches plaintext checksum
      const hash = crypto.createHash("sha256").update(decryptedBuffer).digest("hex");
      expect(hash).toBe(report.plaintext_sha256);
    });

    test("Tampered ciphertext fails AES-256-GCM authentication tag verification", async () => {
      const [rows] = await pool.execute(
        "SELECT * FROM admin_report_archives WHERE id = ?",
        [generatedReportDbId]
      );
      const report = rows[0];
      const dek = Buffer.from(decryptPII(report.encrypted_dek), "hex");
      const iv = Buffer.from(report.encryption_iv, "hex");
      const tag = Buffer.from(report.encryption_tag, "hex");

      const ciphertext = fs.readFileSync(report.file_path);
      // Alter one byte
      ciphertext[ciphertext.length - 1] ^= 0xff;

      const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
      decipher.setAuthTag(tag);

      expect(() => {
        Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      }).toThrow();
    });

    test("Wrong decryption key fails to decrypt archive", async () => {
      const [rows] = await pool.execute(
        "SELECT * FROM admin_report_archives WHERE id = ?",
        [generatedReportDbId]
      );
      const report = rows[0];
      const wrongDek = crypto.randomBytes(32);
      const iv = Buffer.from(report.encryption_iv, "hex");
      const tag = Buffer.from(report.encryption_tag, "hex");
      const ciphertext = fs.readFileSync(report.file_path);

      const decipher = crypto.createDecipheriv("aes-256-gcm", wrongDek, iv);
      decipher.setAuthTag(tag);

      expect(() => {
        Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      }).toThrow();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. DOWNLOAD SECURITY & IDOR PROTECTION
    // ─────────────────────────────────────────────────────────────────────────────
    test("Authenticated admin can download decrypted archive", async () => {
      const res = await request(app)
        .get(`/api/admin/reports/${generatedReportId}/download`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/zip");
      expect(res.headers["content-disposition"]).toContain(generatedReportId);
      expect(res.headers["cache-control"]).toContain("no-store");

      // Verify ZIP magic bytes
      const bodyBuffer = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text || "");
      if (bodyBuffer.length >= 4) {
        expect(bodyBuffer[0]).toBe(0x50);
        expect(bodyBuffer[1]).toBe(0x4b);
      }
    });

    test("Unauthenticated request to download fails with 401", async () => {
      const res = await request(app)
        .get(`/api/admin/reports/${generatedReportId}/download`);

      expect(res.status).toBe(401);
    });

    test("Non-admin user (customer/buyer) fails with 403", async () => {
      const res = await request(app)
        .get(`/api/admin/reports/${generatedReportId}/download`)
        .set("Authorization", `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
    });

    test("Path traversal attempt in report download endpoint is rejected with 400", async () => {
      const res = await request(app)
        .get("/api/admin/reports/..%2f..%2fetc%2fpasswd/download")
        .set("Authorization", `Bearer ${adminToken}`);

      expect([400, 404]).toContain(res.status);
    });

    test("Direct access to /private is blocked with 403", async () => {
      const res = await request(app).get("/private/reports/secret.zip.enc");
      expect(res.status).toBe(403);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. DELETION & LIVE DATA INTEGRITY SUITE
    // ─────────────────────────────────────────────────────────────────────────────
    test("DELETE /api/admin/reports/:reportId removes only archive file and metadata", async () => {
      // 1. Verify live data exists before deletion
      const [liveProdsBefore] = await pool.execute("SELECT COUNT(*) AS total FROM products WHERE id = ?", [testProduct.id]);
      expect(liveProdsBefore[0].total).toBe(1);

      const [liveUsersBefore] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE id = ?", [buyerUser.id]);
      expect(liveUsersBefore[0].total).toBe(1);

      // 2. Perform deletion
      const res = await request(app)
        .delete(`/api/admin/reports/${generatedReportId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 3. Verify report status is DELETED in database and encrypted_dek is wiped
      const [reportRows] = await pool.execute(
        "SELECT status, encrypted_dek, file_path FROM admin_report_archives WHERE id = ?",
        [generatedReportDbId]
      );
      expect(reportRows[0].status).toBe("DELETED");
      expect(reportRows[0].encrypted_dek).toBeNull();

      // 4. Verify encrypted file was deleted from disk
      if (reportRows[0].file_path) {
        expect(fs.existsSync(reportRows[0].file_path)).toBe(false);
      }

      // 5. CRITICAL CHECK: Verify live application data is completely untouched!
      const [liveProdsAfter] = await pool.execute("SELECT COUNT(*) AS total FROM products WHERE id = ?", [testProduct.id]);
      expect(liveProdsAfter[0].total).toBe(1);

      const [liveUsersAfter] = await pool.execute("SELECT COUNT(*) AS total FROM users WHERE id = ?", [buyerUser.id]);
      expect(liveUsersAfter[0].total).toBe(1);

      const [liveSellersAfter] = await pool.execute("SELECT COUNT(*) AS total FROM sellers WHERE id = ?", [seller.id]);
      expect(liveSellersAfter[0].total).toBe(1);
    });

    test("Deleted report cannot be downloaded (returns 410 Gone)", async () => {
      const res = await request(app)
        .get(`/api/admin/reports/${generatedReportId}/download`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(410);
      expect(res.body.success).toBe(false);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. RETENTION CLEANUP
    // ─────────────────────────────────────────────────────────────────────────────
    test("cleanExpiredArchives removes expired reports without touching live data", async () => {
      // Create a temporary expired report record
      const expiredId = `BYLOT-REPORT-EXPIRED-${Date.now()}`;
      const fakeEncPath = path.join(process.cwd(), "private", "reports", `${expiredId}.zip.enc`);
      fs.mkdirSync(path.dirname(fakeEncPath), { recursive: true });
      fs.writeFileSync(fakeEncPath, "encrypted-archive-content-fake");

      const [ins] = await pool.execute(
        `INSERT INTO admin_report_archives
         (report_id, period_start, period_end, status, file_path, file_size, created_by, expires_at)
         VALUES (?, '2025-01-01', '2025-01-31', 'READY', ?, 123, ?, DATE_SUB(NOW(), INTERVAL 1 DAY))`,
        [expiredId, fakeEncPath, adminUser.id]
      );

      const cleanupRes = await reportArchiveService.cleanExpiredArchives();
      expect(cleanupRes.cleanedCount).toBeGreaterThanOrEqual(1);

      // Verify file was unlinked
      expect(fs.existsSync(fakeEncPath)).toBe(false);

      // Verify status set to DELETED
      const [check] = await pool.execute("SELECT status FROM admin_report_archives WHERE id = ?", [ins.insertId]);
      expect(check[0].status).toBe("DELETED");

      // Verify live product is still intact
      const [liveCheck] = await pool.execute("SELECT id FROM products WHERE id = ?", [testProduct.id]);
      expect(liveCheck.length).toBe(1);
    });
  });
});
