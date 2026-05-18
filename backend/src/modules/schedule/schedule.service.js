const Schedule = require('./schedule.model');

// ================= CREATE =================
exports.createSchedule = async (data) => {
    return await Schedule.create(data);
};

// ================= GET =================
exports.getSchedules = async (userId) => {
    return await Schedule.find({ user: userId }).sort({ createdAt: -1 });
};

// ================= UPDATE =================
exports.updateSchedule = async (scheduleId, userId, data) => {
    const schedule = await Schedule.findOne({ _id: scheduleId, user: userId });
    
    if (!schedule) throw new Error("Schedule not found");

    if (data.title !== undefined) schedule.title = data.title;
    if (data.description !== undefined) schedule.description = data.description;
    if (data.event !== undefined) schedule.event = data.event;
    if (data.category !== undefined) schedule.category = data.category;
    if (data.customCategory !== undefined) schedule.customCategory = data.customCategory;
    if (data.priority !== undefined) schedule.priority = data.priority;
    if (data.startDate !== undefined) schedule.startDate = data.startDate;
    if (data.endDate !== undefined) schedule.endDate = data.endDate;
    if (data.steps !== undefined) schedule.steps = data.steps;

    return await schedule.save();
};

// ================= DELETE =================
exports.deleteSchedule = async (scheduleId, userId) => {
    return await Schedule.findOneAndDelete({ _id: scheduleId, user: userId });
};
