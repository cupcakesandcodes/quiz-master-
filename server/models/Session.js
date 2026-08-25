const mongoose = require('mongoose');

const ViolationLogSchema = new mongoose.Schema({
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const PlayerResultSchema = new mongoose.Schema({
    playerId: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    violationCount: { type: Number, default: 0 },
    violations: { type: Map, of: Number, default: {} },
    violationLog: [ViolationLogSchema],
    avgResponseTime: { type: Number, default: 0 },
    finished: { type: Boolean, default: false },
    answers: [{
        questionIndex: Number,
        selectedIndex: Number,
        isCorrect: Boolean,
        responseTime: Number
    }]
}, { _id: false });

const SessionSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gamePin: { type: String, required: true, unique: true, index: true },
    status: {
        type: String,
        enum: ['lobby', 'active', 'completed'],
        default: 'lobby'
    },
    players: [PlayerResultSchema],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

SessionSchema.index({ hostId: 1, status: 1 });
SessionSchema.index({ gamePin: 1 });

module.exports = mongoose.model('Session', SessionSchema);
