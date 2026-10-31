const express = require("express");
const controller = require("../controllers/adminController");
const validate = require("../middleware/validateMiddleware");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const { authLimiter, twoFactorLimiter, apiLimiter } = require("../middleware/rateLimitMiddleware");
const validators = require("../validators/adminValidators");

const router = express.Router();

router.post("/login", authLimiter, validators.login, validate, controller.adminLogin);

// Public 2FA challenge resolution endpoints
router.post("/2fa/verify-login", twoFactorLimiter, validators.verifyLogin2FA, validate, controller.verifyLogin2FA);
router.post("/2fa/verify-setup", twoFactorLimiter, validators.verifySetup2FA, validate, controller.verifySetup2FA);
router.post("/2fa/verify-recovery", twoFactorLimiter, validators.recovery2FA, validate, controller.recoveryLogin2FA);
router.post("/2fa/recovery", twoFactorLimiter, validators.recovery2FA, validate, controller.recoveryLogin2FA);

router.use(authenticate, authorize("admin"), apiLimiter);

// Authenticated Admin 2FA Settings Endpoints
router.get("/2fa/status", controller.get2FAStatus);
router.post("/2fa/setup", twoFactorLimiter, controller.initiate2FASetup);
router.post("/2fa/regenerate-recovery-codes", twoFactorLimiter, validators.regenerateRecovery, validate, controller.regenerateRecoveryCodes);
router.post("/2fa/disable", twoFactorLimiter, validators.disable2FA, validate, controller.disable2FA);
router.get("/users", controller.getAllUsers);
router.get("/sellers", controller.getSellers);
router.patch("/sellers/:id/approve", validators.idParam, validators.approveSeller, validate, controller.approveSeller);
router.patch("/users/:id/status", validators.idParam, validators.blockUser, validate, controller.blockUser);
router.get("/dashboard", controller.dashboardAnalytics);
router.get("/district-analytics", controller.districtAnalytics);
router.get("/products", controller.manageProducts);
router.get("/products/expired", controller.getExpiredProducts);
router.get("/products/expired/count", controller.getExpiredProductsCount);
router.delete("/products/expired", controller.deleteAllExpiredProducts);
router.delete("/products/expired/selected", validators.deleteSelectedExpired, validate, controller.deleteSelectedExpiredProducts);
router.delete("/products/expired/:id", validators.idParam, validate, controller.deleteSingleExpiredProduct);
router.get("/products/by-id", controller.searchProductByItemId);
router.get("/products/deleted", controller.getDeletedProducts);
router.patch("/products/:id/status", validators.idParam, validators.productStatus, validate, controller.updateProductStatus);
router.delete("/products/:id", validators.idParam, validate, controller.deleteProduct);
const archiveController = require("../controllers/reportArchiveController");

// Admin Complaints / Disputes Management (user reports against products)
router.get("/reports", controller.getReports);
router.patch("/reports/:id/resolve", validators.idParam, validators.resolveReport, validate, controller.resolveReport);

// Admin Reports & Evidence Archives Management (AES-256-GCM Encrypted)
router.get("/archives", archiveController.listReports);
router.get("/report-archives", archiveController.listReports);
router.post("/archives/generate", archiveController.generateReport);
router.post("/reports/generate", archiveController.generateReport);
router.get("/archives/:id/status", archiveController.getReportStatus);
router.get("/reports/:reportId/status", archiveController.getReportStatus);
router.get("/archives/:id/download", archiveController.downloadReport);
router.get("/reports/:reportId/download", archiveController.downloadReport);
router.delete("/archives/:id", archiveController.deleteReport);
router.delete("/reports/:reportId", archiveController.deleteReport);
router.post("/archives/cleanup", archiveController.cleanupExpired);

module.exports = router;
