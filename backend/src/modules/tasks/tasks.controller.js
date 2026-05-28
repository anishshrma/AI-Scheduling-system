const taskService = require('./tasks.service');
const googleService = require("../google/google.service");

// CREATE
exports.createTask = async (req, res) => {
    try {
        console.log("=== CREATE TASK PROCESS ===");
        console.log("Authenticated User:", req.user);
        console.log("Request Payload:", req.body);

        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(400).json({ error: "User identity could not be verified from token" });
        }

        if (!req.body.title || !req.body.title.trim()) {
            return res.status(400).json({ error: "Task title is required" });
        }

        const task = await taskService.createTask({
            ...req.body,
            user: userId
        });

        // =====================================
        // 📅 SYNC TO GOOGLE CALENDAR (BACKGROUND)
        // =====================================
        if (task.deadline) {
            (async () => {
                try {
                    const start = new Date(task.deadline);
                    const end = new Date(task.deadline);
                    // Make it a 1-hour event ending at deadline
                    start.setHours(start.getHours() - 1);

                    await googleService.createCalendarEvent(userId, {
                        summary: `Task Deadline: ${task.title}`,
                        description: task.description || `Category: ${task.category}, Priority: ${task.priority}`,
                        start: start.toISOString(),
                        end: end.toISOString()
                    });
                } catch (calErr) {
                    console.error("⚠️ Background Google Calendar Sync Error:", calErr.message);
                }
            })();
        }

        res.json({ success: true, task });

    } catch (err) {
        console.error("❌ CREATE TASK ERROR:", err);
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