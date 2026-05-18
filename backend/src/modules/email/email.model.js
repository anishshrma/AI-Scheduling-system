const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema({

    // =========================
    // 🔥 BASIC INFO
    // =========================
    subject: String,

    category: {
        type: String,
        default: "Other",
        index: true
    },

    summary: String,

    // =========================
    // 🔥 SYSTEM FIELDS
    // =========================
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low",
        index: true
    },

    status: {
        type: String,
        enum: ["pending", "completed", "overdue"],
        default: "pending",
        index: true
    },

    isImportant: {
        type: Boolean,
        default: false,
        index: true
    },

    deadline: {
        type: Date,
        index: true
    },

    // =========================
    // 🔥 IDENTIFICATION
    // =========================
    messageId: {
        type: String,
        required: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // =========================
    // 🔥 RAW DATA
    // =========================
    raw: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, { timestamps: true });


// 🔥 ONLY KEEP THIS (IMPORTANT)
emailSchema.index(
    { messageId: 1, user: 1 },
    { unique: true }
);

module.exports = mongoose.model("Email", emailSchema);