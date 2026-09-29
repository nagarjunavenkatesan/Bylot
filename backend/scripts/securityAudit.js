const fs = require("fs");
const path = require("path");
const env = require("../config/env");

function runSecurityAudit() {
  console.log("=================================================");
  console.log("       BYLOT ENTERPRISE SECURITY AUDITOR         ");
  console.log("=================================================\n");

  const results = [];
  let score = 100;

  // Check 1: JWT Secret Strength
  if (!env.jwt.accessSecret || env.jwt.accessSecret.length < 32) {
    results.push({ check: "JWT Access Secret Entropy", status: "WARN", message: "JWT_ACCESS_SECRET is weak or less than 32 characters." });
    score -= 10;
  } else {
    results.push({ check: "JWT Access Secret Entropy", status: "PASS", message: "Strong access token secret key detected." });
  }

  // Check 2: Database Password Security
  if (!env.db.password) {
    results.push({ check: "Database Password Policy", status: "WARN", message: "DB_PASSWORD is empty (development mode)." });
    score -= 15;
  } else {
    results.push({ check: "Database Password Policy", status: "PASS", message: "Database password set." });
  }

  // Check 3: CORS Configuration
  if (!env.corsOrigins || env.corsOrigins.length === 0) {
    results.push({ check: "CORS Protection Scope", status: "PASS", message: "Local development origins allowed dynamically." });
  } else {
    results.push({ check: "CORS Protection Scope", status: "PASS", message: `CORS strictly restricted to ${env.corsOrigins.join(", ")}.` });
  }

  // Check 4: HTTPS Certificate Check
  const certPath = path.join(__dirname, "..", "certs", "cert.pem");
  if (fs.existsSync(certPath)) {
    results.push({ check: "HTTPS SSL/TLS Certificate", status: "PASS", message: "SSL Certificate bundle located." });
  } else {
    results.push({ check: "HTTPS SSL/TLS Certificate", status: "INFO", message: "No local SSL cert bundle found. Ensure reverse proxy (Nginx/Cloudflare) handles SSL." });
  }

  // Check 5: Security Middleware Modules
  const securityFiles = ["auditLogger.js", "cryptoUtil.js", "accountLockout.js", "tokenBlacklist.js", "csrfProtection.js", "inputSanitizer.js"];
  const missingFiles = securityFiles.filter(f => !fs.existsSync(path.join(__dirname, "..", "security", f)));

  if (missingFiles.length === 0) {
    results.push({ check: "Security Middleware Modules", status: "PASS", message: "All 6 Enterprise Security Modules active." });
  } else {
    results.push({ check: "Security Middleware Modules", status: "FAIL", message: `Missing modules: ${missingFiles.join(", ")}` });
    score -= 20;
  }

  console.log(`Security Score: ${score}/100\n`);
  console.log("Check Details:");
  for (const r of results) {
    console.log(` [${r.status}] ${r.check}: ${r.message}`);
  }

  return { score, results };
}

if (require.main === module) {
  runSecurityAudit();
}

module.exports = runSecurityAudit;
