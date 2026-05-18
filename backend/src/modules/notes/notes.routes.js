const express = require('express');
const router = express.Router();

const controller = require('./notes.controller');
const upload = require('../../middleware/upload.middleware');
const auth = require('../../middleware/auth.middleware');

router.post(
    '/upload',
    auth,
    upload.single('file'),
    controller.uploadNote
);

router.get('/', auth, controller.getAllNotes);

router.delete('/:id', auth, controller.deleteNote);

router.put('/:id', auth, controller.editSummary);

router.post('/folder', auth, controller.createFolder);

module.exports = router;