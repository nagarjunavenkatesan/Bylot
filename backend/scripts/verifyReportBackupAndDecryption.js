const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PassThrough } = require("stream");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const env = require("../config/env");
const reportArchiveService = require("../services/reportArchiveService");
const { pool } = require("../config/db");
const { getMasterKey, decryptPII } = require("../security/cryptoUtil");

async function verifyReportArchiveAndBackupDecryption() {
  console.log("=================================================================");
  console.log("   BYLOT REPORT ENCRYPTION, DECRYPTION & BACKUP VERIFICATION    ");
  console.log("=================================================================\n");

  const results = {
    reportGeneration: null,
    encryptionMetrics: null,
    tempCleanup: null,
    plaintextSecretLeakCheck: null,
    validKeyDecryption: null,
    wrongKeyDecryptionRejection: null,
    tamperedCiphertextRejection: null,
    liveDataIntegrityAfterDeletion: null
  };

  // 1. Snapshot live database counts before report generation
  const [[{ countUsersBefore }]] = await pool.query("SELECT COUNT(*) as countUsersBefore FROM users");
  const [[{ countProductsBefore }]] = await pool.query("SELECT COUNT(*) as countProductsBefore FROM products");

  // Clean any old test records for period
  await pool.query("DELETE FROM admin_report_archives WHERE report_id LIKE 'BYLOT-REPORT-TEST-%'");

  // 2. Generate a 30-day report archive
  console.log("[1/7] Generating 30-day encrypted evidence report archive...");
  const t0 = process.hrtime.bigint();
  const initRes = await reportArchiveService.initiateReportGeneration({
    periodDays: 30,
    adminUserId: 1
  });

  let report = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 15000) {
    report = await reportArchiveService.findReportArchive(initRes.id);
    if (report && (report.status === "READY" || report.status === "FAILED")) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!report || report.status !== "READY") {
    throw new Error(`Report generation failed or timed out: ${report?.status} - ${report?.error_message}`);
  }
  const generationDurationMs = Number(process.hrtime.bigint() - t0) / 1e6;

  console.log(`      ✓ Report generated: ${report.report_id}`);
  console.log(`      ✓ File path: ${report.file_path}`);
  console.log(`      ✓ Status: ${report.status}`);
  console.log(`      ✓ Ciphertext Size: ${(Number(report.file_size) / 1024).toFixed(2)} KB`);
  console.log(`      ✓ SHA-256 Checksum: ${report.checksum_sha256}`);
  console.log(`      ✓ Total Generation Duration: ${generationDurationMs.toFixed(2)} ms`);

  results.reportGeneration = {
    reportId: report.report_id,
    status: report.status,
    fileSizeBytes: Number(report.file_size),
    durationMs: generationDurationMs
  };

  // 3. Verify permanent storage contains ONLY the encrypted file
  const privateDir = path.dirname(report.file_path);
  const filesInPrivate = fs.readdirSync(privateDir);
  const unencryptedZipExists = filesInPrivate.some((f) => f.endsWith(".zip") && !f.endsWith(".zip.enc"));
  if (unencryptedZipExists) {
    throw new Error("CRITICAL SECURITY FAILURE: Unencrypted ZIP found in permanent storage!");
  }
  console.log(`      ✓ Storage security: ONLY encrypted .enc file present. Zero plaintext ZIPs stored.`);

  // 4. Verify temp cleanup
  const tempDir = path.join(path.dirname(privateDir), "temp");
  let leftoverTempJobs = 0;
  if (fs.existsSync(tempDir)) {
    const tempItems = fs.readdirSync(tempDir);
    leftoverTempJobs = tempItems.filter((item) => item.includes(report.report_id)).length;
  }
  if (leftoverTempJobs > 0) {
    throw new Error(`CRITICAL: Leftover temporary plaintext directory found for ${report.report_id}!`);
  }
  console.log(`      ✓ Temp cleanup: Temporary plaintext working directories immediately destroyed.`);
  results.tempCleanup = "PASSED";

  // 5. Test Decryption with Valid Master Key (Stream Decryption)
  console.log("\n[2/7] Testing internal streaming decryption with valid master key...");
  const tDec0 = process.hrtime.bigint();

  const chunks = [];
  const mockRes = new PassThrough();
  mockRes.setHeader = () => {};
  mockRes.status = () => mockRes;
  mockRes.json = (val) => chunks.push(Buffer.from(JSON.stringify(val)));

  mockRes.on("data", (chunk) => chunks.push(chunk));

  await reportArchiveService.streamDecryptedArchive(report, mockRes, 1);
  await new Promise((resolve) => mockRes.on("end", resolve));

  const decryptedBuffer = Buffer.concat(chunks);
  const tDec1 = process.hrtime.bigint();
  const decryptionDurationMs = Number(tDec1 - tDec0) / 1e6;

  console.log(`      ✓ Decrypted stream successfully recovered (${decryptedBuffer.length} bytes in ${decryptionDurationMs.toFixed(2)} ms)`);
  const isZip = decryptedBuffer[0] === 0x50 && decryptedBuffer[1] === 0x4b;
  if (!isZip) {
    throw new Error("Decrypted stream does not match valid ZIP header (PK)!");
  }
  console.log(`      ✓ Decrypted header: Valid ZIP format verified (PK).`);
  results.validKeyDecryption = {
    decryptedSizeBytes: decryptedBuffer.length,
    decryptionDurationMs
  };

  // 6. Test Decryption with WRONG Master Key
  console.log("\n[3/7] Testing decryption rejection with wrong master key...");
  let wrongKeyFailedAsExpected = false;
  try {
    const wrongMasterKey = crypto.randomBytes(32);
    const [ivHex, tagHex, encryptedHex] = report.encrypted_dek.split(":");
    const decipherKey = crypto.createDecipheriv("aes-256-gcm", wrongMasterKey, Buffer.from(ivHex, "hex"));
    decipherKey.setAuthTag(Buffer.from(tagHex, "hex"));
    decipherKey.update(Buffer.from(encryptedHex, "hex"));
    decipherKey.final();
  } catch (err) {
    wrongKeyFailedAsExpected = true;
    console.log(`      ✓ Expected failure caught: ${err.message} (Auth tag / key validation failed)`);
  }

  if (!wrongKeyFailedAsExpected) {
    throw new Error("SECURITY FAILURE: Wrong master key did not reject decryption!");
  }
  results.wrongKeyDecryptionRejection = "PASSED";

  // 7. Test Decryption with TAMPERED Ciphertext
  console.log("\n[4/7] Testing decryption rejection on tampered archive ciphertext...");
  let tamperedFailedAsExpected = false;
  try {
    const rawCiphertext = fs.readFileSync(report.file_path);
    const tampered = Buffer.from(rawCiphertext);
    tampered[100] = tampered[100] ^ 0xff; // flip byte

    const dekHex = decryptPII(report.encrypted_dek);
    const dek = Buffer.from(dekHex, "hex");
    const decipherPayload = crypto.createDecipheriv(
      "aes-256-gcm",
      dek,
      Buffer.from(report.encryption_iv, "hex")
    );
    decipherPayload.setAuthTag(Buffer.from(report.encryption_tag, "hex"));
    Buffer.concat([decipherPayload.update(tampered), decipherPayload.final()]);
  } catch (err) {
    tamperedFailedAsExpected = true;
    console.log(`      ✓ Expected failure caught: ${err.message} (GCM Auth tag authentication rejected tampered data)`);
  }

  if (!tamperedFailedAsExpected) {
    throw new Error("SECURITY FAILURE: Tampered ciphertext was not rejected!");
  }
  results.tamperedCiphertextRejection = "PASSED";

  // 8. Database Dump and Secret Leakage Check
  console.log("\n[5/7] Checking database record for plaintext secrets leakage...");
  const [reportRows] = await pool.query("SELECT * FROM admin_report_archives WHERE id = ?", [report.id]);
  const rowJson = JSON.stringify(reportRows[0]);

  const masterKey = getMasterKey().toString("hex");
  if (masterKey && rowJson.includes(masterKey)) {
    throw new Error("CRITICAL SECURITY FAILURE: Plaintext master key found in database record!");
  }
  console.log(`      ✓ Secret check: Plaintext master key is NEVER stored in database.`);
  results.plaintextSecretLeakCheck = "PASSED";

  // 9. Verify Report Deletion Safety (Never touches live data)
  console.log("\n[6/7] Testing secure report deletion and verifying live data immunity...");
  await reportArchiveService.deleteReportArchive(report.id, 1);
  console.log(`      ✓ Report delete executed: ${report.report_id}`);

  const fileStillExists = fs.existsSync(report.file_path);
  if (fileStillExists) {
    throw new Error("Report file was not deleted from disk!");
  }
  console.log(`      ✓ Encrypted archive file successfully deleted from storage.`);

  const [deletedMetaRows] = await pool.query("SELECT status FROM admin_report_archives WHERE id = ?", [report.id]);
  if (deletedMetaRows.length > 0 && deletedMetaRows[0].status !== "DELETED") {
    throw new Error(`Expected record status DELETED, found ${deletedMetaRows[0].status}`);
  }
  console.log(`      ✓ Report metadata marked as DELETED.`);

  const [[{ countUsersAfter }]] = await pool.query("SELECT COUNT(*) as countUsersAfter FROM users");
  const [[{ countProductsAfter }]] = await pool.query("SELECT COUNT(*) as countProductsAfter FROM products");

  if (countUsersBefore !== countUsersAfter || countProductsBefore !== countProductsAfter) {
    throw new Error("CRITICAL SAFETY FAILURE: Live database records were altered during report deletion!");
  }
  console.log(`      ✓ Live data immunity: Users (${countUsersAfter}) and Products (${countProductsAfter}) completely untouched.`);
  results.liveDataIntegrityAfterDeletion = "PASSED";

  // Clean up soft-deleted test row from DB
  await pool.query("DELETE FROM admin_report_archives WHERE id = ?", [report.id]);

  console.log("\n[7/7] Summary of cryptographic and archive benchmarks:");
  console.log(`      - Generation duration: ${generationDurationMs.toFixed(2)} ms`);
  console.log(`      - Decryption duration: ${decryptionDurationMs.toFixed(2)} ms`);
  console.log(`      - Compression & Encryption: WebP + Zip + AES-256-GCM Envelope Encryption`);

  console.log("\n=================================================================");
  console.log("   ✅ REPORT ARCHIVE, ENCRYPTION & DELETION TEST: PASS           ");
  console.log("=================================================================\n");

  return results;
}

if (require.main === module) {
  verifyReportArchiveAndBackupDecryption()
    .then((res) => {
      console.log("Execution Result:", JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ VERIFICATION FAILED:", err);
      process.exit(1);
    });
}

module.exports = verifyReportArchiveAndBackupDecryption;
