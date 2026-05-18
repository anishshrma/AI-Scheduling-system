const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    title: String,

    originalText: String,

    summarizedText: String,

    simplifiedText: String,

    explanationText: String,

    fileUrl: String,

    fileType: String,

    category: {
        type: String,
        enum: [
            'uploaded',
            'summary',
            'simplified',
            'image',
            'syllabus',
            'datesheet'
        ]
    },

    folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder'
    },

    tags: [String],

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Note', noteSchema);