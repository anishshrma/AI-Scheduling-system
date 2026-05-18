require("dotenv").config();
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);

module.exports = oauth2Client;