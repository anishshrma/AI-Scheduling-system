const axios = require("axios");

let TOKEN = null;
let TOKEN_EXPIRY = null;

// =========================
// 🔥 GET TOKEN (CACHED)
// =========================
const getToken = async () => {
    try {
        const res = await axios.post(
            "https://email-classifier-microservice.onrender.com/token"
        );

        TOKEN = res.data.token;

        TOKEN_EXPIRY = Date.now() + (60 * 60 * 1000);

        console.log("✅ ML Token fetched");

    } catch (err) {
        console.error("❌ Token fetch failed:", err.message);
        throw new Error("Token generation failed");
    }
};

// =========================
// 🔥 ENSURE TOKEN
// =========================
const ensureToken = async () => {
    if (!TOKEN || Date.now() > TOKEN_EXPIRY) {
        await getToken();
    }
};

// =========================
// 🧠 FALLBACK CLASSIFIER (CRITICAL)
// =========================
const fallbackClassifier = (text) => {
    const t = text.toLowerCase();

    if (t.includes("intern")) return "Internship";
    if (t.includes("placement") || t.includes("hiring") || t.includes("job")) return "Placement";
    if (t.includes("assignment")) return "Assignment";
    if (t.includes("exam") || t.includes("test")) return "Exam";
    if (t.includes("course")) return "Course";
    if (t.includes("seminar") || t.includes("webinar") || t.includes("event")) return "Event";
    if (t.includes("project")) return "Project";

    return "Other";
};

// =========================
// 🧠 NORMALIZE CATEGORY
// =========================
const normalizeCategory = (cat) => {
    if (!cat) return "Other";

    const c = cat.toLowerCase();

    if (c.includes("intern")) return "Internship";
    if (c.includes("place") || c.includes("job")) return "Placement";
    if (c.includes("assign")) return "Assignment";
    if (c.includes("exam")) return "Exam";
    if (c.includes("course")) return "Course";
    if (c.includes("event") || c.includes("seminar")) return "Event";
    if (c.includes("project")) return "Project";

    return "Other";
};

// =========================
// 🧠 CLASSIFY EMAIL
// =========================
exports.classifyEmail = async (text) => {
    try {
        await ensureToken();

        const response = await axios.post(
            process.env.ML_API_URL,
            { text },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${TOKEN}`,
                },
                timeout: 10000
            }
        );

        const rawCategory =
            response.data?.category ||
            response.data?.prediction ||
            "";

        return {
            category: normalizeCategory(rawCategory)
        };

    } catch (error) {

        // 🔁 TOKEN EXPIRED → retry once
        if (error.response?.status === 401) {
            console.log("🔄 Token expired, regenerating...");
            TOKEN = null;
            return exports.classifyEmail(text);
        }

        console.log("⚠️ ML failed → using fallback");

        return {
            category: fallbackClassifier(text)
        };
    }
};