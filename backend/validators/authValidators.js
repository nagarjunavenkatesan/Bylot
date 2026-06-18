const { body } = require("express-validator");

const register = [
  body("name").trim().isLength({ min: 2, max: 120 }),
  body("email").isEmail().normalizeEmail(),
  body("phone").optional({ nullable: true }).trim().isLength({ max: 30 }),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").optional().isIn(["customer", "seller"])
];

const login = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty()
];

const googleLogin = [
  body("idToken").notEmpty()
];

const refreshToken = [
  body("refreshToken").notEmpty()
];

const forgotPassword = [
  body("email").isEmail().normalizeEmail()
];

const resetPassword = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
];

module.exports = {
  register,
  login,
  googleLogin,
  refreshToken,
  forgotPassword,
  resetPassword
};
