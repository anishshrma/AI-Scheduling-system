const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const axios = require("axios");
const { extractDetails } = require("../../services/t5.service");
const scheduleService = require("./schedule.service");
const googleService = require("../google/google.service");

// =====================================
// 📅 INTELLIGENT DATE EXTRACTOR
// =====================================
const extractTargetDate = (text) => {
    if (!text) return null;
    const months = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };

    // Try format: DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
        return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    }

    // Try format: DD/MM or DD-MM
    const dmMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (dmMatch) {
        const d = new Date();
        return new Date(d.getFullYear(), parseInt(dmMatch[2]) - 1, parseInt(dmMatch[1]));
    }

    // Try text format: "30 may", "may 30", "30th may", "may 30th"
    const textMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i) ||
                      text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/i);

    if (textMatch) {
        let day, monthStr;
        if (isNaN(parseInt(textMatch[1]))) {
            monthStr = textMatch[1].toLowerCase();
            day = parseInt(textMatch[2]);
        } else {
            day = parseInt(textMatch[1]);
            monthStr = textMatch[2].toLowerCase();
        }
        const month = months[monthStr];
        if (month !== undefined) {
            const d = new Date();
            let year = d.getFullYear();
            let target = new Date(year, month, day);
            if (target < d) {
                target.setFullYear(year + 1);
            }
            return target;
        }
    }
    return null;
};

// =====================================
// 📅 INTELLIGENT DATE DISTRIBUTOR
// =====================================
const distributeDates = (targetDate, numSteps = 3) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!targetDate || isNaN(targetDate.getTime()) || targetDate <= today) {
        // Default: schedule steps starting tomorrow
        const dates = [];
        for (let i = 1; i <= numSteps; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            dates.push(d.toISOString().split("T")[0]);
        }
        return dates;
    }

    const diffTime = Math.abs(targetDate - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dates = [];
    if (diffDays <= numSteps) {
        // List consecutive days leading up to target
        for (let i = 0; i < numSteps; i++) {
            const d = new Date(targetDate);
            d.setDate(d.getDate() - (numSteps - 1 - i));
            dates.push(d.toISOString().split("T")[0]);
        }
    } else {
        // Distribute them evenly
        const interval = diffDays / (numSteps - 1);
        for (let i = 0; i < numSteps; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + Math.round(i * interval));
            dates.push(d.toISOString().split("T")[0]);
        }
    }
    return dates;
};

// =====================================
// 📚 SYLLABUS TOPIC EXTRACTOR
// =====================================
const extractSyllabusTopics = (syllabusText, customNeeds) => {
    if (!syllabusText) {
        return [
            "Study: Foundational Concepts",
            "Study: Core Topics & Application",
            "Review: Practice Exam Questions"
        ];
    }
    const cleanText = syllabusText
        .replace(/\r/g, "")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 5);
    
    const needsLower = (customNeeds || "").toLowerCase();
    let unitsToFind = [];
    if (needsLower.includes("first 2 unit") || needsLower.includes("unit 1 and 2") || needsLower.includes("unit 1 & 2")) {
        unitsToFind = [1, 2];
    } else if (needsLower.includes("first unit") || needsLower.includes("unit 1")) {
        unitsToFind = [1];
    } else {
        const matches = needsLower.match(/unit\s*(\d+)/g);
        if (matches) {
            matches.forEach(m => {
                const num = parseInt(m.replace(/\D/g, ""));
                if (num) unitsToFind.push(num);
            });
        }
    }

    let topics = [];
    
    if (unitsToFind.length > 0) {
        const romanNumerals = ["", "I", "II", "III", "IV", "V", "VI"];
        unitsToFind.forEach(unitNum => {
            const roman = romanNumerals[unitNum];
            const regex = new RegExp(`(?:unit|chapter|module)\\s*(?:${unitNum}|${roman})\\b`, "i");
            let foundIndex = -1;
            for (let i = 0; i < cleanText.length; i++) {
                if (regex.test(cleanText[i])) {
                    foundIndex = i;
                    break;
                }
            }

            if (foundIndex !== -1) {
                let topicStr = cleanText[foundIndex];
                for (let j = 1; j <= 2; j++) {
                    if (cleanText[foundIndex + j] && !cleanText[foundIndex + j].toLowerCase().includes("unit")) {
                        topicStr += " - " + cleanText[foundIndex + j];
                    }
                }
                topics.push(topicStr.slice(0, 80));
            }
        });
    }

    if (topics.length === 0) {
        const headerLines = cleanText.filter(l => l.length > 10 && l.length < 80 && !l.includes(":") && !l.includes("http"));
        if (headerLines.length >= 3) {
            topics = headerLines.slice(0, 3);
        } else {
            topics = [
                "Study foundational syllabus concepts",
                "Study core syllabus modules",
                "Final syllabus review and self-test"
            ];
        }
    }

    while (topics.length < 3) {
        topics.push(topics[0] ? `Advanced study: ${topics[0]}` : "Study next syllabus section");
    }

    return topics;
};

// =====================================
// 🧠 SPECIALIZED SMART PROMPT BUILDER
// =====================================
const buildSmartSchedulePrompt = (syllabusText, customNeeds, todayStr, targetDateStr) => {
    return `Generate a customized study schedule.

Syllabus Context:
${syllabusText.slice(0, 1000)}

User Request:
${customNeeds}

Temporal Context:
- Today is: ${todayStr}
- Target deadline/exam date is: ${targetDateStr || "N/A"}

Rules:
- Output exactly 3 study steps.
- DO NOT repeat the user's specific request query text in the Step tasks. Instead, extract actual topics/skills from the Syllabus Context.
- Distribute the dates of the steps logically between ${todayStr} and ${targetDateStr}. Output them in YYYY-MM-DD format.
- Set time shifts:
  * Step 1: Morning Shift (e.g. 09:00 AM - 11:00 AM)
  * Step 2: Afternoon Shift (e.g. 02:00 PM - 04:00 PM)
  * Step 3: Evening/Night Shift (e.g. 07:00 PM - 09:00 PM)

STRICT Output Format:
Title: [Title]
Description: [Description]
Category: Exam
Priority: High
Step1_Date: [Date]
Step1_Start: 09:00 AM
Step1_End: 11:00 AM
Step1_Task: [Step 1 study task]
Step2_Date: [Date]
Step2_Start: 02:00 PM
Step2_End: 04:00 PM
Step2_Task: [Step 2 study task]
Step3_Date: [Date]
Step3_Start: 07:00 PM
Step3_End: 09:00 PM
Step3_Task: [Step 3 study task]
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

        const targetDate = extractTargetDate(customNeeds);
        const todayStr = new Date().toISOString().split("T")[0];
        const targetDateStr = targetDate ? targetDate.toISOString().split("T")[0] : "";

        // =====================================
        // 🔥 QUERY HUGGINGFACE TRANSFORMER
        // =====================================
        try {
            if (!process.env.T5_API_URL) {
                throw new Error("T5_API_URL not configured");
            }

            const prompt = buildSmartSchedulePrompt(extractedText, customNeeds, todayStr, targetDateStr);
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
            const distributedDates = distributeDates(targetDate, 3);
            
            // Standard shift times
            const shiftTimes = [
                { sh: "09", sm: "00", sap: "AM", eh: "11", em: "00", eap: "AM" }, // Morning
                { sh: "02", sm: "00", sap: "PM", eh: "04", em: "00", eap: "PM" }, // Afternoon
                { sh: "07", sm: "00", sap: "PM", eh: "09", em: "00", eap: "PM" }  // Evening
            ];

            while (data[`Step${stepIdx}_Task`]) {
                const start = data[`Step${stepIdx}_Start`] || "";
                const end = data[`Step${stepIdx}_End`] || "";
                const dateVal = data[`Step${stepIdx}_Date`] || "";
                
                let startParts = start.split(":");
                let endParts = end.split(":");
                let startMinuteSplit = startParts[1]?.split(" ") || ["00", "AM"];
                let endMinuteSplit = endParts[1]?.split(" ") || ["00", "AM"];

                const defaultShift = shiftTimes[stepIdx - 1] || shiftTimes[2];
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                const stepDate = dateRegex.test(dateVal.trim()) ? dateVal.trim() : (distributedDates[stepIdx - 1] || "");

                steps.push({
                    date: stepDate,
                    sh: startParts[0] ? startParts[0].trim() : defaultShift.sh,
                    sm: startMinuteSplit[0] ? startMinuteSplit[0].trim() : defaultShift.sm,
                    sap: startMinuteSplit[1] ? startMinuteSplit[1].trim() : defaultShift.sap,
                    eh: endParts[0] ? endParts[0].trim() : defaultShift.eh,
                    em: endMinuteSplit[0] ? endMinuteSplit[0].trim() : defaultShift.em,
                    eap: endMinuteSplit[1] ? endMinuteSplit[1].trim() : defaultShift.eap,
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
            const titleText = customNeeds ? `Study Plan: ${customNeeds.slice(0, 50)}...` : "Custom Syllabus Breakdown";
            const descText = "Automatically generated steps based on your uploaded syllabus and custom preferences.";
            const distributedDates = distributeDates(targetDate, 3);
            const extractedTopics = extractSyllabusTopics(extractedText, customNeeds);
            
            const steps = [];
            // Step 1: Morning
            steps.push({
                date: distributedDates[0],
                sh: "09",
                sm: "00",
                sap: "AM",
                eh: "11",
                em: "00",
                eap: "AM",
                work: extractedTopics[0]
            });

            // Step 2: Afternoon
            steps.push({
                date: distributedDates[1],
                sh: "02",
                sm: "00",
                sap: "PM",
                eh: "04",
                em: "00",
                eap: "PM",
                work: extractedTopics[1]
            });

            // Step 3: Evening/Night
            steps.push({
                date: distributedDates[2],
                sh: "07",
                sm: "00",
                sap: "PM",
                eh: "09",
                em: "00",
                eap: "PM",
                work: extractedTopics[2]
            });

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

// Helper to parse step start/end times into a Date object
const parseStepTimeToDate = (dateStr, hStr, mStr, apStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    let hours = parseInt(hStr, 10) || 9;
    const minutes = parseInt(mStr, 10) || 0;
    const isPM = apStr?.toUpperCase() === "PM";
    const isAM = apStr?.toUpperCase() === "AM";

    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    }

    return new Date(year, month - 1, day, hours, minutes);
};

// CREATE
exports.createSchedule = async (req, res) => {
    try {
        const schedule = await scheduleService.createSchedule({
            ...req.body,
            user: req.user.id
        });

        // =====================================
        // 📅 SYNC TO GOOGLE CALENDAR (BACKGROUND)
        // =====================================
        if (schedule.steps && schedule.steps.length > 0) {
            (async () => {
                try {
                    console.log(`📡 Starting Google Calendar sync for ${schedule.steps.length} schedule steps`);
                    for (let step of schedule.steps) {
                        if (step.date) {
                            const start = parseStepTimeToDate(step.date, step.sh, step.sm, step.sap);
                            const end = parseStepTimeToDate(step.date, step.eh, step.em, step.eap);

                            await googleService.createCalendarEvent(req.user.id, {
                                summary: `Study Step: ${step.work || schedule.title}`,
                                description: `From study schedule: ${schedule.title}\nDescription: ${schedule.description || "No description"}`,
                                start: start.toISOString(),
                                end: end.toISOString()
                            });
                        }
                    }
                } catch (calErr) {
                    console.error("⚠️ Background Schedule Steps Calendar Sync Error:", calErr.message);
                }
            })();
        }

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