const mlService = require('../../services/ml.service');

exports.processEmail = async (text) => {
    const result = await mlService.classifyEmail(text);

    return {
        category: result.category || result.prediction || "Unknown",
        confidence: result.confidence || "N/A",
    };
};