const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const axios = require("axios");
const { extractDetails } = require("../../services/t5.service");
const scheduleService = require("./schedule.service");

// =====================================
// 🧠 SPECIALIZED SMART PROMPT BUILDER
// =====================================
const buildSmartSchedulePrompt = (syllabusText, customNeeds) => {
    return `Generate a customized study schedule breakdown.

Syllabus Text:
${syllabusText.slice(0, 1000)}

User Custom Study Needs:
${customNeeds || "Divide the syllabus content evenly into logical study steps."}

Format Rules:
- Output exactly 3 study steps.
- Focus ONLY on the units/topics requested by the user.
- Output STRICTLY in this format:
Title: [Title]
Description: [Description]
Category: Exam
Priority: High
Step1_Date: [Date]
Step1_Start: 09:00 AM
Step1_End: 10:00 AM
Step1_Task: [Step 1 Task]
Step2_Date: [Date]
Step2_Start: 10:00 AM
Step2_End: 11:00 AM
Step2_Task: [Step 2 Task]
Step3_Date: [Date]
Step3_Start: 11:00 AM
Step3_End: 12:00 PM
Step3_Task: [Step 3 Task]
`;
};

exports.analyzeSchedule = async (req, res) => {
    try {
        let extractedText = "";

        if (req.files && req.files.document) {
            const fileBuffer = fs.readFileSync(req.files.document[0].path);
            const pdfData = await pdfParse(fileBuffer);
            extractedText += pdfData.text;
        }

        if (req.files && req.files.image) {
            const result = await Tesseract.recognize(req.files.image[0].path, "eng");
            extractedText += result.data.text;
        }

        extractedText += req.body.event || "";
        const customNeeds = req.body.notes || "";

        console.log("⚡ SMART SCHEDULER: Notes received -", customNeeds);

        // =====================================
        // 🔥 QUERY HUGGINGFACE TRANSFORMER
        // =====================================
        try {
            if (!process.env.T5_API_URL) {
                throw new Error("T5_API_URL not configured");
            }

            const prompt = buildSmartSchedulePrompt(extractedText, customNeeds);
            const aiResponse = await axios.post(
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
            if (Array.isArray(aiResponse.data)) {
                output = aiResponse.data?.[0]?.generated_text || "";
            } else if (aiResponse.data?.generated_text) {
                output = aiResponse.data.generated_text;
            }

            const data = {};
            output.split("\n").forEach(line => {
                const idx = line.indexOf(":");
                if (idx !== -1) {
                    const key = line.slice(0, idx).trim();
                    const value = line.slice(idx + 1).trim();
                    data[key] = value;
                }
            });

            // Extract steps dynamically from generated output
            const steps = [];
            let stepIdx = 1;
            while (data[`Step${stepIdx}_Task`]) {
                const start = data[`Step${stepIdx}_Start`] || "09:00 AM";
                const end = data[`Step${stepIdx}_End`] || "10:00 AM";
                const startParts = start.split(":");
                const endParts = end.split(":");
                const startMinuteSplit = startParts[1]?.split(" ") || ["00", "AM"];
                const endMinuteSplit = endParts[1]?.split(" ") || ["00", "AM"];

                steps.push({
                    date: data[`Step${stepIdx}_Date`] || "",
                    sh: startParts[0] || "09",
                    sm: startMinuteSplit[0] || "00",
                    sap: startMinuteSplit[1] || "AM",
                    eh: endParts[0] || "10",
                    em: endMinuteSplit[0] || "00",
                    eap: endMinuteSplit[1] || "AM",
                    work: data[`Step${stepIdx}_Task`] || ""
                });
                stepIdx++;
            }

            if (steps.length > 0) {
                return res.json({
                    title: data.Title || "Custom Study Plan",
                    description: data.Description || "Syllabus custom schedule.",
                    category: data.Category || "Exam",
                    priority: data.Priority || "High",
                    steps
                });
            } else {
                throw new Error("No steps successfully parsed from AI output");
            }

        } catch (aiErr) {
            console.log("⚠️ AI smart schedule failed, using local rule-based scheduler:", aiErr.message);

            // =====================================
            // 🔥 PREMIUM RESILIENT STUDY FALLBACK
            // =====================================
            const titleText = customNeeds ? `Study Plan: ${customNeeds}` : "Custom Syllabus Breakdown";
            const descText = "Automatically generated steps based on your uploaded syllabus and custom preferences.";
            const steps = [];

            const step1Work = customNeeds ? `Focus: ${customNeeds} (Intro & Foundation)` : "Study syllabus unit 1 / section 1";
            const step2Work = customNeeds ? `Focus: ${customNeeds} (Core Topics)` : "Study syllabus unit 2 / section 2";
            const step3Work = customNeeds ? `Review and Practice all topics` : "Review syllabus contents";

            steps.push({ date: "", sh: "09", sm: "00", sap: "AM", eh: "10", em: "00", eap: "AM", work: step1Work });
            steps.push({ date: "", sh: "10", sm: "00", sap: "AM", eh: "11", em: "00", eap: "AM", work: step2Work });
            steps.push({ date: "", sh: "11", sm: "00", sap: "AM", eh: "12", em: "00", eap: "PM", work: step3Work });

            return res.json({
                title: titleText,
                description: descText,
                category: "Exam",
                priority: "High",
                steps
            });
        }
    } catch (err) {
        console.log("CRITICAL ERROR IN ANALYZE SCHEDULE:", err);
        return res.status(500).json({ message: "AI schedule generation failed" });
    }
};

// CREATE
exports.createSchedule = async (req, res) => {
    try {
        const schedule = await scheduleService.createSchedule({
            ...req.body,
            user: req.user.id
        });
        res.json({ success: true, schedule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET
exports.getSchedules = async (req, res) => {
    try {
        const schedules = await scheduleService.getSchedules(req.user.id);
        res.json({ success: true, schedules });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE
exports.updateSchedule = async (req, res) => {
    try {
        const schedule = await scheduleService.updateSchedule(
            req.params.id,
            req.user.id,
            req.body
        );
        res.json({ success: true, schedule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE
exports.deleteSchedule = async (req, res) => {
    try {
        await scheduleService.deleteSchedule(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};