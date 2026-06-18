const { body } = require("express-validator");

const sendNotification = [
  body("userId").optional({ nullable: true }).isInt({ min: 1 }),
  body("title").trim().isLength({ min: 2, max: 160 }),
  body("message").trim().isLength({ min: 2 }),
  body("type").optional().isIn(["system", "order", "offer", "inventory", "admin"]),
  body("channel").optional().isIn(["in_app", "email", "sms", "push"]),
  body("data").optional({ nullable: true }).isObject()
];

module.exports = {
  sendNotification
};
