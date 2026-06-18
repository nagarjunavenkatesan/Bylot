const express = require("express");
const controller = require("../controllers/paymentController");
const validate = require("../middleware/validateMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const validators = require("../validators/paymentValidators");

const router = express.Router();

router.use(authenticate);
router.post("/", validators.createPayment, validate, controller.createPayment);
router.post("/verify", validators.verifyPayment, validate, controller.verifyPayment);

module.exports = router;
