const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth.middleware");
const controller = require("./rating.controller");

router.post("/", authMiddleware, controller.submitRating);

module.exports = router;