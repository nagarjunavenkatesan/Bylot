const { body } = require("express-validator");
const { normalizeEmail } = require("../utils/email");
const { checkPasswordStrength } = require("../utils/password");

const register = [
  body("name").trim().isLength({ min: 2, max: 120 }).withMessage("Name must be between 2 and 120 characters"),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(val => normalizeEmail(val)),
  body("phone").optional({ nullable: true }).trim().isLength({ max: 30 }),
  body("password")
    .isString()
    .custom((password, { req }) => {
      const strength = checkPasswordStrength(password, {
        email: req.body.email,
        name: req.body.name
      });
      if (!strength.valid) {
        throw new Error(strength.message);
      }
      return true;
    }),
  body("role").optional().isIn(["customer", "seller"]).withMessage("Role must be customer or seller")
];

const login = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(val => normalizeEmail(val)),
  body("password").notEmpty().withMessage("Password is required")
];

const googleLogin = [
  body("idToken").notEmpty().withMessage("Google ID token is required")
];

const refreshToken = [
  body("refreshToken").optional().isString()
];

const forgotPassword = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(val => normalizeEmail(val))
];

const resetPassword = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isString()
    .custom((password) => {
      const strength = checkPasswordStrength(password);
      if (!strength.valid) {
        throw new Error(strength.message);
      }
      return true;
    })
];

const verifyEmail = [
  body("token").optional().isString()
];

const resendVerification = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(val => normalizeEmail(val))
];

module.exports = {
  register,
  login,
  googleLogin,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
};

