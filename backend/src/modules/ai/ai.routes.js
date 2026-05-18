const express = require("express");
const router = express.Router();
const controller = require("./ai.controller");
const authMiddleware = require("../../middleware/auth.middleware");

// ✅ PROTECTED ROUTE
router.post("/classify", authMiddleware, controller.classifyEmail);

module.exports = router;