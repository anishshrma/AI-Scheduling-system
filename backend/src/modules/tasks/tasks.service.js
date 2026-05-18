
const Task = require('./tasks.model');

// ================= STATUS =================
const getStatus = (deadline, currentStatus) => {
    if (currentStatus === "completed") return "completed";

    if (deadline && new Date(deadline) < new Date()) {
        return "overdue";
    }

    return "pending";
};

// ================= CREATE =================
exports.createTask = async (data) => {
    const status = getStatus(data.deadline, "pending");

    return await Task.create({
        ...data,
        status
    });
};

// ================= GET =================
exports.getTasks = async (userId) => {
    let tasks = await Task.find({ user: userId });

    tasks = tasks.map(task => {
        task.status = getStatus(task.deadline, task.status);
        return task;
    });

    return tasks;
};

// ================= UPDATE =================
exports.updateTask = async (taskId, userId, data) => {

    const task = await Task.findOne({ _id: taskId, user: userId });

    if (!task) throw new Error("Task not found");

    // SAFE UPDATE (VERY IMPORTANT)
    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.category !== undefined) task.category = data.category;
    if (data.deadline !== undefined) task.deadline = data.deadline;
    if (data.priority !== undefined) task.priority = data.priority;

    if (data.status !== undefined) task.status = data.status;
    if (data.isFavorite !== undefined) task.isFavorite = data.isFavorite;
    if (data.isArchived !== undefined) task.isArchived = data.isArchived;
    if (data.isDeleted !== undefined) task.isDeleted = data.isDeleted;

    task.status = getStatus(task.deadline, task.status);

    return await task.save();
};

// ================= DELETE =================
exports.deleteTask = async (taskId, userId) => {
    return await Task.findOneAndUpdate(
        { _id: taskId, user: userId },
        { isDeleted: true },
        { new: true }
    );
};

// ================= BULK =================
exports.bulkAction = async (userId, ids, action) => {

    const update = {};

    if (action === "delete") update.isDeleted = true;
    if (action === "archive") update.isArchived = true;
    if (action === "complete") update.status = "completed";
    if (action === "favorite") update.isFavorite = true;

    return await Task.updateMany(
        { _id: { $in: ids }, user: userId },
        update
    );
};