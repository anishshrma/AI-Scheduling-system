const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../middleware/auth.middleware');



// AUTH
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// 🔥 NEW ROUTES
router.get('/me', authMiddleware, authController.getProfile);
router.put('/update', authMiddleware, authController.updateProfile);

module.exports = router;