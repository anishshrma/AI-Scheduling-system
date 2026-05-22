const jwt = require("jsonwebtoken");
const { secret } = require("../config/jwt");

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Invalid token format" });
        }

        const decoded = jwt.verify(token, secret);

        // 🔥 DEFENSIVE NORMALIZATION:
        // Guarantees both req.user.id and req.user._id always exist, regardless of how the token was signed!
        const userId = decoded.id || decoded._id || decoded.userId;

        if (!userId) {
            return res.status(401).json({ error: "Invalid token payload: User ID missing" });
        }

        req.user = {
            id: userId,
            _id: userId,
            ...decoded
        };

        next();

    } catch (err) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
};