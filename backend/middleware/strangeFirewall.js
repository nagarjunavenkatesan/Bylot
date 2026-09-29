const crypto = require("crypto");

const rapSheet = new Map();
const requestTimestamps = new Map();
const blockedIPs = new Set();

const BOT_PATTERNS = [
  /curl\//i, /wget\//i, /python-requests/i, /go-http-client/i,
  /scrapy/i, /httpclient/i, /java\/[\d.]+/i, /ruby/i, /perl/i,
  /libwww/i, /php\//i, /nutch/i, /zgrab/i, /masscan/i, /nikto/i, /sqlmap/i
];

const ATTACK_PATTERNS = [
  /(\b(union\s+select|drop\s+table|delete\s+from|alter\s+table|exec\s+xp_cmdshell|sp_executesql|pg_sleep)\b)/i,
  /(<script[\s>])/i, /javascript:\s*alert/i,
  /(\b(shell_exec|passthru|system|popen|create_function)\s*\()/i,
  /(\.\.\/|\.\.\\)+/i,
  /(')\s*(\bOR\b|\bAND\b|\bUNION\b|\b--\b)\s/i, /(\bSLEEP\b)\s*\(/i
];

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

function penance(ip, points, reason) {
  const record = rapSheet.get(ip) || { count: 0, reasons: [] };
  record.count += points;
  record.reasons.push(reason);
  rapSheet.set(ip, record);
  if (record.count >= 50) blockedIPs.add(ip);
}

// Layer 1 — Ghost Field: honeypot catch
function ghostField(req, res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const honeypot = req.body?._hp;
    if (honeypot !== undefined && honeypot !== "") {
      penance(getClientIp(req), 10, "Ghost field filled");
      return res.status(200).json({ success: true, message: "Form submitted successfully." });
    }
    delete req.body._hp;
  }
  next();
}

// Layer 2 — Sigil: detect bot UAs and attack patterns
function sigil(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  if (BOT_PATTERNS.some(p => p.test(ua))) {
    penance(getClientIp(req), 8, `Bot UA detected: ${ua.slice(0, 40)}`);
    return res.status(200).json({ success: true, message: "Welcome." });
  }

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const raw = JSON.stringify(req.body);
    if (ATTACK_PATTERNS.some(p => p.test(raw))) {
      penance(getClientIp(req), 15, "Attack pattern in body");
      return res.status(200).json({ success: true, message: "Received." });
    }
  }

  for (const [key, value] of Object.entries(req.query)) {
    if (ATTACK_PATTERNS.some(p => p.test(key) || p.test(String(value)))) {
      penance(getClientIp(req), 10, `Attack pattern in query: ${key}`);
      return res.status(200).json({ success: true, message: "OK." });
    }
  }

  next();
}

// Layer 3 — Handshake: validate token on ALL non-GET API routes
function handshake(req, res, next) {
  const exemptPaths = ["/api/admin/login", "/health", "/api/config"];
  if (exemptPaths.some(p => req.path.startsWith(p))) return next();

  if (req.path.startsWith("/api/") && req.method !== "GET") {
    const token = req.headers["x-bylot-handshake"];
    if (!token || token.length < 8 || !/^[a-z0-9]+$/i.test(token)) {
      penance(getClientIp(req), 3, "Invalid handshake");
      return res.status(403).json({ success: false, message: "Access denied." });
    }
  }
  next();
}

// Layer 4 — Mirage: decoy endpoints (only paths real attackers probe, not SPA routes)
function mirage(req, res, next) {
  const decoyPaths = ["/wp-admin", "/wp-login", "/backup", "/.env", "/sql", "/phpmyadmin", "/_debug", "/api-docs", "/graphql"];
  if (decoyPaths.some(p => req.path.toLowerCase().startsWith(p))) {
    penance(getClientIp(req), 5, `Decoy path: ${req.path}`);
    return res.status(200).json({ success: true, message: "API running", data: { version: "2.4.1", status: "ok" } });
  }
  next();
}

// Layer 5 — Mirror: progressive delays + random jitter
function mirror(req, res, next) {
  const ip = getClientIp(req);
  const record = rapSheet.get(ip);
  if (record && record.count > 0) {
    const jitter = Math.random() * 500;
    const delay = Math.min(record.count * 150 + jitter, 5000);
    if (delay > 0) {
      setTimeout(() => next(), delay);
      return;
    }
  }
  next();
}

// Layer 6 — Threshold: rate-limit per IP
function threshold(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const window = 10000;

  if (!requestTimestamps.has(ip)) requestTimestamps.set(ip, []);
  const timestamps = requestTimestamps.get(ip);
  timestamps.push(now);
  while (timestamps.length && timestamps[0] < now - window) timestamps.shift();

  if (timestamps.length > 60) {
    penance(ip, 5, `Burst: ${timestamps.length} req/10s`);
    timestamps.splice(0, timestamps.length);
    return res.status(429).json({ success: false, message: "Too many requests. Please wait." });
  }

  if (timestamps.length > 30) {
    const delay = (timestamps.length - 30) * 100;
    setTimeout(() => next(), Math.min(delay, 3000));
    return;
  }

  next();
}

// Blocked IP check
function blocklist(req, res, next) {
  const ip = getClientIp(req);
  if (blockedIPs.has(ip)) {
    return res.status(200).json({ success: true, message: "Welcome back." });
  }
  next();
}

// Periodic cleanup
setInterval(() => {
  rapSheet.clear();
  requestTimestamps.clear();
  blockedIPs.clear();
}, 15 * 60 * 1000);

module.exports = { ghostField, sigil, handshake, mirage, mirror, threshold, blocklist };
