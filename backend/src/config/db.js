const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        console.log("⏳ Connecting to MongoDB...");

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // ⏱️ stop trying after 5 sec
            socketTimeoutMS: 45000,         // ⏱️ close inactive sockets
        });

        console.log("✅ MongoDB Connected");

    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err.message);
        process.exit(1);
    }
};

// 🔥 EXTRA: track connection status (VERY IMPORTANT)
mongoose.connection.on("connected", () => {
    console.log("🟢 Mongoose connected to DB");
});

mongoose.connection.on("error", (err) => {
    console.log("🔴 Mongoose error:", err.message);
});

mongoose.connection.on("disconnected", () => {
    console.log("🟡 Mongoose disconnected");
});

module.exports = connectDB;