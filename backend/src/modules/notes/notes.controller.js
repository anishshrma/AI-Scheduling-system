const Note = require('./notes.model');
const Folder = require('./folder.model');

const parsePDF = require('../../utils/pdfParser');
const parseDOC = require('../../utils/docParser');
const extractTextFromImage = require('../../utils/imageOCR');

const {
    summarizeText,
    simplifyText,
    explainText
} = require('./summary.service');

exports.uploadNote = async(req, res) => {

    try {

        const file = req.file;

        let extractedText = '';

        if(file.mimetype.includes('pdf')) {
            extractedText = await parsePDF(file.path);
        }

        else if(file.mimetype.includes('word')) {
            extractedText = await parseDOC(file.path);
        }

        else if(file.mimetype.includes('image')) {
            extractedText = await extractTextFromImage(file.path);
        }

        const summary = await summarizeText(extractedText);
        const simplified = await simplifyText(extractedText);
        const explained = await explainText(extractedText);

        const note = await Note.create({
            userId: req.user.id,
            title: file.originalname,
            originalText: extractedText,
            summarizedText: summary,
            simplifiedText: simplified,
            explanationText: explained,
            fileUrl: file.path,
            fileType: file.mimetype,
            category: 'uploaded'
        });

        res.status(201).json(note);

    }

    catch(error) {
        console.log(error);
        res.status(500).json({
            message: 'Upload failed'
        });
    }
};

exports.getAllNotes = async(req, res) => {

    const notes = await Note.find({
        userId: req.user.id
    });

    res.json(notes);
};

exports.deleteNote = async(req, res) => {

    await Note.findByIdAndDelete(req.params.id);

    res.json({
        message: 'Note deleted'
    });
};

exports.editSummary = async(req, res) => {

    const updated = await Note.findByIdAndUpdate(
        req.params.id,
        {
            summarizedText: req.body.summarizedText
        },
        {
            new: true
        }
    );

    res.json(updated);
};

exports.createFolder = async(req, res) => {

    const folder = await Folder.create({
        userId: req.user.id,
        folderName: req.body.folderName
    });

    res.json(folder);
};