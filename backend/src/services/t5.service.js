const axios = require("axios");

// =========================
// 🧠 PROMPT BUILDER (CATEGORY AWARE)
// =========================
const buildPrompt = (text, category) => {

    switch (category?.toLowerCase()) {

        case "placement":
        case "internship":
            return `
Extract job/internship details.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Company:
Role:
Deadline:
Apply Link:

Text:
${text}
`;

        case "assignment":
            return `
Extract assignment details.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Title:
Course:
Deadline:
Instructions:
Submission Link:

Text:
${text}
`;

        case "exam":
            return `
Extract exam details.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Subject:
Date:
Time:
Syllabus:

Text:
${text}
`;

        case "course":
            return `
Extract course details.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Course Name:
Provider:
Start Date:
Duration:
Link:

Text:
${text}
`;

        case "event":
        case "seminar":
            return `
Extract event details.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Title:
Date:
Time:
Location:
Registration Link:

Text:
${text}
`;

        case "project":
            return `
Extract project details.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Project Title:
Deadline:
Requirements:

Text:
${text}
`;

        default:
            return `
Extract important info.

Rules:
- STRICT format Key: Value
- NO extra text
- If missing → N/A

Title:
Deadline:
Link:

Text:
${text}
`;
    }
};

// =========================
// 🤖 MAIN FUNCTION
// =========================
exports.extractDetails = async (text, category) => {
    try {
        const prompt = buildPrompt(text, category);

        const response = await axios.post(
            process.env.T5_API_URL,
            { inputs: prompt },
            {
                timeout: 20000,
                headers: {
                    Authorization: `Bearer ${process.env.T5_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // =========================
        // 🔥 HUGGINGFACE RESPONSE SAFE HANDLING
        // =========================
        let output = "";

        if (Array.isArray(response.data)) {
            output = response.data?.[0]?.generated_text || "";
        } else if (response.data?.generated_text) {
            output = response.data.generated_text;
        } else {
            output = "";
        }

        let parsed = parseOutput(output);

        // =========================
        // 🔥 LINK FALLBACK
        // =========================
        const links = extractLinks(text);

        if (!parsed.apply_link && links[0]) {
            parsed.apply_link = links[0];
        }

        if (!parsed.registration_link && links[1]) {
            parsed.registration_link = links[1];
        }

        if (!parsed.link && links[0]) {
            parsed.link = links[0];
        }

        // =========================
        // 🔥 NORMALIZE FIELDS
        // =========================
        parsed = normalizeFields(parsed);

        // =========================
        // 🔥 REMOVE EMPTY
        // =========================
        Object.keys(parsed).forEach(key => {
            if (
                !parsed[key] ||
                parsed[key] === "N/A" ||
                parsed[key] === "n/a"
            ) {
                delete parsed[key];
            }
        });

        return parsed;

    } catch (err) {

        console.error(
            "❌ T5 ERROR:",
            err.response?.data || err.message
        );

        // =========================
        // 🔥 SAFE FALLBACK
        // =========================
        return {
            title: text.slice(0, 80),
            apply_link: extractLinks(text)[0] || null
        };
    }
};

// =========================
// 🔍 PARSER
// =========================
const parseOutput = (text) => {
    const data = {};

    const lines = text
        .replace(/\r/g, "")
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    lines.forEach(line => {
        const idx = line.indexOf(":");

        if (idx === -1) return;

        const key = line
            .slice(0, idx)
            .trim()
            .toLowerCase()
            .replace(/ /g, "_");

        const value = line
            .slice(idx + 1)
            .trim();

        if (key && value) {
            data[key] = value;
        }
    });

    return data;
};

// =========================
// 🔥 NORMALIZE FIELDS
// =========================
const normalizeFields = (data) => {

    const map = {
        course_name: "course",
        project_title: "title",
        subject: "subject_name",
        company_name: "company",
        exam_date: "date",
        applylink: "apply_link",
        registrationlink: "registration_link"
    };

    Object.keys(map).forEach(key => {
        if (data[key]) {
            data[map[key]] = data[key];
            delete data[key];
        }
    });

    return data;
};

// =========================
// 🔗 LINK EXTRACTOR
// =========================
const extractLinks = (text) => {
    const regex = /(https?:\/\/[^\s]+)/g;
    return text.match(regex) || [];
};

// =========================
// 📝 EMAIL SUMMARIZER
// =========================
exports.summarizeEmail = async (text) => {
    try {
        if (!text || !text.trim()) return "";
        
        // Truncate text for Flan-T5 token limits
        const cleanText = text.slice(0, 1500);
        const prompt = `Summarize this email in a short, crisp one-sentence description:\n\nEmail Content:\n${cleanText}`;

        const response = await axios.post(
            process.env.T5_API_URL,
            { inputs: prompt },
            {
                timeout: 20000,
                headers: {
                    Authorization: `Bearer ${process.env.T5_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        let output = "";
        if (Array.isArray(response.data)) {
            output = response.data?.[0]?.generated_text || "";
        } else if (response.data?.generated_text) {
            output = response.data.generated_text;
        }

        return output.trim();
    } catch (err) {
        console.error("❌ T5 SUMMARIZE ERROR:", err.response?.data || err.message);
        return "";
    }
};

// =========================
// 🎯 KEY POINTS / ACTIONS EXTRACTION
// =========================
exports.extractImportantPoints = async (text) => {
    try {
        if (!text || !text.trim()) return [];

        const cleanText = text.slice(0, 1500);
        const prompt = `Extract 3 critical action items or key takeaways from this email as a plain text, newline-separated list:\n\nEmail Content:\n${cleanText}`;

        const response = await axios.post(
            process.env.T5_API_URL,
            { inputs: prompt },
            {
                timeout: 20000,
                headers: {
                    Authorization: `Bearer ${process.env.T5_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        let output = "";
        if (Array.isArray(response.data)) {
            output = response.data?.[0]?.generated_text || "";
        } else if (response.data?.generated_text) {
            output = response.data.generated_text;
        }

        // Split output by newlines and clean bullet points symbols
        const points = output
            .replace(/\r/g, "")
            .split("\n")
            .map(line => line.trim().replace(/^[\*\-•\d\.\s]+/, "").trim())
            .filter(line => line.length > 5);

        return points.slice(0, 4); // return top 3-4 points
    } catch (err) {
        console.error("❌ T5 KEY POINTS EXTRACTION ERROR:", err.response?.data || err.message);
        return [];
    }
};