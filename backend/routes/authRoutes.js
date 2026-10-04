const express = require("express");
const controller = require("../controllers/authController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimitMiddleware");
const { cookieCsrfProtection } = require("../middleware/csrfProtection");
const validators = require("../validators/authValidators");

const router = express.Router();

router.post("/register", authLimiter, validators.register, validate, controller.register);
router.post("/verify-email", authLimiter, validators.verifyEmail, validate, controller.verifyEmail);
router.get("/verify-email", authLimiter, controller.verifyEmail);
router.post("/resend-verification", authLimiter, validators.resendVerification, validate, controller.resendVerification);
router.post("/login", authLimiter, validators.login, validate, controller.login);
router.post("/google-login", authLimiter, validators.googleLogin, validate, controller.googleLogin);
router.post("/logout", cookieCsrfProtection, authenticate, controller.logout);
router.post("/refresh-token", cookieCsrfProtection, validators.refreshToken, validate, controller.refreshToken);
router.post("/forgot-password", authLimiter, validators.forgotPassword, validate, controller.forgotPassword);
router.post("/reset-password", authLimiter, validators.resetPassword, validate, controller.resetPassword);

module.exports = router;
