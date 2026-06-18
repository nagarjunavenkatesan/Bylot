const express = require("express");
const { param } = require("express-validator");
const controller = require("../controllers/categoryController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();

router.get("/", controller.getCategories);
router.get("/:id/products", param("id").isInt({ min: 1 }), validate, controller.getCategoryProducts);

module.exports = router;
