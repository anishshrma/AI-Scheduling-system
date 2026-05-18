const { google } = require("googleapis");
const googleService = require("./google.service");
const mlService = require("../../services/ml.service");
const t5Service = require("../../services/t5.service");
const taskService = require("../tasks/tasks.service");
const Email = require("../email/email.model");
const User = require("../auth/auth.model");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// 🔥 DEBUG MODE
const DEBUG = true;

const blockedKeywords = [
    "linkedin",
    "nptel",
    "coursera",
    "naukri",
    "udemy",
    "infosys",
    "springboard",
];

// =========================
// 🚀 MAIN CONTROLLER
// =========================
exports.fetchAndProcessEmails = async (req, res) => {
    try {
        const userId = req.user.id;

        console.log("🔥 FETCH STARTED FOR USER:", userId);

        const user = await User.findById(userId);

        if (!user) {
            console.log("❌ USER NOT FOUND");
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.googleRefreshToken) {
            console.log("❌ NO REFRESH TOKEN");
            return res.status(401).json({ error: "Re-login required" });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
        });

        // =========================
        // 🔥 FETCH EMAILS
        // =========================
        console.log("📡 CALLING GOOGLE SERVICE...");
        const emails = await googleService.fetchEmails(oauth2Client);

        console.log(`📩 TOTAL EMAILS FETCHED: ${emails.length}`);

        // 🔥 RETURN FAST (IMPORTANT)
        res.json({
            success: true,
            totalFetched: emails.length,
        });

        // 🔥 PROCESS IN BACKGROUND
        processEmailsInBackground(emails, userId);

    } catch (err) {
        console.error("❌ FETCH ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// =========================
// 🔥 BACKGROUND PROCESSING
// =========================
async function processEmailsInBackground(emails, userId) {
    console.log("🚀 PROCESSING STARTED");

    let stats = {
        saved: 0,
        skipped: 0,
        aiFailed: 0
    };

    for (let email of emails) {
        try {
            const text = email.text || "";
            const subject = email.subject || "";

            if (!text.trim()) {
                stats.skipped++;
                continue;
            }

            if (DEBUG) {
                console.log("\n==============================");
                console.log("📩 SUBJECT:", subject);
            }

            const combined = (subject + " " + text).toLowerCase();

            // =========================
            // 🔥 BLOCK FILTER
            // =========================
            if (blockedKeywords.some((k) => combined.includes(k))) {
                if (DEBUG) console.log("🚫 BLOCKED EMAIL");
                stats.skipped++;
                continue;
            }

            // =========================
            // 🔥 DUPLICATE CHECK
            // =========================
            const exists = await Email.findOne({
                messageId: email.id,
                user: userId,
            });

            if (exists) {
                if (DEBUG) console.log("⚠️ DUPLICATE SKIPPED");
                stats.skipped++;
                continue;
            }

            // =========================
            // 🔥 ML + T5
            // =========================
            let category = "Other";
            let extracted = {};

            try {
                console.log("🧠 ML RUNNING...");
                const result = await mlService.classifyEmail(text);

                category = normalizeCategory(
                    result?.category || result?.prediction || "Other"
                );

                console.log("📊 CATEGORY:", category);

                console.log("🤖 T5 RUNNING...");
                extracted = await t5Service.extractDetails(text, category);

                console.log("🧾 T5:", extracted);

            } catch (err) {
                console.log("⚠️ AI FAILED:", err.message);
                stats.aiFailed++;
            }

            // =========================
            // 🔥 DEADLINE
            // =========================
            const deadline =
                parseDate(extracted?.deadline) ||
                extractDateFromText(text);

            // =========================
            // 🔥 PRIORITY
            // =========================
            const priority = getPriority(deadline);

            // =========================
            // 🔥 STATUS
            // =========================
            const status = getStatus(deadline, false);

            // =========================
            // 🔥 IMPORTANT FLAG
            // =========================
            const isImportant =
                ["Placement", "Internship", "Exam"].includes(category) ||
                !!deadline;

            // =========================
            // 🔥 SUMMARY
            // =========================
            const summary = buildSummary(extracted, subject);

            if (DEBUG) console.log("📝 SUMMARY:", summary);

            // =========================
            // 🔥 SAVE EMAIL
            // =========================
            const saved = await Email.create({
                subject,
                category,
                summary,
                messageId: email.id,
                user: userId,
                priority,
                status,
                isImportant,
                deadline,
                raw: {
                    text,
                    from: email.from,
                    date: email.date,
                    ...extracted,
                },
            });

            console.log("💾 SAVED:", saved._id);

            stats.saved++;

            // =========================
            // 🔥 CREATE TASK
            // =========================
            await taskService.createTask({
                title: subject || extracted?.title || "Task",
                category,
                priority,
                status,
                deadline,
                user: userId,
            });

            await sleep(800);

        } catch (err) {
            console.log("❌ EMAIL ERROR:", err.message);
        }
    }

    console.log("\n==============================");
    console.log("✅ DONE PROCESSING");
    console.log("📊 STATS:", stats);
}

// =========================
// 🔥 CATEGORY NORMALIZER
// =========================
function normalizeCategory(cat) {
    const c = cat.toLowerCase();

    if (c.includes("intern")) return "Internship";
    if (c.includes("place")) return "Placement";
    if (c.includes("assign")) return "Assignment";
    if (c.includes("exam")) return "Exam";
    if (c.includes("course")) return "Course";
    if (c.includes("event") || c.includes("seminar")) return "Event";
    if (c.includes("project")) return "Project";

    return "Other";
}

// =========================
// 🔥 PRIORITY
// =========================
function getPriority(deadline) {
    if (!deadline) return "low";

    const diff = (deadline - new Date()) / (1000 * 60 * 60);

    if (diff <= 24) return "high";
    if (diff <= 72) return "medium";

    return "low";
}

// =========================
// 🔥 STATUS
// =========================
function getStatus(deadline, isCompleted) {
    if (isCompleted) return "completed";
    if (deadline && deadline < new Date()) return "overdue";
    return "pending";
}

// =========================
// 🔥 DATE PARSER
// =========================
function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d) ? null : d;
}

// =========================
// 🔥 FALLBACK DATE
// =========================
function extractDateFromText(text) {
    const match = text.match(
        /\b(\d{1,2} (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4})\b/i
    );
    return match ? new Date(match[0]) : null;
}

// =========================
// 🔥 SUMMARY BUILDER
// =========================
function buildSummary(data, subject) {
    return `${data?.company || ""} ${data?.role || ""}`.trim() || subject;
}