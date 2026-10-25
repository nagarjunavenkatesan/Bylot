const { body, param } = require("express-validator");

const login = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty()
];

const idParam = [
  param("id").isInt({ min: 1 })
];

const approveSeller = [
  body("approvalStatus").isIn(["approved", "rejected"])
];

const blockUser = [
  body("status").isIn(["active", "blocked"])
];

const productStatus = [
  body("status").isIn(["draft", "active", "inactive", "out_of_stock", "blocked"])
];

const resolveReport = [
  body("status").isIn(["reviewed", "resolved", "dismissed"]),
  body("adminNote").optional({ nullable: true }).trim().isLength({ max: 500 })
];

const deleteSelectedExpired = [
  body("productIds")
    .isArray({ min: 1, max: 1000 })
    .withMessage("productIds must be a non-empty array of product IDs"),
  body("productIds.*")
    .isInt({ min: 1 })
    .withMessage("Each product ID must be a positive integer")
];

const verifyLogin2FA = [
  body("challengeId").isString().isLength({ min: 16, max: 64 }).withMessage("Valid challengeId is required"),
  body().custom((value, { req }) => {
    const raw = req.body.code !== undefined ? req.body.code : req.body.totpCode;
    if (raw === undefined || raw === null || !/^\d{6}$/.test(String(raw).trim())) {
      throw new Error("6-digit verification code is required");
    }
    return true;
  })
];

const verifySetup2FA = [
  body("challengeId").isString().isLength({ min: 16, max: 64 }).withMessage("Valid challengeId is required"),
  body().custom((value, { req }) => {
    const raw = req.body.code !== undefined ? req.body.code : req.body.totpCode;
    if (raw === undefined || raw === null || !/^\d{6}$/.test(String(raw).trim())) {
      throw new Error("6-digit verification code is required");
    }
    return true;
  })
];

const recovery2FA = [
  body("challengeId").isString().isLength({ min: 16, max: 64 }).withMessage("Valid challengeId is required"),
  body().custom((value, { req }) => {
    const raw = req.body.recoveryCode !== undefined ? req.body.recoveryCode : req.body.code;
    if (!raw || typeof raw !== "string" || raw.trim().length < 6 || raw.trim().length > 40) {
      throw new Error("Valid recovery code is required");
    }
    return true;
  })
];

const disable2FA = [
  body("currentTotp").isString().trim().matches(/^\d{6}$/).withMessage("Current 6-digit TOTP code is required for verification"),
  body("password").isString().notEmpty().withMessage("Current admin password is required")
];

const regenerateRecovery = [
  body("currentTotp").isString().trim().matches(/^\d{6}$/).withMessage("Current 6-digit TOTP code is required for verification")
];

module.exports = {
  login,
  idParam,
  approveSeller,
  blockUser,
  productStatus,
  resolveReport,
  deleteSelectedExpired,
  verifyLogin2FA,
  verifySetup2FA,
  recovery2FA,
  disable2FA,
  regenerateRecovery
};
