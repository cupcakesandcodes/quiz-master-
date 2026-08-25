const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

require('./setup');

describe('Auth Routes', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'testuser', password: 'password123' });

            expect(res.statusCode).toBe(201);
            expect(res.body.message).toBe('User registered successfully');

            const user = await User.findOne({ username: 'testuser' });
            expect(user).toBeTruthy();
            expect(user.username).toBe('testuser');
        });

        it('should return 400 for duplicate username', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({ username: 'duplicate', password: 'password123' });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'duplicate', password: 'password456' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/already exists/i);
        });

        it('should return 400 for short username', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'ab', password: 'password123' });

            expect(res.statusCode).toBe(400);
        });

        it('should return 400 for short password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'validuser', password: '12345' });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/auth/register')
                .send({ username: 'loginuser', password: 'password123' });
        });

        it('should login with valid credentials and return JWT', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'loginuser', password: 'password123' });

            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.username).toBe('loginuser');
            expect(typeof res.body.token).toBe('string');
            expect(res.body.token.split('.')).toHaveLength(3);
        });

        it('should return 401 for wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'loginuser', password: 'wrongpassword' });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toMatch(/invalid/i);
        });

        it('should return 401 for non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nonexistent', password: 'password123' });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toMatch(/invalid/i);
        });
    });
});
