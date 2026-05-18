// const authService = require("./auth.service");
// const User = require("./auth.model");

// // SIGNUP
// exports.signup = async (req, res) => {
//     try {
//         const data = await authService.signup(req.body);
//         res.json(data);
//     } catch (err) {
//         res.status(400).json({ message: err.message });
//     }
// };

// // LOGIN
// exports.login = async (req, res) => {
//     try {
//         const data = await authService.login(req.body.email, req.body.password);
//         res.json(data);
//     } catch (err) {
//         res.status(400).json({ message: err.message });
//     }
// };

// // 🔥 GET PROFILE
// exports.getProfile = async (req, res) => {
//     try {
//         const user = await User.findById(req.user.id).select("-password");
//         res.json(user);
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// };

// // 🔥 UPDATE PROFILE
// exports.updateProfile = async (req, res) => {
//     try {
//         const updatedUser = await User.findByIdAndUpdate(
//             req.user.id,
//             req.body,
//             { new: true }
//         );

//         res.json(updatedUser);
//     } catch (err) {
//         res.status(400).json({ message: err.message });
//     }
// };

const authService = require("./auth.service");
const User = require("./auth.model");

// =========================
// 🔐 SIGNUP
// =========================
exports.signup = async (req, res) => {
    try {
        const data = await authService.signup(req.body);

        return res.status(201).json(data);

    } catch (err) {
        console.error("SIGNUP ERROR:", err.message);

        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// =========================
// 🔐 LOGIN
// =========================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const data = await authService.login(
            email,
            password
        );

        return res.status(200).json(data);

    } catch (err) {
        console.error("LOGIN ERROR:", err.message);

        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// =========================
// 👤 GET PROFILE
// =========================
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json(user);

    } catch (err) {
        console.error("GET PROFILE ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =========================
// ✏ UPDATE PROFILE
// =========================
exports.updateProfile = async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        ).select("-password");

        return res.status(200).json(updatedUser);

    } catch (err) {
        console.error("UPDATE PROFILE ERROR:", err.message);

        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
};