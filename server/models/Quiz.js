const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    text: String,
    options: [String],
    correctIndex: Number,
    timeLimit: { type: Number, default: 20 }
});

const SourceChunkSchema = new mongoose.Schema({
    text: String,
    chunkIndex: Number
}, { _id: false });

const QuizSchema = new mongoose.Schema({
    title: String,
    topic: String,
    questions: [QuestionSchema],
    totalTime: { type: Number, default: 10 },
    createdAt: { type: Date, default: Date.now },

    // ─── Quiz Library Fields ───
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [String],
    isPublic: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: false },
    usageCount: { type: Number, default: 0 },
    scheduledAt: { type: Date, default: null },
    description: { type: String, default: '' },
    source: { type: String, enum: ['ai', 'manual', 'ai-edited'], default: 'ai' },
    deletedAt: { type: Date, default: null },

    // ─── RAG Pipeline Fields ───
    ragUsed: { type: Boolean, default: false },
    sourceChunks: [SourceChunkSchema],
    generationMethod: {
        type: String,
        enum: ['topic', 'pdf-rag', 'pdf-direct', 'manual'],
        default: 'topic'
    }
});

// Index for common queries
QuizSchema.index({ hostId: 1, deletedAt: 1 });
QuizSchema.index({ isPublic: 1, scheduledAt: 1 });

module.exports = mongoose.model('Quiz', QuizSchema);
