const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();

// CORS — restrict to known client origin
app.use(cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Rate limiting — AI quiz generation (10 requests per minute)
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many requests — please try again in a minute' },
    standardHeaders: true,
    legacyHeaders: false
});

// Skip rate limiting in test environment
if (process.env.NODE_ENV !== 'test') {
    app.use('/api/quizzes/generate', aiLimiter);
}

app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));

// Serve Static Files in Production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));

    app.use((req, res) => {
        res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
    });
} else if (process.env.NODE_ENV !== 'test') {
    app.get('/', (req, res) => {
        res.send('AI Quiz Builder Server');
    });
}

module.exports = app;
