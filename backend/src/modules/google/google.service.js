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
            maxResults: 100,
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

// =====================================
// 📅 GOOGLE CALENDAR & OAUTH INTEGRATION
// =====================================
const User = require("../auth/auth.model");

exports.getOAuthClient = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.googleRefreshToken) {
            console.log("⚠️ getOAuthClient: User not found or Google Refresh Token not found for userId:", userId);
            return null;
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken,
        });

        // Listen for automatic token refresh events and save them in DB
        oauth2Client.on("tokens", async (tokens) => {
            console.log("🔄 Google Tokens Refreshed inside SDK!");
            if (tokens.access_token) {
                user.googleAccessToken = tokens.access_token;
            }
            if (tokens.refresh_token) {
                user.googleRefreshToken = tokens.refresh_token;
            }
            await user.save();
            console.log("💾 Saved updated OAuth tokens to DB.");
        });

        return oauth2Client;
    } catch (err) {
        console.error("❌ getOAuthClient error:", err.message);
        return null;
    }
};

exports.createCalendarEvent = async (userId, eventDetails) => {
    try {
        const authClient = await exports.getOAuthClient(userId);
        if (!authClient) {
            console.log("⚠️ Skipping calendar event: Google account not linked or error retrieving OAuth client");
            return null;
        }

        const calendar = google.calendar({
            version: "v3",
            auth: authClient,
        });

        const event = {
            summary: eventDetails.summary,
            description: eventDetails.description || "",
            start: {
                dateTime: eventDetails.start,
                timeZone: "Asia/Kolkata",
            },
            end: {
                dateTime: eventDetails.end,
                timeZone: "Asia/Kolkata",
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "popup", minutes: 30 },
                    { method: "email", minutes: 60 },
                ],
            },
        };

        console.log("📡 Creating Google Calendar Event for user:", userId, "-", event.summary);
        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
        });

        console.log("✅ Google Calendar Event Created successfully:", response.data.htmlLink);
        return response.data;
    } catch (err) {
        console.error("❌ Failed to create Google Calendar Event:", err.message);
        return null;
    }
};