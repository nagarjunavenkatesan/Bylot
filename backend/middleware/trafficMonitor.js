const { pool } = require("../config/db");

const WINDOW_MS = 60 * 1000;
const WARNING_THRESHOLD = 100;
const CRITICAL_THRESHOLD = 300;

const requestLog = [];
let isWarning = false;
let isCritical = false;
let lastAlertedLevel = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

const originalConnectionLimit = 10;
let currentConnectionLimit = originalConnectionLimit;

function getRequestRate() {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (requestLog.length && requestLog[0] < cutoff) requestLog.shift();
  return requestLog.length;
}

function enableProtection(level) {
  if (level === "critical") {
    currentConnectionLimit = Math.max(5, Math.floor(originalConnectionLimit / 2));
    isWarning = true;
    isCritical = true;
  } else if (level === "warning") {
    currentConnectionLimit = originalConnectionLimit + 10;
    isWarning = true;
    isCritical = false;
  }
}

function disableProtection() {
  if (currentConnectionLimit !== originalConnectionLimit) {
    currentConnectionLimit = originalConnectionLimit;
  }
  isWarning = false;
  isCritical = false;
}

function trafficMonitor(req, res, next) {
  // Do not count uploads, health checks, or static frontend files
  if (
    req.path.startsWith("/uploads") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/assets") ||
    /\.(png|jpe?g|webp|svg|ico|css|js|woff2?|map)$/i.test(req.path)
  ) {
    return next();
  }

  requestLog.push(Date.now());
  const rate = getRequestRate();

  if (rate >= CRITICAL_THRESHOLD) {
    enableProtection("critical");
  } else if (rate >= WARNING_THRESHOLD) {
    enableProtection("warning");
  } else {
    if (isCritical || isWarning) disableProtection();
  }

  req.traffic = { rate, isWarning, isCritical };
  // Global 503 is completely removed. Rate limiting is enforced per-IP via express-rate-limit.
  next();
}

async function checkAndAlert() {
  const rate = getRequestRate();
  let level = null;

  if (rate >= CRITICAL_THRESHOLD) level = "critical";
  else if (rate >= WARNING_THRESHOLD) level = "warning";

  if (level && level !== lastAlertedLevel && Date.now() - lastAlertTime > ALERT_COOLDOWN_MS) {
    lastAlertedLevel = level;
    lastAlertTime = Date.now();

    const title = `High Traffic Alert (${level})`;
    const message = `Site is experiencing ${level} traffic: ${rate} requests/min. Auto-protection engaged.`;

    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, channel, data)
         VALUES (NULL, ?, ?, 'system', 'in_app', ?)`,
        [title, message, JSON.stringify({ rate, level, timestamp: new Date().toISOString() })]
      );

      const emailService = require("../services/emailService");
      await emailService.sendAlertEmail(title, message);
    } catch (err) {
      console.error("Traffic alert notification failed:", err.message);
    }
  }

  if (!level) lastAlertedLevel = null;
}

const alertTimer = setInterval(checkAndAlert, 30 * 1000);
if (alertTimer.unref) alertTimer.unref();

module.exports = { trafficMonitor, getRequestRate, isWarning, isCritical };
