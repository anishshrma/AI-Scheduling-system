// const Queue = require("bull");

// const emailQueue = new Queue("email-processing", {
//     redis: {
//         host: "127.0.0.1",
//         port: 6379
//     }
// });

// module.exports = emailQueue;

const Queue = require("bull");

const emailQueue = new Queue("email-processing", {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: {} // 🔥 REQUIRED for Upstash
    }
});

module.exports = emailQueue;