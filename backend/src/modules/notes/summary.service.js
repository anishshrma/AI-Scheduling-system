const axios = require("axios");

const API_URL = process.env.T5_API_URL;

const headers = {
    Authorization: `Bearer ${process.env.T5_API_KEY}`
};

const generateAIText = async(prompt) => {

    try {

        const response = await axios.post(
            API_URL,
            {
                inputs: prompt
            },
            {
                headers
            }
        );

        if(Array.isArray(response.data)) {

            return response.data[0].generated_text;
        }

        return "No AI response";

    } catch (error) {

        console.log(
            error.response?.data || error.message
        );

        return "AI generation failed";
    }
};

exports.summarizeText = async(text) => {

    const prompt = `
    Summarize these notes in easy language:
    
    ${text}
    `;

    return await generateAIText(prompt);
};

exports.simplifyText = async(text) => {

    const prompt = `
    Simplify these notes for beginners:
    
    ${text}
    `;

    return await generateAIText(prompt);
};

exports.explainText = async(text) => {

    const prompt = `
    Explain these notes with examples:
    
    ${text}
    `;

    return await generateAIText(prompt);
};