const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true
    },

    description: {
        type: String,
        default: ""
    },

    category: {
        type: String,
        index: true,
        default: "General"
    },

    deadline: {
        type: Date,
        index: true
    },

    priority: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "medium",
        index: true
    },

    status: {
        type: String,
        enum: ["pending", "completed", "overdue"],
        default: "pending",
        index: true
    },

    // ⭐ NEW FEATURES
    isFavorite: {
        type: Boolean,
        default: false
    },

    isArchived: {
        type: Boolean,
        default: false
    },

    isDeleted: {
        type: Boolean,
        default: false
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);