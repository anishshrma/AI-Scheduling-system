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
// 📚 SYLLABUS TOPIC EXTRACTOR & DYNAMIC SCHEDULER
// =====================================
const romanToDecimal = (roman) => {
    const map = { i: 1, v: 5, x: 10, l: 50 };
    let total = 0;
    let prev = 0;
    const str = (roman || "").toLowerCase();
    for (let i = str.length - 1; i >= 0; i--) {
        const current = map[str[i]];
        if (!current) continue;
        if (current < prev) {
            total -= current;
        } else {
            total += current;
        }
        prev = current;
    }
    return total;
};

const parseSyllabusIntoChapters = (ocrText) => {
    if (!ocrText) return [];
    const lines = ocrText
        .replace(/\r/g, "")
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    const units = [];
    let currentUnit = null;

    // Matches "Unit 1", "Chapter I", "Module 2", "Section A", etc.
    const unitRegex = /^(?:unit|chapter|module|section)\s*(\d+|[ivx]+)\b[:.-]?\s*(.*)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(unitRegex);

        if (match) {
            if (currentUnit) {
                units.push(currentUnit);
            }
            const unitIdStr = match[1];
            const title = match[2] || "";
            
            let num = parseInt(unitIdStr, 10);
            if (isNaN(num)) {
                num = romanToDecimal(unitIdStr);
            }

            currentUnit = {
                idStr: unitIdStr,
                num: num || (units.length + 1),
                title: title.trim(),
                contentLines: []
            };
        } else {
            if (currentUnit) {
                if (/^(?:textbooks|reference|marks|course code|miet|syllabus for|page|s\. no\.)/i.test(line)) {
                    units.push(currentUnit);
                    currentUnit = null;
                } else {
                    currentUnit.contentLines.push(line);
                }
            }
        }
    }

    if (currentUnit) {
        units.push(currentUnit);
    }

    // Clean units and split into sub-topics
    return units.map(unit => {
        const fullContent = [unit.title, ...unit.contentLines].join(" ");
        const cleanContent = fullContent.replace(/\(\s*\d+\s*(?:hrs|hours|hours\.)\s*\)/i, "").trim();
        
        let subTopics = cleanContent
            .split(/[,;•]|\b\d+\.\s+/)
            .map(t => t.trim())
            .filter(t => t.length > 10 && !/^(?:and|or|for|of|with|w\.r\.t)\b/i.test(t));

        if (subTopics.length === 0) {
            subTopics = cleanContent.split(/[.!?]+/).map(t => t.trim()).filter(t => t.length > 10);
        }
        if (subTopics.length === 0) {
            subTopics = [cleanContent];
        }

        return {
            num: unit.num,
            title: unit.title || `Chapter ${unit.num}`,
            fullText: cleanContent,
            subTopics: subTopics.slice(0, 6)
        };
    });
};

const detectRequestedUnits = (customNeeds, availableUnits) => {
    const needsLower = (customNeeds || "").toLowerCase();
    
    // 1. Check for quantities: e.g. "2 chapters", "first 3 units", "only 2 chapter", "schedule of 2 chapter"
    const quantityMatch = needsLower.match(/(\d+)\s*(?:unit|chapter|module|class|section)s?\b/i) ||
                          needsLower.match(/(?:first|only)\s+(\d+)\s*(?:unit|chapter|module|class|section)s?\b/i);
    
    if (quantityMatch) {
        const count = parseInt(quantityMatch[1], 10);
        if (count > 0) {
            return availableUnits.filter(u => u.num <= count);
        }
    }

    // 2. Check for ranges: e.g. "units 1 to 3", "chapters 2-4"
    const rangeMatch = needsLower.match(/(?:unit|chapter|module|section)s?\s*(\d+)\s*(?:to|and|-)\s*(\d+)/i);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (start > 0 && end >= start) {
            return availableUnits.filter(u => u.num >= start && u.num <= end);
        }
    }

    // 3. Check for specific units listed: e.g. "unit 4 and 5", "unit 1, 2", "chapter 3"
    const specificMatches = needsLower.match(/(?:unit|chapter|module|section)s?\s*(\d+(?:\s*(?:,|and|&)\s*\d+)*)/i);
    if (specificMatches) {
        const nums = specificMatches[1].match(/\d+/g).map(num => parseInt(num, 10));
        if (nums.length > 0) {
            return availableUnits.filter(u => nums.includes(u.num));
        }
    }

    // Default fallback: return first 2 chapters/units if available
    if (availableUnits.length > 0) {
        return availableUnits.slice(0, 2);
    }

    return [];
};

const generateQuestionsForTopic = (topic) => {
    const t = (topic || "").toLowerCase();
    const questions = [];

    if (t.includes("definition") || t.includes("concept") || t.includes("introduction") || t.includes("importance")) {
        questions.push(`What are the core definitions and essential characteristics of ${topic.slice(0, 40)}?`);
        questions.push(`Why is understanding ${topic.slice(0, 40)} crucial in the context of this subject?`);
        questions.push(`What are the primary challenges or issues that ${topic.slice(0, 40)} aims to address?`);
    } else if (t.includes("analytics") || t.includes("ai") || t.includes("data") || t.includes("algorithm") || t.includes("machine learning")) {
        questions.push(`How are AI and big data analytics applied to solve real-world problems in ${topic.slice(0, 40)}?`);
        questions.push(`What machine learning algorithms or data structures are most suitable for analyzing this type of data?`);
        questions.push(`What are the key technical or privacy challenges when managing large datasets for ${topic.slice(0, 40)}?`);
    } else if (t.includes("transportation") || t.includes("mobility") || t.includes("vehicle") || t.includes("transit")) {
        questions.push(`What are the key components of an Intelligent Transportation System (ITS) in ${topic.slice(0, 40)}?`);
        questions.push(`How do data-driven congestion management and smart transit solutions optimize urban mobility?`);
        questions.push(`What are the major environmental and economic benefits of sustainable electric vehicle systems?`);
    } else if (t.includes("iot") || t.includes("sensor") || t.includes("network") || t.includes("framework")) {
        questions.push(`How do sensor networks and IoT frameworks collect and integrate real-time data in ${topic.slice(0, 40)}?`);
        questions.push(`What communication protocols and hardware architectures are standard for this type of network?`);
        questions.push(`Can you name three major security vulnerabilities or deployment challenges in IoT-enabled urban environments?`);
    } else if (t.includes("sustainability") || t.includes("environmental") || t.includes("green") || t.includes("waste") || t.includes("energy")) {
        questions.push(`What are the primary waste management and eco-friendly recycling strategies discussed in ${topic.slice(0, 40)}?`);
        questions.push(`How do smart grids and automated building systems optimize energy conservation?`);
        questions.push(`What are the major challenges in integrating renewable energy sources into modern urban infrastructures?`);
    } else {
        questions.push(`Can you clearly define and explain the main concepts of ${topic}?`);
        questions.push(`How does ${topic} integrate with and support the other chapters in the syllabus?`);
        questions.push(`What are the practical applications, real-world examples, or case studies of ${topic}?`);
    }
    return questions;
};

const generateLocalSchedule = (selectedUnits, targetDate) => {
    const steps = [];
    const distributedDates = distributeDates(targetDate, Math.max(3, selectedUnits.reduce((acc, u) => acc + u.subTopics.length, 0)));

    const shiftTimes = [
        { sh: "09", sm: "00", sap: "AM", eh: "11", em: "00", eap: "AM" }, // Morning
        { sh: "02", sm: "00", sap: "PM", eh: "04", em: "00", eap: "PM" }, // Afternoon
        { sh: "07", sm: "00", sap: "PM", eh: "09", em: "00", eap: "PM" }  // Evening
    ];

    let dateIdx = 0;
    let shiftIdx = 0;

    selectedUnits.forEach(unit => {
        unit.subTopics.forEach(subTopic => {
            const dateVal = distributedDates[dateIdx] || distributedDates[distributedDates.length - 1];
            const shift = shiftTimes[shiftIdx % 3];

            steps.push({
                date: dateVal,
                sh: shift.sh,
                sm: shift.sm,
                sap: shift.sap,
                eh: shift.eh,
                em: shift.em,
                eap: shift.eap,
                work: `Unit ${unit.num}: ${subTopic}`,
                questions: generateQuestionsForTopic(subTopic)
            });

            shiftIdx++;
            if (shiftIdx % 3 === 0) {
                dateIdx++;
            }
        });
    });

    if (steps.length === 0) {
        const fallbackDates = distributeDates(targetDate, 3);
        return {
            title: "Custom Study Plan",
            description: "Study plan generated from your syllabus.",
            category: "Exam",
            priority: "High",
            steps: [
                {
                    date: fallbackDates[0],
                    sh: "09", sm: "00", sap: "AM", eh: "11", em: "00", eap: "AM",
                    work: "Study Foundational Concepts",
                    questions: generateQuestionsForTopic("Foundational Concepts")
                },
                {
                    date: fallbackDates[1],
                    sh: "02", sm: "00", sap: "PM", eh: "04", em: "00", eap: "PM",
                    work: "Study Core Topics & Application",
                    questions: generateQuestionsForTopic("Core Topics & Application")
                },
                {
                    date: fallbackDates[2],
                    sh: "07", sm: "00", sap: "PM", eh: "09", em: "00", eap: "PM",
                    work: "Review: Practice Exam Questions",
                    questions: generateQuestionsForTopic("Practice Exam Questions")
                }
            ]
        };
    }

    const firstUnitNum = selectedUnits[0]?.num || 1;
    const lastUnitNum = selectedUnits[selectedUnits.length - 1]?.num || 2;
    const title = `Detailed Study Plan: Unit ${firstUnitNum} to Unit ${lastUnitNum}`;
    const description = `Rigorous study plan focused specifically on the core sub-topics of Unit ${firstUnitNum} and Unit ${lastUnitNum}. Includes targeted study questions for self-assessment.`;

    return {
        title,
        description,
        category: "Exam",
        priority: "High",
        steps
    };
};

const buildSmartSchedulePrompt = (selectedUnits, customNeeds, startDateStr, endDateStr, totalDays) => {
    let unitsText = "";
    selectedUnits.forEach(u => {
        unitsText += `Unit ${u.num}: ${u.title}\nTopics: ${u.subTopics.join(", ")}\n\n`;
    });

    return `Given this syllabus content:
${unitsText}

Student note: ${customNeeds}
Study window: ${startDateStr} to ${endDateStr || "N/A"}, ${totalDays} days

Generate a study schedule covering the topics above. For each step, provide:
- Date (YYYY-MM-DD)
- Start time (HH:MM AM/PM)
- End time (HH:MM AM/PM)
- Detailed topic name from the syllabus as the task
- 3 specific questions for that topic

STRICT Output Format:
Title: [Plan Title]
Description: [Plan Description]
Step1_Date: [Date in YYYY-MM-DD format]
Step1_Start: 09:00 AM
Step1_End: 11:00 AM
Step1_Task: [Specific topic name from the syllabus]
Step1_Q1: [Question 1]
Step1_Q2: [Question 2]
Step1_Q3: [Question 3]
Step2_Date: [Date in YYYY-MM-DD format]
Step2_Start: 02:00 PM
Step2_End: 04:00 PM
Step2_Task: [Specific topic name from the syllabus]
Step2_Q1: [Question 1]
Step2_Q2: [Question 2]
Step2_Q3: [Question 3]
Step3_Date: [Date in YYYY-MM-DD format]
Step3_Start: 07:00 PM
Step3_End: 09:00 PM
Step3_Task: [Specific topic name from the syllabus]
Step3_Q1: [Question 1]
Step3_Q2: [Question 2]
Step3_Q3: [Question 3]
`;
};

exports.analyzeSchedule = async (req, res) => {
    try {
        let extractedText = "";
        let imageOcrText = "";

        if (req.files && req.files.document) {
            const fileBuffer = fs.readFileSync(req.files.document[0].path);
            const pdfData = await pdfParse(fileBuffer);
            extractedText += pdfData.text;
        }

        if (req.files && req.files.image) {
            const result = await Tesseract.recognize(req.files.image[0].path, "eng");
            imageOcrText = result.data.text;
            extractedText += imageOcrText;
        }

        // =====================================
        // ⚠️ OCR EMPTY VALIDATION
        // =====================================
        if (req.files && req.files.image && !imageOcrText.trim()) {
            return res.status(400).json({ error: "Could not read text from image — please upload a clearer photo or PDF." });
        }

        extractedText += req.body.event || "";
        const customNeeds = req.body.notes || "";

        console.log("⚡ SMART SCHEDULER: Notes received -", customNeeds);

        const targetDate = extractTargetDate(customNeeds);
        const todayStr = new Date().toISOString().split("T")[0];
        const targetDateStr = targetDate ? targetDate.toISOString().split("T")[0] : "";

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = targetDate || new Date(today.getTime() + 86400000 * 3);
        const diffTime = Math.abs(target - today);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 3;

        // Parse structure and isolate selected chapters/units
        const allChapters = parseSyllabusIntoChapters(extractedText);
        const selectedChapters = detectRequestedUnits(customNeeds, allChapters);

        console.log(`⚡ SMART SCHEDULER: Found ${allChapters.length} chapters, selected ${selectedChapters.length} chapters.`);

        // =====================================
        // 🔥 QUERY HUGGINGFACE TRANSFORMER
        // =====================================
        try {
            if (!process.env.T5_API_URL) {
                throw new Error("T5_API_URL not configured");
            }

            const prompt = buildSmartSchedulePrompt(
                selectedChapters.length > 0 ? selectedChapters : allChapters,
                customNeeds,
                todayStr,
                targetDateStr,
                totalDays
            );

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

                // Parse questions
                const questions = [];
                if (data[`Step${stepIdx}_Q1`]) questions.push(data[`Step${stepIdx}_Q1`]);
                if (data[`Step${stepIdx}_Q2`]) questions.push(data[`Step${stepIdx}_Q2`]);
                if (data[`Step${stepIdx}_Q3`]) questions.push(data[`Step${stepIdx}_Q3`]);

                steps.push({
                    date: stepDate,
                    sh: startParts[0] ? startParts[0].trim() : defaultShift.sh,
                    sm: startMinuteSplit[0] ? startMinuteSplit[0].trim() : defaultShift.sm,
                    sap: startMinuteSplit[1] ? startMinuteSplit[1].trim() : defaultShift.sap,
                    eh: endParts[0] ? endParts[0].trim() : defaultShift.eh,
                    em: endMinuteSplit[0] ? endMinuteSplit[0].trim() : defaultShift.em,
                    eap: endMinuteSplit[1] ? endMinuteSplit[1].trim() : defaultShift.eap,
                    work: data[`Step${stepIdx}_Task`] || "",
                    questions
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
            const planResult = generateLocalSchedule(
                selectedChapters.length > 0 ? selectedChapters : allChapters,
                targetDate
            );

            return res.json(planResult);
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