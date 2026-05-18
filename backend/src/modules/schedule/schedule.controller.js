const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { extractDetails } = require("../../services/t5.service");
const scheduleService = require("./schedule.service");

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

        const aiData = await extractDetails(extractedText, "exam");
        return res.json(aiData);
    } catch (err) {
        console.log(err);
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