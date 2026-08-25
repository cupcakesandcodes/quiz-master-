const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Session = require('../models/Session');

require('./setup');

let token;
let userId;
let quizId;

async function setupTestData() {
    await request(app)
        .post('/api/auth/register')
        .send({ username: 'sessionhost', password: 'password123' });

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'sessionhost', password: 'password123' });

    token = loginRes.body.token;
    const user = await User.findOne({ username: 'sessionhost' });
    userId = user._id;

    const quiz = await Quiz.create({
        title: 'Session Test Quiz',
        topic: 'Testing',
        questions: [
            { text: 'Q1?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
            { text: 'Q2?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
            { text: 'Q3?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
        ],
        totalTime: 10,
        hostId: userId,
        source: 'manual'
    });
    quizId = quiz._id;
}

describe('Session Routes', () => {
    beforeEach(async () => {
        await setupTestData();
    });

    describe('POST /api/sessions/start', () => {
        it('should create a session with a 6-digit gamePin', async () => {
            const res = await request(app)
                .post('/api/sessions/start')
                .set('Authorization', `Bearer ${token}`)
                .send({ quizId });

            expect(res.statusCode).toBe(201);
            expect(res.body.sessionId).toBeDefined();
            expect(res.body.gamePin).toBeDefined();
            expect(res.body.gamePin).toMatch(/^\d{6}$/);
            expect(res.body.status).toBe('lobby');
        });

        it('should return 400 without quizId', async () => {
            const res = await request(app)
                .post('/api/sessions/start')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/quizId/i);
        });

        it('should return 404 for non-existent quiz', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .post('/api/sessions/start')
                .set('Authorization', `Bearer ${token}`)
                .send({ quizId: fakeId });

            expect(res.statusCode).toBe(404);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/sessions/start')
                .send({ quizId });

            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/sessions/:pin', () => {
        it('should return session by pin', async () => {
            const createRes = await request(app)
                .post('/api/sessions/start')
                .set('Authorization', `Bearer ${token}`)
                .send({ quizId });

            const pin = createRes.body.gamePin;

            const res = await request(app)
                .get(`/api/sessions/${pin}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.gamePin).toBe(pin);
            expect(res.body.status).toBe('lobby');
        });

        it('should return 404 for non-existent pin', async () => {
            const res = await request(app)
                .get('/api/sessions/999999');

            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/sessions/:pin/end', () => {
        it('should mark session as completed and calculate scores', async () => {
            const createRes = await request(app)
                .post('/api/sessions/start')
                .set('Authorization', `Bearer ${token}`)
                .send({ quizId });

            const pin = createRes.body.gamePin;

            // Add some player data directly to the session
            await Session.findOneAndUpdate(
                { gamePin: pin },
                {
                    status: 'active',
                    players: [
                        {
                            playerId: 'player1',
                            name: 'Alice',
                            score: 0,
                            correctAnswers: 3,
                            wrongAnswers: 0,
                            unanswered: 0,
                            violationCount: 0,
                            finished: true
                        },
                        {
                            playerId: 'player2',
                            name: 'Bob',
                            score: 0,
                            correctAnswers: 1,
                            wrongAnswers: 2,
                            unanswered: 0,
                            violationCount: 2,
                            finished: true
                        }
                    ]
                }
            );

            const res = await request(app)
                .post(`/api/sessions/${pin}/end`)
                .set('Authorization', `Bearer ${token}`);
            console.log("Response body for POST /api/sessions/:pin/end: ", res.body);
            expect(res.statusCode).toBe(200);
            expect(res.body.message).toMatch(/completed/i);
            expect(res.body.session.status).toBe('completed');
            expect(res.body.session.completedAt).toBeDefined();
            expect(res.body.session.players).toHaveLength(2);

            // Verify scores are calculated
            const alice = res.body.session.players.find(p => p.name === 'Alice');
            expect(alice.score).toBe(3);
        });

        it('should return 404 for non-existent session pin', async () => {
            const res = await request(app)
                .post('/api/sessions/000000/end')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(404);
        });
    });
});
