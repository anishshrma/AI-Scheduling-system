const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: "" },
    event: { type: String, default: "" },
    category: { type: String, default: "General" },
    customCategory: { type: String, default: "" },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    startDate: { type: Date },
    endDate: { type: Date },
    steps: [{
        date: String,
        sh: String,
        sm: String,
        sap: String,
        eh: String,
        em: String,
        eap: String,
        work: String
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Schedule", scheduleSchema);
