// const mongoose = require("mongoose");

// const userSchema = new mongoose.Schema({
//     name: String,
//     email: { type: String, unique: true },
//     password: String,

//     phone: String,
//     college: String,
//     rollNo: String,
//     branch: String,
//     semester: String,
//     dob: String,

//     googleAccessToken: String,
//     googleRefreshToken: String

// }, { timestamps: true });

// module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            default: ""
        },

        email: {
            type: String,
            unique: true,
            required: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            default: ""
        },

        phone: {
            type: String,
            default: ""
        },

        college: {
            type: String,
            default: ""
        },

        rollNo: {
            type: String,
            default: ""
        },

        branch: {
            type: String,
            default: ""
        },

        semester: {
            type: String,
            default: ""
        },

        dob: {
            type: String,
            default: ""
        },

        profileImage: {
            type: String,
            default: ""
        },

        googleAccessToken: {
            type: String,
            default: ""
        },

        googleRefreshToken: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "User",
    userSchema
);