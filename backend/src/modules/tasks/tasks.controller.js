const taskService = require('./tasks.service');

// CREATE
exports.createTask = async (req, res) => {
    try {
        const task = await taskService.createTask({
            ...req.body,
            user: req.user.id
        });

        res.json({ success: true, task });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET
exports.getTasks = async (req, res) => {
    try {
        const tasks = await taskService.getTasks(req.user.id, req.query);

        res.json({ success: true, tasks });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// UPDATE
exports.updateTask = async (req, res) => {
    try {
        const task = await taskService.updateTask(
            req.params.id,
            req.user.id,
            req.body
        );

        res.json({ success: true, task });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE (SOFT)
exports.deleteTask = async (req, res) => {
    try {
        await taskService.deleteTask(req.params.id, req.user.id);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// BULK
exports.bulkAction = async (req, res) => {
    try {
        const { ids, action } = req.body;

        await taskService.bulkAction(req.user.id, ids, action);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};