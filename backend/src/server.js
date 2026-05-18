// // const path = require("path");
// // const dotenv = require("dotenv");

// // dotenv.config({
// //     path: path.resolve(__dirname, "../.env"),
// // });

// // console.log("ENV PATH:", path.resolve(__dirname, "../.env"));

// // const app = require("./app");
// // const connectDB = require("./config/db");


// // // DB CONNECT
// // connectDB();

// // // ROUTES
// // const taskRoutes = require('./modules/tasks/tasks.routes');
// // const aiRoutes = require('./modules/ai/ai.routes');
// // const googleRoutes = require('./modules/google/google.routes');
// // const emailRoutes = require('./modules/email/email.routes');
// // const authRoutes = require('./modules/auth/auth.routes'); // ✅ ADD THIS
// // const ratingRoutes = require('./modules/rating/rating.routes');
// // app.use('/api/rating', ratingRoutes);
// // app.use('/api/tasks', taskRoutes);
// // app.use('/api/ai', aiRoutes);
// // app.use('/api/auth/google', googleRoutes);
// // app.use('/api/emails', emailRoutes);
// // app.use('/api/auth', authRoutes); // ✅ ADD THIS (CRITICAL)

// // // ERROR HANDLER
// // app.use((err, req, res, next) => {
// //     console.error(err.stack);
// //     res.status(500).json({ error: "Something went wrong" });
// // });

// // const PORT = process.env.PORT || 5001;

// // app.listen(PORT, "0.0.0.0", () => {
// //     console.log(`🚀 Server running on port ${PORT}`);
// // });

// require("dotenv").config();

// const app = require("./app");
// const connectDB = require("./config/db");

// // =========================
// // 🔥 ROUTES IMPORT
// // =========================
// const taskRoutes = require('./modules/tasks/tasks.routes');
// const aiRoutes = require('./modules/ai/ai.routes');
// const googleRoutes = require('./modules/google/google.routes');
// const emailRoutes = require('./modules/email/email.routes');
// const authRoutes = require('./modules/auth/auth.routes');
// const ratingRoutes = require('./modules/rating/rating.routes');

// // =========================
// // 🔥 MIDDLEWARE & ROUTES
// // =========================
// app.use('/api/rating', ratingRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/ai', aiRoutes);
// app.use('/api/auth/google', googleRoutes);
// app.use('/api/emails', emailRoutes);
// app.use('/api/auth', authRoutes);

// // =========================
// // 🔥 ERROR HANDLER
// // =========================
// app.use((err, req, res, next) => {
//     console.error("❌ ERROR:", err.stack);
//     res.status(500).json({ error: "Something went wrong" });
// });

// // =========================
// // 🚀 START SERVER
// // =========================
// const PORT = process.env.PORT || 5001;

// const startServer = async () => {
//     try {
//         await connectDB();

//         app.listen(PORT, "0.0.0.0", () => {
//             console.log(`🚀 Server running on port ${ PORT } `);
//         });

//     } catch (err) {
//         console.error("❌ Failed to start server:", err.message);
//         process.exit(1);
//     }
// };

// startServer();

require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

// =========================
// ROUTES IMPORT
// =========================
const taskRoutes =
    require("./modules/tasks/tasks.routes");

const aiRoutes =
    require("./modules/ai/ai.routes");

const googleRoutes =
    require("./modules/google/google.routes");

const emailRoutes =
    require("./modules/email/email.routes");

const authRoutes =
    require("./modules/auth/auth.routes");

const ratingRoutes =
    require("./modules/rating/rating.routes");

const scheduleRoutes =
    require("./modules/schedule/schedule.routes");

// =========================
// ROUTES
// =========================
app.use("/api/rating", ratingRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/ai", aiRoutes);

app.use("/api/auth/google", googleRoutes);

app.use("/api/emails", emailRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/schedule", scheduleRoutes);

// =========================
// ERROR HANDLER
// =========================
app.use((err, req, res, next) => {

    console.error("❌ ERROR:", err.stack);

    res.status(500).json({
        error: "Something went wrong"
    });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 5001;

const startServer = async () => {

    try {

        await connectDB();

        app.listen(PORT, "0.0.0.0", () => {

            console.log(
                `🚀 Server running on port ${PORT}`
            );
        });

    } catch (err) {

        console.error(
            "❌ Failed to start server:",
            err.message
        );

        process.exit(1);
    }
};

startServer();