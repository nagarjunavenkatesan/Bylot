const express = require("express");
const controller = require("../controllers/authController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimitMiddleware");
const validators = require("../validators/authValidators");

const router = express.Router();

router.post("/register", authLimiter, validators.register, validate, controller.register);
router.post("/login", authLimiter, validators.login, validate, controller.login);
router.post("/google-login", authLimiter, validators.googleLogin, validate, controller.googleLogin);
router.post("/logout", authenticate, controller.logout);
router.post("/refresh-token", validators.refreshToken, validate, controller.refreshToken);
router.post("/forgot-password", authLimiter, validators.forgotPassword, validate, controller.forgotPassword);
router.post("/reset-password", authLimiter, validators.resetPassword, validate, controller.resetPassword);

module.exports = router;
