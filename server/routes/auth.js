const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_change_me';

// ─── Helper: validation error handler ───
function handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return null;
}

// Register
router.post('/register',
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    async (req, res) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) return;

        const { username, password } = req.body;
        try {
            const user = new User({ username, password });
            await user.save();
            res.status(201).json({ message: 'User registered successfully' });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ message: 'Username already exists. Please choose another one.' });
            }
            res.status(400).json({ message: err.message });
        }
    }
);

// Login
router.post('/login',
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    async (req, res) => {
        const { username, password } = req.body;
        try {
            const user = await User.findOne({ username });
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, username: user.username });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = router;
