const auditLogger = require("./auditLogger");

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function checkObjectForPrototypePollution(obj, req = null, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === "object") {
        checkObjectForPrototypePollution(item, req, depth + 1);
      }
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      auditLogger.logEvent("SUSPICIOUS_PAYLOAD", req, {
        severity: "CRITICAL",
        details: `Prototype pollution attempt blocked: key '${key}'`
      });
      delete obj[key];
      continue;
    }

    const val = obj[key];
    if (val && typeof val === "object") {
      checkObjectForPrototypePollution(val, req, depth + 1);
    }
  }
}

function inputSanitizerMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body === "object") {
      checkObjectForPrototypePollution(req.body, req);
    }
    next();
  } catch {
    next();
  }
}

module.exports = {
  checkObjectForPrototypePollution,
  inputSanitizerMiddleware
};
