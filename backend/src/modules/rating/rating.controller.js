const Rating = require("./rating.model");

exports.submitRating = async (req, res) => {
    try {
        const { rating } = req.body;

        const newRating = await Rating.create({
            userId: req.user.id,
            rating
        });

        res.json({ message: "Rating saved", newRating });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};