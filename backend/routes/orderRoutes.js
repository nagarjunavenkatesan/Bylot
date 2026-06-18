const express = require("express");
const controller = require("../controllers/orderController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const validators = require("../validators/orderValidators");

const router = express.Router();

router.use(authenticate);
router.post("/", validators.createOrder, validate, controller.createOrder);
router.get("/", controller.getOrders);
router.patch("/:id/cancel", validators.orderId, validators.cancelOrder, validate, controller.cancelOrder);
router.get("/:id/track", validators.orderId, validate, controller.trackOrder);

module.exports = router;
