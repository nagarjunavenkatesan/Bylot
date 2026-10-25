const express = require("express");
const controller = require("../controllers/locationController");

const router = express.Router();

router.get("/states", controller.getStatesAndUTs);
router.get("/states/:codeOrState/districts", controller.getDistricts);
router.get("/verify", controller.verifyLocation);

module.exports = router;
