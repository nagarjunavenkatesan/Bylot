const { body, param } = require("express-validator");

const orderId = [
  param("id").isInt({ min: 1 })
];

const createOrder = [
  body("sellerId").isInt({ min: 1 }),
  body("locationId").optional({ nullable: true }).isInt({ min: 1 }),
  body("items").isArray({ min: 1 }),
  body("items.*.productId").isInt({ min: 1 }),
  body("items.*.quantity").isInt({ min: 1 }),
  body("notes").optional({ nullable: true }).trim().isLength({ max: 1000 })
];

const cancelOrder = [
  body("reason").optional({ nullable: true }).trim().isLength({ max: 255 })
];

module.exports = {
  orderId,
  createOrder,
  cancelOrder
};
