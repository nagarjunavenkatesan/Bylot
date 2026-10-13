const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const env = require("../config/env");

const BACKUP_DIR = path.resolve(__dirname, "../backups");
const RETENTION_DAYS = 7;
const TEST_DB_NAME = "bylot_restore_test";

async function createDatabaseDump(sourceConn, dbName) {
  await sourceConn.query("SET time_zone = '+00:00'");
  const [tables] = await sourceConn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = tables.map((t) => Object.values(t)[0]);

  let dumpSql = `-- BYLOT AUTOMATED LOGICAL BACKUP
-- Database: \`${dbName}\`
-- Timestamp: ${new Date().toISOString()}

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';
SET NAMES utf8mb4;

`;

  for (const table of tableNames) {
    // Table Structure
    const [[createRow]] = await sourceConn.query(`SHOW CREATE TABLE \`${table}\``);
    dumpSql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    dumpSql += `${createRow["Create Table"]};\n\n`;

    // Table Data
    const [rows] = await sourceConn.query(`SELECT * FROM \`${table}\``);
    if (rows.length > 0) {
      dumpSql += `INSERT INTO \`${table}\` VALUES `;
      const rowStrings = rows.map((row) => {
        const values = Object.values(row).map((val) => {
          if (val === null) return "NULL";
          if (typeof val === "number" || typeof val === "bigint") return String(val);
          if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
          if (Buffer.isBuffer(val)) return `X'${val.toString("hex")}'`;
          if (typeof val === "boolean") return val ? "1" : "0";
          if (typeof val === "object") {
            const jsonStr = JSON.stringify(val);
            return `'${jsonStr.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
          }
          return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
        });
        return `(${values.join(", ")})`;
      });
      dumpSql += rowStrings.join(",\n") + ";\n\n";
    }
  }

  dumpSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  return { dumpSql, tableNames };
}

function enforceRetentionPolicy(backupDir, retentionDays) {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".sql.gz"));
  const now = Date.now();
  const pruned = [];

  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    if (ageDays > retentionDays) {
      fs.unlinkSync(filePath);
      pruned.push(file);
    }
  }
  return pruned;
}

async function runBackupAndRestoreTest() {
  console.log("=================================================");
  console.log("   BYLOT DATABASE BACKUP & RESTORE VERIFICATION  ");
  console.log("=================================================\n");

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dbConfig = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    dateStrings: true
  };

  const sourceConn = await mysql.createConnection({
    ...dbConfig,
    database: env.db.database
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `bylot-backup-${timestamp}.sql.gz`;
  const backupFilePath = path.join(BACKUP_DIR, backupFilename);

  console.log(`[1/7] Generating logical database dump from \`${env.db.database}\`...`);
  const { dumpSql, tableNames } = await createDatabaseDump(sourceConn, env.db.database);

  console.log(`[2/7] Compressing backup to GZIP (\`${backupFilename}\`)...`);
  const compressedBuffer = zlib.gzipSync(Buffer.from(dumpSql, "utf8"));
  fs.writeFileSync(backupFilePath, compressedBuffer);

  const hash = crypto.createHash("sha256").update(compressedBuffer).digest("hex");
  const sizeKb = (compressedBuffer.length / 1024).toFixed(2);
  console.log(`      ✓ Backup created: ${backupFilePath} (${sizeKb} KB, SHA-256: ${hash.slice(0, 16)}...)`);

  // Retention check
  const pruned = enforceRetentionPolicy(BACKUP_DIR, RETENTION_DAYS);
  console.log(`      ✓ Retention policy verified: retained under ${RETENTION_DAYS} days (pruned ${pruned.length} old files)`);

  console.log(`[3/7] Setting up isolated test restore database \`${TEST_DB_NAME}\`...`);
  await sourceConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  await sourceConn.query(`CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  console.log(`[4/7] Restoring decompressed backup into \`${TEST_DB_NAME}\`...`);
  const decompressedSql = zlib.gunzipSync(fs.readFileSync(backupFilePath)).toString("utf8");
  const testConn = await mysql.createConnection({
    ...dbConfig,
    database: TEST_DB_NAME
  });
  await testConn.query(decompressedSql);

  console.log(`[5/7] Verifying restored schema and tables...`);
  const [restoredTables] = await testConn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const restoredTableNames = restoredTables.map((t) => Object.values(t)[0]);

  if (tableNames.length !== restoredTableNames.length) {
    throw new Error(`Table count mismatch! Source: ${tableNames.length}, Restored: ${restoredTableNames.length}`);
  }
  for (const t of tableNames) {
    if (!restoredTableNames.includes(t)) {
      throw new Error(`Table \`${t}\` missing in restored database!`);
    }
  }
  console.log(`      ✓ All ${tableNames.length} tables successfully restored: [${tableNames.join(", ")}]`);

  console.log(`[6/7] Verifying exact row counts and sample data across all tables...`);
  const countVerification = [];
  for (const t of tableNames) {
    const [[{ sourceCount }]] = await sourceConn.query(`SELECT COUNT(*) as sourceCount FROM \`${t}\``);
    const [[{ restoredCount }]] = await testConn.query(`SELECT COUNT(*) as restoredCount FROM \`${t}\``);

    if (sourceCount !== restoredCount) {
      throw new Error(`Row count mismatch in \`${t}\`: Source=${sourceCount}, Restored=${restoredCount}`);
    }

    if (sourceCount > 0) {
      const [sourceSample] = await sourceConn.query(`SELECT * FROM \`${t}\` ORDER BY id ASC LIMIT 1`);
      const [restoredSample] = await testConn.query(`SELECT * FROM \`${t}\` ORDER BY id ASC LIMIT 1`);
      const sJson = JSON.stringify(sourceSample[0]);
      const rJson = JSON.stringify(restoredSample[0]);
      if (sJson !== rJson) {
        throw new Error(`Sample record mismatch in \`${t}\`!`);
      }
    }
    countVerification.push({ table: t, rows: sourceCount });
  }
  console.log(`      ✓ All ${tableNames.length} tables have matching row counts and sample records.`);

  console.log(`[7/7] Testing application connection pool to restored database...`);
  const appTestPool = mysql.createPool({
    ...dbConfig,
    database: TEST_DB_NAME,
    connectionLimit: 3
  });
  const appConn = await appTestPool.getConnection();
  const [pingResult] = await appConn.query("SELECT 1 as live, DATABASE() as currentDb");
  appConn.release();
  await appTestPool.end();

  if (pingResult[0].live !== 1 || pingResult[0].currentDb !== TEST_DB_NAME) {
    throw new Error("Application pool verification failed on restored database.");
  }
  console.log(`      ✓ Application pool successfully connected and queried restored database.`);

  console.log(`\nCleaning up temporary test database \`${TEST_DB_NAME}\`...`);
  await testConn.end();
  await sourceConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
  await sourceConn.end();

  console.log("\n=================================================");
  console.log("   ✅ DATABASE BACKUP & RESTORE TEST: PASS       ");
  console.log("=================================================\n");

  return {
    status: "PASS",
    backupFile: backupFilePath,
    backupSizeBytes: compressedBuffer.length,
    backupSha256: hash,
    tablesVerified: tableNames.length,
    tableRowCounts: countVerification
  };
}

if (require.main === module) {
  runBackupAndRestoreTest()
    .then((result) => {
      console.log("Verification Summary:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ BACKUP & RESTORE TEST FAILED:", err.message);
      process.exit(1);
    });
}

module.exports = runBackupAndRestoreTest;
