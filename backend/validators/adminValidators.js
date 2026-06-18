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

module.exports = {
  login,
  idParam,
  approveSeller,
  blockUser,
  productStatus,
  resolveReport
};
