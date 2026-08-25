const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const auth = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════
//  POST /api/sessions/start — Start a new session
// ═══════════════════════════════════════════════════════════════
router.post('/start', auth, async (req, res) => {
    try {
        const { quizId } = req.body;
        if (!quizId) return res.status(400).json({ message: 'quizId is required' });

        const quiz = await Quiz.findById(quizId);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const gamePin = Math.floor(100000 + Math.random() * 900000).toString();

        const session = new Session({
            quizId,
            hostId: req.user.userId,
            gamePin,
            status: 'lobby',
            startedAt: new Date()
        });

        await session.save();

        res.status(201).json({
            sessionId: session._id,
            gamePin: session.gamePin,
            status: session.status
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/sessions/:pin — Get session by PIN
// ═══════════════════════════════════════════════════════════════
router.get('/:pin', async (req, res) => {
    try {
        const session = await Session.findOne({ gamePin: req.params.pin })
            .populate('quizId', 'title topic questions totalTime')
            .populate('hostId', 'username');

        if (!session) return res.status(404).json({ message: 'Session not found' });

        res.json(session);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/sessions/:pin/end — End session, calculate scores
// ═══════════════════════════════════════════════════════════════
router.post('/:pin/end', auth, async (req, res) => {
    try {
        const session = await Session.findOne({ gamePin: req.params.pin });
        if (!session) return res.status(404).json({ message: 'Session not found' });

        session.status = 'completed';
        session.completedAt = new Date();

        if (session.startedAt) {
            session.duration = Math.round((session.completedAt - session.startedAt) / 1000);
        }

        // Sync players from client if provided
        if (req.body && req.body.players && Array.isArray(req.body.players)) {
            session.players = req.body.players;
        }

        // Calculate final scores for each player
        session.players.forEach(player => {
            const totalQuestions = (player.correctAnswers || 0) + (player.wrongAnswers || 0) + (player.unanswered || 0);
            if (totalQuestions > 0) {
                player.score = player.correctAnswers || 0;
            }
        });

        // Sort players by score descending
        session.players.sort((a, b) => b.score - a.score);

        await session.save();

        res.json({
            message: 'Session completed',
            session: {
                _id: session._id,
                gamePin: session.gamePin,
                status: session.status,
                duration: session.duration,
                completedAt: session.completedAt,
                players: session.players
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/sessions/:sessionId/report/pdf — Download PDF report
// ═══════════════════════════════════════════════════════════════
router.get('/:sessionId/report/pdf', auth, async (req, res) => {
    try {
        const isObjectId = req.params.sessionId.match(/^[0-9a-fA-F]{24}$/);
        const query = isObjectId ? { _id: req.params.sessionId } : { gamePin: req.params.sessionId };
        
        const session = await Session.findOne(query)
            .populate('quizId')
            .populate('hostId', 'username');

        if (!session) return res.status(404).json({ message: 'Session not found' });

        const { generateSessionReport } = require('../services/reportGenerator');

        const quiz = session.quizId;
        const players = session.players;
        const questions = quiz ? quiz.questions : [];

        const doc = generateSessionReport(session, players, questions);

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `QuizMaster-Report-${session.gamePin}-${timestamp}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);
        doc.end();
    } catch (err) {
        console.error('PDF Report Error:', err);
        res.status(500).json({ message: 'Failed to generate report', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  GET /api/sessions/:sessionId/report/player/:playerId — Player personal report
// ═══════════════════════════════════════════════════════════════
router.get('/:sessionId/report/player/:playerId', async (req, res) => {
    try {
        const session = await Session.findById(req.params.sessionId)
            .populate('quizId')
            .populate('hostId', 'username');

        if (!session) return res.status(404).json({ message: 'Session not found' });

        const player = session.players.find(p => p.playerId === req.params.playerId);
        if (!player) return res.status(404).json({ message: 'Player not found in session' });

        const { generatePlayerReport } = require('../services/reportGenerator');

        const quiz = session.quizId;
        const questions = quiz ? quiz.questions : [];
        const allPlayers = session.players.sort((a, b) => b.score - a.score);
        const rank = allPlayers.findIndex(p => p.playerId === req.params.playerId) + 1;

        const doc = generatePlayerReport(session, player, questions, rank);

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `QuizMaster-Player-${player.name}-${timestamp}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);
        doc.end();
    } catch (err) {
        console.error('Player Report Error:', err);
        res.status(500).json({ message: 'Failed to generate player report', error: err.message });
    }
});

module.exports = router;
