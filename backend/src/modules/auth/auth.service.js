// const User = require("./auth.model");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const { secret } = require("../../config/jwt");

// // =========================
// // 🔐 SIGNUP
// // =========================
// exports.signup = async (data) => {
//     const { email, password } = data;

//     const existing = await User.findOne({ email });
//     if (existing) throw new Error("User already exists");

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//         ...data,
//         password: hashedPassword
//     });

//     const token = jwt.sign(
//         { id: user._id },
//         secret,
//         { expiresIn: "7d" }
//     );

//     // ✅ CORRECT RESPONSE (MATCH MODEL)
//     return {
//         user: {
//             _id: user._id,
//             name: user.name,
//             email: user.email,
//             phone: user.phone,
//             college: user.college,
//             rollNo: user.rollNo,
//             branch: user.branch,
//             semester: user.semester,
//             dob: user.dob
//         },
//         token
//     };
// };

// // =========================
// // 🔐 LOGIN
// // =========================
// exports.login = async (email, password) => {

//     const user = await User.findOne({ email });

//     if (!user) throw new Error("Invalid credentials");

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) throw new Error("Invalid credentials");

//     const token = jwt.sign(
//         { id: user._id },
//         secret,
//         { expiresIn: "7d" }
//     );

//     // ✅ CORRECT RESPONSE
//     return {
//         user: {
//             _id: user._id,
//             name: user.name,
//             email: user.email,
//             phone: user.phone,
//             college: user.college,
//             rollNo: user.rollNo,
//             branch: user.branch,
//             semester: user.semester,
//             dob: user.dob
//         },
//         token
//     };
// };


const User = require("./auth.model");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const { secret } = require("../../config/jwt");

// =========================
// EMAIL VALIDATION
// =========================
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// =========================
// PASSWORD VALIDATION
// =========================
const isStrongPassword = (password) => {
    return password.length >= 6;
};

// =========================
// 🔐 SIGNUP
// =========================
exports.signup = async (data) => {

    const {
        email,
        password
    } = data;

    // VALIDATION
    if (!email || !password) {
        throw new Error(
            "Email and password are required"
        );
    }

    if (!isValidEmail(email)) {
        throw new Error(
            "Invalid email format"
        );
    }

    if (!isStrongPassword(password)) {
        throw new Error(
            "Password must be at least 6 characters"
        );
    }

    const existing = await User.findOne({
        email
    });

    if (existing) {
        throw new Error(
            "User already exists"
        );
    }

    const hashedPassword =
        await bcrypt.hash(password, 10);

    const user = await User.create({
        ...data,
        password: hashedPassword
    });

    const token = jwt.sign(
        { id: user._id },
        secret,
        { expiresIn: "7d" }
    );

    return {
        success: true,

        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            college: user.college,
            rollNo: user.rollNo,
            branch: user.branch,
            semester: user.semester,
            dob: user.dob,
            profileImage: user.profileImage
        },

        token
    };
};

// =========================
// 🔐 LOGIN
// =========================
exports.login = async (
    email,
    password
) => {

    if (!email || !password) {
        throw new Error(
            "Email and password required"
        );
    }

    const user = await User.findOne({
        email
    });

    if (!user) {
        throw new Error(
            "Invalid credentials"
        );
    }

    // GOOGLE ACCOUNT WITHOUT PASSWORD
    if (!user.password) {
        throw new Error(
            "Please login with Google"
        );
    }

    const isMatch =
        await bcrypt.compare(
            password,
            user.password
        );

    if (!isMatch) {
        throw new Error(
            "Invalid credentials"
        );
    }

    const token = jwt.sign(
        { id: user._id },
        secret,
        { expiresIn: "7d" }
    );

    return {
        success: true,

        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            college: user.college,
            rollNo: user.rollNo,
            branch: user.branch,
            semester: user.semester,
            dob: user.dob,
            profileImage: user.profileImage
        },

        token
    };
};