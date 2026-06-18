const { body } = require("express-validator");

const updateProfile = [
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("phone").optional({ nullable: true }).trim().isLength({ max: 30 })
];

module.exports = {
  updateProfile
};
