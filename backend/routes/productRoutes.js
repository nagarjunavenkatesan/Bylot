const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/productController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const validators = require("../validators/productValidators");

const router = express.Router();

router.get("/", validators.productList, validate, controller.getAllProducts);
router.get("/search", validators.productList, validate, controller.searchProducts);
router.get("/filter", validators.productList, validate, controller.filterProducts);
router.get("/discounts", validators.productList, validate, controller.discountProducts);
router.get("/near-expiry", validators.productList, validate, controller.nearExpiryProducts);
router.get("/nearby", validators.nearby, validate, controller.nearbyProducts);
router.get("/:id", validators.productId, validate, controller.getProductById);

// Fraud report — any authenticated user can flag a product
router.post(
  "/:id/report",
  authenticate,
  validators.productId,
  [
    body("reason").isIn(["fake_product", "wrong_expiry", "misleading_price", "poor_quality", "already_expired", "other"]),
    body("description").optional({ nullable: true }).trim().isLength({ max: 1000 })
  ],
  validate,
  controller.reportProduct
);

module.exports = router;
