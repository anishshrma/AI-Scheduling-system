// const express = require('express');
// const router = express.Router();
// const taskService = require('./tasks.service');
// const authMiddleware = require("../../middleware/auth.middleware");

// // =========================
// // 🔥 GET USER TASKS
// // =========================
// router.get('/', authMiddleware, async (req, res) => {
//     try {
//         const tasks = await taskService.getTasks(req.user.id);

//         res.json({
//             success: true,
//             tasks
//         });

//     } catch (err) {
//         res.status(500).json({ error: "Failed to fetch tasks" });
//     }
// });
// module.exports = router;

const express = require('express');
const router = express.Router();

const taskController = require('./tasks.controller');
const authMiddleware = require("../../middleware/auth.middleware");

// GET
router.get('/', authMiddleware, taskController.getTasks);

// CREATE
router.post('/', authMiddleware, taskController.createTask);

// UPDATE
router.put('/:id', authMiddleware, taskController.updateTask);

// DELETE
router.delete('/:id', authMiddleware, taskController.deleteTask);

// BULK
router.post('/bulk', authMiddleware, taskController.bulkAction);

module.exports = router;