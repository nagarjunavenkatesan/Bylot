const auditLogger = require("./auditLogger");

// Pattern checks for input sanitization
const PROTOTYPE_POLLUTION_KEYS = ["__proto__", "constructor", "prototype"];
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:\s*/i,
  /onload\s*=/i,
  /onerror\s*=/i,
  /(\b(union\s+select|drop\s+table|exec\s+xp_cmdshell|sp_executesql)\b)/i
];

function sanitizeString(str) {
  if (typeof str !== "string") return str;
  
  // Strip dangerous html tags or javascript scripts
  let sanitized = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/onload=/gi, "")
    .replace(/onerror=/gi, "");
  
  return sanitized;
}

function sanitizeObject(obj, req = null, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, req, depth + 1));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
      auditLogger.logEvent("SUSPICIOUS_PAYLOAD", req, {
        severity: "CRITICAL",
        details: `Prototype pollution attempt blocked key: ${key}`
      });
      continue;
    }

    if (typeof value === "string") {
      cleaned[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = sanitizeObject(value, req, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

function inputSanitizerMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body, req);
    }
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query, req);
    }
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params, req);
    }
    next();
  } catch (err) {
    console.error("[inputSanitizer] Sanitization error:", err);
    next();
  }
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  inputSanitizerMiddleware
};
