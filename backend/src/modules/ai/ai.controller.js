const aiService = require('./ai.service');
const taskService = require('../tasks/tasks.service');

exports.classifyEmail = async (req, res) => {
    try {
        const { text } = req.body;

        const result = await aiService.processEmail(text);

        const task = await taskService.createTask({
            title: text,
            category: result.category,
            priority: "medium",
            deadline: new Date(),
            user: req.user.id // ✅ FIXED
        });

        res.json({
            ...result,
            task
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};