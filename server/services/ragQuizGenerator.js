const OpenAI = require('openai');
const { embedQuery } = require('./embedder');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
        "X-Title": "QuizMaster AI"
    }
});

const SYSTEM_PROMPT = `You are an expert quiz generator. Generate exactly {numQuestions} multiple-choice questions based ONLY on the provided context. Do not use outside knowledge.
Rules:
- Each question must be directly answerable from the context
- 4 options per question (A, B, C, D)
- Exactly one correct answer
- Vary difficulty: 30% easy, 50% medium, 20% hard
- No meta-questions about the document itself (e.g. "According to the text...")
- Return ONLY a JSON array, no markdown, no explanation

Format:
[
  {
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "difficulty": "medium",
    "explanation": "Brief explanation referencing the source material"
  }
]`;

/**
 * Generate quiz questions using RAG: retrieve relevant chunks, then prompt LLM.
 * 
 * @param {Object} params
 * @param {string} params.query - User's topic/query for quiz generation
 * @param {import('./vectorStore').QuizVectorStore} params.vectorStore - Populated vector store
 * @param {number} params.numQuestions - Number of questions to generate
 * @param {number} params.timeLimit - Time limit per question (passed through)
 * @returns {Promise<{questions: Array, sourceChunks: Array}>}
 */
async function generateRagQuiz({ query, vectorStore, numQuestions = 5, timeLimit = 20 }) {
    // Step 1: Embed the query
    const queryEmbedding = await embedQuery(query);

    // Step 2: Retrieve top 8 relevant chunks
    const topChunks = await vectorStore.similaritySearch(queryEmbedding, 8);

    if (topChunks.length === 0) {
        throw new Error('No relevant content found in the uploaded document');
    }

    // Step 3: Build context string
    const contextString = topChunks
        .map((chunk, i) => `[Chunk ${i + 1} | Page ~${chunk.pageApprox} | Relevance: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.text}`)
        .join('\n\n---\n\n');

    // Step 4: Build the prompt
    const systemPrompt = SYSTEM_PROMPT.replace('{numQuestions}', numQuestions.toString());

    const userPrompt = `Context from uploaded document:\n\n${contextString}\n\n---\n\nGenerate exactly ${numQuestions} multiple-choice questions based on the above context.`;

    // Step 5: Call LLM
    const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
    });

    const text = response.choices[0].message.content.trim();

    // Parse JSON response — handle markdown code blocks
    let cleaned = text;
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (match) {
        cleaned = match[1];
    } else {
        cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    const ragQuestions = JSON.parse(cleaned);

    // Transform RAG format to our quiz schema format
    const questions = ragQuestions.map(q => {
        // Extract correct answer index from letter (A=0, B=1, C=2, D=3)
        const correctLetter = q.correctAnswer.toUpperCase().trim();
        const correctIndex = correctLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

        // Clean option prefixes (remove "A. ", "B. ", etc.)
        const options = q.options.map(opt => opt.replace(/^[A-D]\.\s*/i, ''));

        return {
            text: q.question,
            options,
            correctIndex: Math.min(Math.max(correctIndex, 0), 3),
            timeLimit,
            difficulty: q.difficulty || 'medium',
            explanation: q.explanation || ''
        };
    });

    // Return top 3 source chunks for transparency
    const sourceChunks = topChunks.slice(0, 3).map(c => ({
        text: c.text.substring(0, 500),
        chunkIndex: c.chunkIndex
    }));

    return { questions, sourceChunks };
}

module.exports = { generateRagQuiz };
