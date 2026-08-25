const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const User = require('../models/User');
const Quiz = require('../models/Quiz');

require('./setup');

// Mock pdf-parse
jest.mock('pdf-parse', () => {
    return jest.fn().mockResolvedValue({
        text: 'This is a mocked PDF text about machine learning and neural networks.',
        numpages: 1
    });
});

// Mock OpenAI for all quiz tests
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn().mockImplementation((opts) => {
                    const promptStr = JSON.stringify(opts.messages);
                    const isRag = promptStr.includes('Generate exactly');
                    
                    if (promptStr.includes('Context from uploaded document')) {
                        // RAG format
                        return Promise.resolve({
                            choices: [{
                                message: {
                                    content: JSON.stringify([
                                        {
                                            question: 'What is the capital of France?',
                                            options: ['A. Paris', 'B. London', 'C. Berlin', 'D. Madrid'],
                                            correctAnswer: 'A',
                                            difficulty: 'easy',
                                            explanation: 'Paris is the capital.'
                                        }
                                    ])
                                }
                            }]
                        });
                    } else {
                        // Topic format
                        return Promise.resolve({
                            choices: [{
                                message: {
                                    content: JSON.stringify({
                                        title: 'Mock AI Quiz',
                                        questions: [
                                            {
                                                text: 'What is the capital of France?',
                                                options: ['Paris', 'London', 'Berlin', 'Madrid'],
                                                correctIndex: 0
                                            }
                                        ]
                                    })
                                }
                            }]
                        });
                    }
                })
            }
        },
        embeddings: {
            create: jest.fn().mockResolvedValue({
                data: [{ embedding: new Array(1536).fill(0.1) }]
            })
        }
    }));
});

let token;
let userId;

async function getAuthToken() {
    await request(app)
        .post('/api/auth/register')
        .send({ username: 'quizhost', password: 'password123' });

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'quizhost', password: 'password123' });

    token = loginRes.body.token;
    const user = await User.findOne({ username: 'quizhost' });
    userId = user._id;
}

describe('Quiz Routes', () => {
    beforeEach(async () => {
        await getAuthToken();
    });

    describe('POST /api/quizzes/generate (topic-based)', () => {
        it('should generate a quiz from a topic (using test mock)', async () => {
            const res = await request(app)
                .post('/api/quizzes/generate')
                .set('Authorization', `Bearer ${token}`)
                .send({ topic: 'test', numQuestions: 3, timeLimit: 10 });

            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBeDefined();
            expect(Array.isArray(res.body.questions)).toBe(true);
            expect(res.body.questions.length).toBe(3);
            expect(res.body.hostId).toBeDefined();
        });

        it('should return 400 when no topic or PDF provided', async () => {
            const res = await request(app)
                .post('/api/quizzes/generate')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/topic|pdf/i);
        });

        it('should return 401 without auth token', async () => {
            const res = await request(app)
                .post('/api/quizzes/generate')
                .send({ topic: 'test' });

            expect(res.statusCode).toBe(401);
        });
    });

    describe('POST /api/quizzes/generate (PDF upload)', () => {
        it('should handle PDF upload and generate quiz (using test mock)', async () => {
            // Create a minimal test PDF-like file for multer to process
            const testFilePath = path.join(__dirname, 'test-upload.pdf');
            fs.writeFileSync(testFilePath, 'This is a test PDF content about machine learning and neural networks.');

            try {
                const res = await request(app)
                    .post('/api/quizzes/generate')
                    .set('Authorization', `Bearer ${token}`)
                    .attach('pdf', testFilePath)
                    .field('topic', 'test')
                    .field('numQuestions', '3')
                    .field('timeLimit', '15');

                // The test mock topic returns mock data, so should succeed
                expect(res.statusCode).toBe(200);
                expect(res.body.questions).toBeDefined();
            } finally {
                if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
            }
        });
    });

    describe('GET /api/quizzes/:id', () => {
        it('should return a quiz by ID', async () => {
            const quiz = new Quiz({
                title: 'Test Quiz',
                topic: 'Testing',
                questions: [{
                    text: 'Q1?',
                    options: ['A', 'B', 'C', 'D'],
                    correctIndex: 0
                }],
                totalTime: 10,
                hostId: userId,
                source: 'manual'
            });
            await quiz.save();

            const res = await request(app)
                .get(`/api/quizzes/${quiz._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.title).toBe('Test Quiz');
            expect(res.body.topic).toBe('Testing');
        });

        it('should return 404 for non-existent quiz', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .get(`/api/quizzes/${fakeId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /api/quizzes (host quizzes)', () => {
        it('should return all quizzes for the authenticated host', async () => {
            await Quiz.create([
                { title: 'Quiz 1', topic: 'Topic 1', questions: [{ text: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }], hostId: userId, source: 'manual' },
                { title: 'Quiz 2', topic: 'Topic 2', questions: [{ text: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }], hostId: userId, source: 'ai' },
            ]);

            const res = await request(app)
                .get('/api/quizzes')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.quizzes).toBeDefined();
            expect(res.body.quizzes.length).toBe(2);
            expect(res.body.total).toBe(2);
        });

        it('should not return quizzes from other users', async () => {
            const otherId = new mongoose.Types.ObjectId();
            await Quiz.create({
                title: 'Other Quiz', topic: 'Other', questions: [{ text: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }],
                hostId: otherId, source: 'manual'
            });

            const res = await request(app)
                .get('/api/quizzes')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.quizzes.length).toBe(0);
        });
    });

    describe('DELETE /api/quizzes/:id', () => {
        it('should soft-delete a quiz and return 200', async () => {
            const quiz = await Quiz.create({
                title: 'Delete Me', topic: 'Test',
                questions: [{ text: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }],
                hostId: userId, source: 'manual'
            });

            const res = await request(app)
                .delete(`/api/quizzes/${quiz._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);

            const deleted = await Quiz.findById(quiz._id);
            expect(deleted.deletedAt).toBeTruthy();
        });

        it('should return 404 for quiz owned by another user', async () => {
            const otherId = new mongoose.Types.ObjectId();
            const quiz = await Quiz.create({
                title: 'Not Mine', topic: 'Test',
                questions: [{ text: 'Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }],
                hostId: otherId, source: 'manual'
            });

            const res = await request(app)
                .delete(`/api/quizzes/${quiz._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(404);
        });
    });
});
