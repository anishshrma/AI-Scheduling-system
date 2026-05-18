const express = require("express");
const router = express.Router();
const Email = require("./email.model");
const authMiddleware = require("../../middleware/auth.middleware");
const mongoose = require("mongoose");

// =========================
// 🔥 CATEGORY NORMALIZER
// =========================
const normalizeCategory = (cat) => {
    if (!cat) return null;

    const c = cat.toLowerCase();

    if (c === "all") return "All";
    if (c === "important") return "Important";

    if (c.includes("intern")) return "Internship";
    if (c.includes("place")) return "Placement";
    if (c.includes("assign")) return "Assignment";
    if (c.includes("exam")) return "Exam";
    if (c.includes("course")) return "Course";
    if (c.includes("event") || c.includes("seminar")) return "Event";
    if (c.includes("project")) return "Project";

    return "Other";
};

// =========================
// 🔥 PRIORITY WEIGHT
// =========================
const priorityWeight = {
    high: 3,
    medium: 2,
    low: 1
};

// =========================
// 📩 GET EMAILS (FIXED)
// =========================
router.get("/", authMiddleware, async (req, res) => {
    try {
        // ✅ FIX: Always convert to ObjectId safely
        const userId = mongoose.Types.ObjectId.isValid(req.user.id)
            ? new mongoose.Types.ObjectId(req.user.id)
            : req.user.id;

        const rawCategory = req.query.category;
        const category = normalizeCategory(rawCategory);

        let filter = { user: userId };

        if (category && category !== "All" && category !== "Important") {
            filter.category = category;
        }

        if (category === "Important") {
            filter.isImportant = true;
        }

        let emails = await Email.find(filter);

        // =========================
        // 🔥 SORTING
        // =========================
        emails = emails.sort((a, b) => {

            const pA = priorityWeight[a.priority] || 0;
            const pB = priorityWeight[b.priority] || 0;

            if (pB !== pA) return pB - pA;

            if (a.deadline && b.deadline) {
                return new Date(a.deadline) - new Date(b.deadline);
            }

            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // =========================
        // 🔥 COUNTS
        // =========================
        const counts = {
            All: await Email.countDocuments({ user: userId }),
            Important: await Email.countDocuments({ user: userId, isImportant: true }),
            Placement: await Email.countDocuments({ user: userId, category: "Placement" }),
            Internship: await Email.countDocuments({ user: userId, category: "Internship" }),
            Assignment: await Email.countDocuments({ user: userId, category: "Assignment" }),
            Exam: await Email.countDocuments({ user: userId, category: "Exam" }),
            Course: await Email.countDocuments({ user: userId, category: "Course" }),
            Event: await Email.countDocuments({ user: userId, category: "Event" }),
            Project: await Email.countDocuments({ user: userId, category: "Project" }),
        };

        res.json({
            success: true,
            emails,
            counts
        });

    } catch (err) {
        console.error("❌ Fetch error:", err.message);

        res.status(500).json({
            error: "Failed to fetch emails"
        });
    }
});

// =========================
// ✅ COMPLETE
// =========================
router.post("/complete", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ids } = req.body;

        await Email.updateMany(
            { _id: { $in: ids }, user: userId },
            { status: "completed" }
        );

        res.json({ message: "Marked as completed" });

    } catch (err) {
        console.error("❌ Complete error:", err.message);
        res.status(500).json({ error: "Failed to complete" });
    }
});

// =========================
// 📦 ARCHIVE
// =========================
router.post("/archive", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ids } = req.body;

        await Email.updateMany(
            { _id: { $in: ids }, user: userId },
            {
                priority: "low",
                isImportant: false
            }
        );

        res.json({ message: "Archived successfully" });

    } catch (err) {
        console.error("❌ Archive error:", err.message);
        res.status(500).json({ error: "Archive failed" });
    }
});

// =========================
// 🗑 DELETE
// =========================
router.post("/delete", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ids } = req.body;

        await Email.deleteMany({
            _id: { $in: ids },
            user: userId
        });

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("❌ Delete error:", err.message);
        res.status(500).json({ error: "Delete failed" });
    }
});

// =========================
// 🗑 SINGLE DELETE
// =========================
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const email = await Email.findOne({
            _id: req.params.id,
            user: userId
        });

        if (!email) {
            return res.status(404).json({
                error: "Email not found or unauthorized"
            });
        }

        await Email.findByIdAndDelete(req.params.id);

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("❌ Delete error:", err.message);
        res.status(500).json({ error: "Delete failed" });
    }
});

module.exports = router;