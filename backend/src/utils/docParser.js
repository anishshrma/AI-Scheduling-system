const mammoth = require('mammoth');

const parseDOC = async(filePath) => {
    const result = await mammoth.extractRawText({
        path: filePath
    });

    return result.value;
};

module.exports = parseDOC;