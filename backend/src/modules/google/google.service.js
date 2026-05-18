const { google } = require("googleapis");

// 🔥 DEBUG MODE
const DEBUG = true;

exports.fetchEmails = async (authClient) => {
    const gmail = google.gmail({
        version: "v1",
        auth: authClient,
    });

    try {
        console.log("📡 FETCHING EMAIL LIST...");

        // =========================
        // 🔥 RELAXED QUERY (FIXED)
        // =========================
        const res = await gmail.users.messages.list({
            userId: "me",
            maxResults: 30,
            // 🔥 removed strict filter
        });

        const messages = res.data.messages || [];

        console.log("📩 MESSAGES FOUND:", messages.length);

        const emails = [];

        for (let msg of messages) {
            try {
                const msgData = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id,
                });

                const payload = msgData.data.payload;
                const headers = payload.headers;

                // =========================
                // 🔥 HEADERS
                // =========================
                const subject =
                    headers.find((h) => h.name === "Subject")?.value || "";

                const from =
                    headers.find((h) => h.name === "From")?.value || "";

                const date =
                    headers.find((h) => h.name === "Date")?.value || "";

                // =========================
                // 🔥 BODY EXTRACTION (FIXED)
                // =========================
                let body = "";

                const getBody = (parts) => {
                    for (let part of parts) {

                        // ✅ text/plain
                        if (part.mimeType === "text/plain" && part.body?.data) {
                            return Buffer.from(part.body.data, "base64").toString("utf-8");
                        }

                        // ✅ fallback HTML
                        if (part.mimeType === "text/html" && part.body?.data) {
                            return Buffer.from(part.body.data, "base64").toString("utf-8");
                        }

                        if (part.parts) {
                            const nested = getBody(part.parts);
                            if (nested) return nested;
                        }
                    }
                    return "";
                };

                if (payload.body?.data) {
                    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
                } else if (payload.parts) {
                    body = getBody(payload.parts);
                }

                // =========================
                // 🔥 CLEAN TEXT
                // =========================
                let text = (body || subject)
                    .replace(/<[^>]*>/g, " ") // remove HTML tags
                    .replace(/\r\n/g, " ")
                    .replace(/\n/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                if (!text) {
                    if (DEBUG) console.log("⚠️ EMPTY EMAIL SKIPPED:", subject);
                    continue;
                }

                if (DEBUG) {
                    console.log("📨 EMAIL:", subject.slice(0, 50));
                }

                emails.push({
                    id: msg.id,
                    subject,
                    from,
                    date,
                    text,
                });

            } catch (err) {
                console.error("❌ EMAIL PROCESS ERROR:", err.message);
            }
        }

        console.log("✅ FINAL EMAILS:", emails.length);

        return emails;

    } catch (err) {
        console.error("❌ GMAIL FETCH ERROR:", err.message);
        return [];
    }
};