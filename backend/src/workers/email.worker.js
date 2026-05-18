const emailQueue = require("../queues/email.queue");
const mlService = require("../services/ml.service");
const Email = require("../modules/email/email.model");
const taskService = require("../modules/tasks/tasks.service");

console.log("🚀 Worker started and waiting for jobs...");

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

emailQueue.process(async (job) => {
    const { email, userId } = job.data;

    try {
        console.log("\n📨 WORKER PROCESSING:", email.subject);

        // =========================
        // 🔍 DUPLICATE CHECK
        // =========================
        const exists = await Email.findOne({
            messageId: email.id,
            user: userId
        });

        if (exists) {
            console.log("⚠️ DUPLICATE SKIPPED");
            return;
        }

        // =========================
        // 🧠 ML
        // =========================
        let category = "Other";

        try {
            const result = await mlService.classifyEmail(email.text);
            category = result?.category || "Other";
        } catch (err) {
            console.log("⚠️ ML FAILED:", err.message);
        }

        console.log("📊 CATEGORY:", category);

        // =========================
        // 💾 SAVE EMAIL
        // =========================
        const saved = await Email.create({
            subject: email.subject,
            category,
            summary: email.text?.slice(0, 150),
            messageId: email.id, // ✅ FIXED (IMPORTANT)
            user: userId,
            raw: email
        });

        console.log("✅ SAVED:", saved._id);

        // =========================
        // 📌 CREATE TASK
        // =========================
        await taskService.createTask({
            title: email.subject || email.text?.slice(0, 50),
            category,
            priority: "medium",
            user: userId
        });

        console.log("📌 TASK CREATED");

        await sleep(1000);

    } catch (err) {
        console.log("❌ WORKER ERROR:", err.message);
    }
});