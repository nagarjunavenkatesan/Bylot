const { body } = require("express-validator");

const upsertProfile = [
  body("businessName").trim().isLength({ min: 2, max: 160 }),
  body("businessType").optional().isIn(["daily_essentials", "near_expiry", "discount", "corporate_clearance", "mixed"]),
  body("gstNumber").optional({ nullable: true }).trim().isLength({ max: 40 }),
  body("licenseNumber").optional({ nullable: true }).trim().isLength({ max: 80 }),
  body("contactEmail").optional({ nullable: true }).isEmail().normalizeEmail(),
  body("contactPhone").optional({ nullable: true }).trim().isLength({ max: 30 }),
  body("addressLine1").optional({ nullable: true }).trim().isLength({ max: 190 }),
  body("addressLine2").optional({ nullable: true }).trim().isLength({ max: 190 }),
  body("city").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("state").optional({ nullable: true }).trim().isLength({ max: 100 }),
  body("postalCode").optional({ nullable: true }).trim().isLength({ max: 20 }),
  body("country").optional().trim().isLength({ max: 80 }),
  body("latitude").optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body("longitude").optional({ nullable: true }).isFloat({ min: -180, max: 180 })
];

module.exports = {
  upsertProfile
};
