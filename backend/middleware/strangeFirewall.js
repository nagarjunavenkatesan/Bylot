const crypto = require("crypto");

// In-memory store for suspicious IPs and their offense count
const rapSheet = new Map();

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown";
}

// Layer 1 — The Ghost Field: hidden field that bots fill, humans don't see
function ghostField(req, res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const honeypot = req.body?._hp;
    if (honeypot !== undefined && honeypot !== "") {
      const ip = getClientIp(req);
      const record = rapSheet.get(ip) || { count: 0 };
      record.count += 5;
      rapSheet.set(ip, record);
      return res.status(200).json({ success: true, message: "Form submitted successfully." });
    }
    delete req.body._hp;
  }
  next();
}

// Layer 2 — The Handshake: validates a session token in headers
function handshake(req, res, next) {
  if (req.path.startsWith("/api/admin/login") || req.path.startsWith("/health") || req.path.startsWith("/api/config")) {
    return next();
  }
  if (req.path.startsWith("/api/") && req.method !== "GET") {
    const token = req.headers["x-bylot-handshake"];
    if (!token || token.length < 8) {
      const ip = getClientIp(req);
      const record = rapSheet.get(ip) || { count: 0 };
      record.count += 2;
      rapSheet.set(ip, record);
      return res.status(403).json({ success: false, message: "Access denied." });
    }
  }
  next();
}

// Layer 3 — The Mirror: progressive delays for suspicious IPs
function mirror(req, res, next) {
  const ip = getClientIp(req);
  const record = rapSheet.get(ip);
  if (record && record.count > 0) {
    const delay = Math.min(record.count * 200, 4000);
    if (delay > 0) {
      setTimeout(() => next(), delay);
      return;
    }
  }
  next();
}

// Reset rap sheet periodically
setInterval(() => {
  rapSheet.clear();
}, 30 * 60 * 1000);

module.exports = { ghostField, handshake, mirror };
