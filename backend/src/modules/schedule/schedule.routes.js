const express = require("express");
const router = express.Router();
const multer = require("multer");

const scheduleController = require("./schedule.controller");
const authMiddleware = require("../../middleware/auth.middleware");

const upload = multer({ dest: "uploads/" });

// AI Analyze (No auth required originally, but better to keep it as is)
router.post(
    "/analyze",
    upload.fields([
        { name: "document", maxCount: 1 },
        { name: "image", maxCount: 1 }
    ]),
    scheduleController.analyzeSchedule
);

// CRUD routes
router.get("/", authMiddleware, scheduleController.getSchedules);
router.post("/", authMiddleware, scheduleController.createSchedule);
router.put("/:id", authMiddleware, scheduleController.updateSchedule);
router.delete("/:id", authMiddleware, scheduleController.deleteSchedule);

module.exports = router;