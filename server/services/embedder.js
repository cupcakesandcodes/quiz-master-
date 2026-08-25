const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
        "X-Title": "QuizMaster AI"
    }
});

/**
 * Embed an array of text chunks using OpenAI text-embedding-3-small.
 * Processes in batches of 20 to respect rate limits.
 * 
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<Float32Array[]>} Array of embedding vectors
 */
async function embedTexts(texts) {
    const BATCH_SIZE = 20;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);

        const response = await openai.embeddings.create({
            model: 'openai/text-embedding-3-small',
            input: batch,
        });

        for (const item of response.data) {
            allEmbeddings.push(new Float32Array(item.embedding));
        }

        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < texts.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return allEmbeddings;
}

/**
 * Embed a single query string.
 * 
 * @param {string} query - Text to embed
 * @returns {Promise<Float32Array>} Embedding vector
 */
async function embedQuery(query) {
    const response = await openai.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: query,
    });

    return new Float32Array(response.data[0].embedding);
}

module.exports = { embedTexts, embedQuery };
