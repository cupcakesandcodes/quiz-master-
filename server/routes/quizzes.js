const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const OpenAI = require('openai');
const multer = require('multer');
const pdf = require('pdf-parse');
const fs = require('fs');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// RAG pipeline imports
const { chunkPdf } = require('../services/pdfChunker');
const { embedTexts } = require('../services/embedder');
const { QuizVectorStore } = require('../services/vectorStore');
const { generateRagQuiz } = require('../services/ragQuizGenerator');

const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
        "X-Title": "QuizMaster AI"
    }
});

// ─── Helper: Retry AI generation with exponential backoff ───
async function generateWithRetry(prompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "openai/gpt-3.5-turbo",
            });
            const text = response.choices[0].message.content.trim();
            
            let cleaned = text;
            const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
            if (match) {
                cleaned = match[1];
            } else {
                cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            }
            
            const parsed = JSON.parse(cleaned);
            // Validate structure
            if (!parsed.title || !Array.isArray(parsed.questions)) {
                throw new Error('Invalid structure — missing title or questions array');
            }
            return parsed;
        } catch (err) {
            console.error(`AI attempt ${i + 1}/${maxRetries} failed:`, err.message);
            if (i === maxRetries - 1) {
                throw new Error('AI failed to return valid JSON after ' + maxRetries + ' attempts: ' + err.message);
            }
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
        }
    }
}

// ─── Helper: Validation error handler ───
function handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════
//  POST /api/quizzes/generate — AI-powered quiz generation
// ═══════════════════════════════════════════════════════════════
router.post('/generate', auth, upload.single('pdf'),
    body('numQuestions').optional().isInt({ min: 1, max: 20 }).withMessage('numQuestions must be 1–20'),
    body('timeLimit').optional().isInt({ min: 1, max: 60 }).withMessage('timeLimit must be 1–60 minutes'),
    async (req, res) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) return;

        let { topic, numQuestions = 5, timeLimit = 20 } = req.body;
        numQuestions = parseInt(numQuestions) || 5;
        timeLimit = parseInt(timeLimit) || 20;

        // ─── PDF Upload → RAG Pipeline ───
        if (req.file) {
            try {
                const dataBuffer = fs.readFileSync(req.file.path);

                // Clean up uploaded file immediately
                try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

                // Step 1: Chunk the PDF
                const chunks = await chunkPdf(dataBuffer);

                // Step 2: Embed all chunks
                const chunkTexts = chunks.map(c => c.text);
                const embeddings = await embedTexts(chunkTexts);

                // Step 3: Build vector store
                const vectorStore = new QuizVectorStore(1536);
                await vectorStore.addChunks(chunks, embeddings);

                // Step 4: Generate quiz via RAG
                const queryText = topic || 'Generate a comprehensive quiz from this document';
                const ragResult = await generateRagQuiz({
                    query: queryText,
                    vectorStore,
                    numQuestions,
                    timeLimit
                });

                // Step 5: Save quiz with RAG metadata
                const quiz = new Quiz({
                    title: topic ? `${topic} Quiz` : 'Document Quiz',
                    topic: topic || 'Uploaded Document',
                    questions: ragResult.questions,
                    totalTime: timeLimit,
                    hostId: req.user.userId,
                    source: 'ai',
                    isDraft: true,
                    ragUsed: true,
                    sourceChunks: ragResult.sourceChunks,
                    generationMethod: 'pdf-rag'
                });

                await quiz.save();
                return res.json(quiz);

            } catch (err) {
                console.error('RAG Pipeline Error:', err);
                if (req.file && fs.existsSync(req.file.path)) {
                    try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
                }
                return res.status(500).json({
                    message: 'Failed to process PDF with RAG pipeline',
                    error: err.message
                });
            }
        }

        // ─── Topic-based generation (unchanged behavior) ───
        if (!topic) return res.status(400).json({ message: 'Topic or PDF is required' });

        // Force Mock for testing
        if (topic.toLowerCase() === 'test') {
            const mockQuestions = [];
            const count = numQuestions;
            for (let i = 0; i < count; i++) {
                mockQuestions.push({
                    text: `Test Question ${i + 1}?`,
                    options: ['Correct', 'Wrong A', 'Wrong B', 'Wrong C'],
                    correctIndex: 0
                });
            }
            const quiz = new Quiz({
                title: `Test Quiz`,
                topic: 'test',
                questions: mockQuestions,
                totalTime: timeLimit,
                hostId: req.user.userId,
                source: 'ai',
                isDraft: true,
                ragUsed: false,
                generationMethod: 'topic'
            });
            try {
                await quiz.save();
                return res.json(quiz);
            } catch (e) {
                return res.status(500).json({ message: e.message });
            }
        }

        try {
            const prompt = `Generate a highly intelligent and conceptual quiz about the topic: "${topic}". 
             Focus on testing core concepts, technical details, and important factual information.
             Generate exactly ${numQuestions} rigorous multiple choice questions with logically plausible distractors.
    Return ONLY a JSON object with this structure: 
    {
      "title": "Quiz Title",
      "questions": [
        {
          "text": "Question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctIndex": 0
        }
      ]
    }`;

            const quizData = await generateWithRetry(prompt);

            const quiz = new Quiz({
                title: quizData.title,
                topic: topic || '',
                questions: quizData.questions,
                totalTime: timeLimit,
                hostId: req.user.userId,
                source: 'ai',
                isDraft: true,
                ragUsed: false,
                generationMethod: 'topic'
            });

            await quiz.save();
            res.json(quiz);

        } catch (err) {
            console.error('AI Generation Error:', err.message);
            res.status(500).json({ message: 'Failed to generate quiz', error: err.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════
//  GET /api/quizzes/public — Community quizzes (no auth)
// ═══════════════════════════════════════════════════════════════
router.get('/public', async (req, res) => {
    try {
        const { search, tag, sort = 'recent', page = 1, limit = 12 } = req.query;
        const filter = { isPublic: true, deletedAt: null };

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { topic: { $regex: search, $options: 'i' } }
            ];
        }
        if (tag) filter.tags = tag;

        let sortOption = { createdAt: -1 };
        if (sort === 'popular') sortOption = { usageCount: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Quiz.countDocuments(filter);
        const quizzes = await Quiz.find(filter)
            .select('title topic tags totalTime isPublic isDraft usageCount scheduledAt source createdAt questions generationMethod ragUsed')
            .sort(sortOption)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const formatted = quizzes.map(q => ({
            ...q,
            questionCount: q.questions?.length || 0,
            questions: undefined,
        }));

        res.json({
            quizzes: formatted,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/quizzes/scheduled/public — Upcoming scheduled quizzes
// ═══════════════════════════════════════════════════════════════
router.get('/scheduled/public', async (req, res) => {
    try {
        const quizzes = await Quiz.find({
            isPublic: true,
            scheduledAt: { $gt: new Date() },
            deletedAt: null
        })
            .populate('hostId', 'username')
            .select('title topic scheduledAt totalTime questions hostId')
            .sort({ scheduledAt: 1 })
            .limit(20)
            .lean();

        const formatted = quizzes.map(q => ({
            _id: q._id,
            title: q.title,
            topic: q.topic,
            scheduledAt: q.scheduledAt,
            totalTime: q.totalTime,
            questionCount: q.questions?.length || 0,
            hostName: q.hostId?.username || 'Anonymous'
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/quizzes — List quizzes for logged-in host
// ═══════════════════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
    try {
        const { search, tag, sort = 'recent', page = 1, limit = 12, filter: filterType } = req.query;
        const dbFilter = { hostId: req.user.userId, deletedAt: null };

        if (search) {
            dbFilter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { topic: { $regex: search, $options: 'i' } }
            ];
        }
        if (tag) dbFilter.tags = tag;
        if (filterType === 'draft') dbFilter.isDraft = true;
        if (filterType === 'public') dbFilter.isPublic = true;
        if (filterType === 'scheduled') dbFilter.scheduledAt = { $ne: null };
        if (filterType === 'ai') dbFilter.source = 'ai';
        if (filterType === 'manual') dbFilter.source = 'manual';

        let sortOption = { createdAt: -1 };
        if (sort === 'popular') sortOption = { usageCount: -1 };
        if (sort === 'scheduled') sortOption = { scheduledAt: -1 };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Quiz.countDocuments(dbFilter);
        const quizzes = await Quiz.find(dbFilter)
            .select('title topic tags totalTime isPublic isDraft usageCount scheduledAt source createdAt questions description generationMethod ragUsed')
            .sort(sortOption)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const formatted = quizzes.map(q => ({
            ...q,
            questionCount: q.questions?.length || 0,
            questions: undefined,
        }));

        res.json({
            quizzes: formatted,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/quizzes — Create quiz manually (no AI)
// ═══════════════════════════════════════════════════════════════
router.post('/', auth,
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('questions').isArray({ min: 1 }).withMessage('At least 1 question required'),
    async (req, res) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) return;

        try {
            const { title, topic, questions, totalTime, tags, isPublic, isDraft, description } = req.body;
            const quiz = new Quiz({
                title,
                topic: topic || '',
                questions,
                totalTime: totalTime || 10,
                tags: tags || [],
                isPublic: isPublic || false,
                isDraft: isDraft !== undefined ? isDraft : true,
                description: description || '',
                hostId: req.user.userId,
                source: 'manual',
                generationMethod: 'manual'
            });
            await quiz.save();
            res.status(201).json(quiz);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════
//  POST /api/quizzes/suggest-distractors — AI distractor suggestions
// ═══════════════════════════════════════════════════════════════
router.post('/suggest-distractors', auth,
    body('questionText').trim().notEmpty().withMessage('questionText is required'),
    body('correctAnswer').trim().notEmpty().withMessage('correctAnswer is required'),
    async (req, res) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) return;

        try {
            const { questionText, correctAnswer } = req.body;
            const prompt = `Given the quiz question: "${questionText}"
The correct answer is: "${correctAnswer}"
Generate exactly 3 plausible but clearly incorrect alternative answers (distractors).
Respond with JSON only: { "suggestions": ["...", "...", "..."] }`;

            const response = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "openai/gpt-3.5-turbo",
            });
            const text = response.choices[0].message.content.trim();
            
            let cleaned = text;
            const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
            if (match) {
                cleaned = match[1];
            } else {
                cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            }
            
            const parsed = JSON.parse(cleaned);
            res.json(parsed);
        } catch (err) {
            console.error('Distractor suggestion error:', err.message);
            res.status(500).json({ message: 'Failed to generate distractors', error: err.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════
//  GET /api/quizzes/:id — Get single quiz
// ═══════════════════════════════════════════════════════════════
router.get('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ _id: req.params.id, deletedAt: null });
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  PUT /api/quizzes/:id — Update a quiz
// ═══════════════════════════════════════════════════════════════
router.put('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ _id: req.params.id, hostId: req.user.userId, deletedAt: null });
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const allowedFields = ['title', 'topic', 'questions', 'totalTime', 'tags', 'isPublic', 'isDraft', 'description', 'source'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) quiz[field] = req.body[field];
        });

        await quiz.save();
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  DELETE /api/quizzes/:id — Soft delete
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', auth, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ _id: req.params.id, hostId: req.user.userId, deletedAt: null });
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        quiz.deletedAt = new Date();
        await quiz.save();
        res.json({ message: 'Quiz deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/quizzes/:id/duplicate — Clone a quiz
// ═══════════════════════════════════════════════════════════════
router.post('/:id/duplicate', auth, async (req, res) => {
    try {
        const original = await Quiz.findOne({ _id: req.params.id, hostId: req.user.userId, deletedAt: null });
        if (!original) return res.status(404).json({ message: 'Quiz not found' });

        const clone = new Quiz({
            title: `Copy of ${original.title}`,
            topic: original.topic,
            questions: original.questions,
            totalTime: original.totalTime,
            tags: original.tags,
            isPublic: false,
            isDraft: true,
            description: original.description,
            hostId: req.user.userId,
            source: original.source === 'manual' ? 'manual' : 'ai-edited',
            generationMethod: original.generationMethod
        });
        await clone.save();
        res.status(201).json(clone);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/quizzes/:id/schedule — Set/clear schedule
// ═══════════════════════════════════════════════════════════════
router.post('/:id/schedule', auth,
    body('scheduledAt').optional({ nullable: true }),
    async (req, res) => {
        try {
            const quiz = await Quiz.findOne({ _id: req.params.id, hostId: req.user.userId, deletedAt: null });
            if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

            quiz.scheduledAt = req.body.scheduledAt || null;
            await quiz.save();
            res.json(quiz);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════
//  POST /api/quizzes/export-excel — Server-side Excel generation
//  Accepts token + player data in form body; responds with .xlsx file
//  This bypasses all browser enterprise download policies.
// ═══════════════════════════════════════════════════════════════
router.post('/export-excel', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { token, players, pin } = req.body;

        // Verify JWT from form body
        if (!token) return res.status(401).send('Unauthorized');
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).send('Invalid token');
        }

        const parsedPlayers = JSON.parse(players || '[]');

        const exportData = parsedPlayers.map((player, index) => {
            const v = player.violations || {};
            return {
                'Rank': index + 1,
                'Player Name': player.name,
                'Marks': player.score,
                'Total Violations': player.violationCount || 0,
                'Tab Switch': v['minimize_or_tab'] || 0,
                'Window Blur': v['blur'] || 0,
                'Window Resize': v['resize'] || 0,
                'Fullscreen Exit': v['fullscreen_exit'] || 0,
                'Fullscreen Denied': v['fullscreen_denied'] || 0,
                'Not Fullscreen': v['not_fullscreen'] || 0,
                'Screenshot Attempt': v['screenshot'] || 0,
                'Status': player.finished ? 'Completed' : 'In Progress',
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [
            { wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 16 },
            { wch: 13 }, { wch: 14 }, { wch: 15 }, { wch: 16 },
            { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 15 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Quiz Results');

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `Quiz_Results_${pin || 'export'}_${timestamp}.xlsx`;

        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).send('Export failed: ' + err.message);
    }
});

module.exports = router;
