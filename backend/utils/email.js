/**
 * Shared email normalization helper.
 * Uses lowercase and trim only (does NOT strip dots or plus aliases to prevent collisions and ensure matching with Google OAuth).
 */
function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

module.exports = {
  normalizeEmail
};
