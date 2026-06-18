const express = require("express");
const controller = require("../controllers/notificationController");
const validate = require("../middleware/validateMiddleware");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const validators = require("../validators/notificationValidators");

const router = express.Router();

router.get("/", authenticate, controller.getNotifications);
router.post("/", authenticate, authorize("admin"), validators.sendNotification, validate, controller.sendNotification);

module.exports = router;
