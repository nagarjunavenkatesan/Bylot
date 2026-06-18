const express = require("express");
const controller = require("../controllers/adminController");
const validate = require("../middleware/validateMiddleware");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { authLimiter, apiLimiter } = require("../middleware/rateLimitMiddleware");
const validators = require("../validators/adminValidators");

const router = express.Router();

router.post("/login", authLimiter, validators.login, validate, controller.adminLogin);

router.use(authenticate, authorize("admin"), apiLimiter);
router.get("/users", controller.getAllUsers);
router.get("/sellers", controller.getSellers);
router.patch("/sellers/:id/approve", validators.idParam, validators.approveSeller, validate, controller.approveSeller);
router.patch("/users/:id/status", validators.idParam, validators.blockUser, validate, controller.blockUser);
router.get("/dashboard", controller.dashboardAnalytics);
router.get("/district-analytics", controller.districtAnalytics);
router.get("/products", controller.manageProducts);
router.patch("/products/:id/status", validators.idParam, validators.productStatus, validate, controller.updateProductStatus);
router.delete("/products/:id", validators.idParam, validate, controller.deleteProduct);
router.get("/reports", controller.getReports);
router.patch("/reports/:id/resolve", validators.idParam, validators.resolveReport, validate, controller.resolveReport);

module.exports = router;
