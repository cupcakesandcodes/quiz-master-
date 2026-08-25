const Quiz = require('../models/Quiz');

module.exports = (io) => {
    const games = {};

    io.on('connection', (socket) => {

        // Host creates a game
        socket.on('create_game', async ({ quizId, customPin }) => {
            try {
                const quiz = await Quiz.findById(quizId);
                if (!quiz) return socket.emit('error', { message: 'Quiz not found' });

                const pin = customPin || Math.floor(100000 + Math.random() * 900000).toString();
                games[pin] = {
                    id: pin,
                    hostId: socket.id,
                    quiz: quiz,
                    players: [],
                    status: 'lobby',
                };
                socket.join(pin);
                socket.emit('game_created', { pin });
                console.log(`Game created: ${pin}`);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // Player joins a game
        socket.on('join_game', ({ pin, name }) => {
            const game = games[pin];
            if (game && game.status === 'lobby') {
                socket.join(pin);
                game.players.push({
                    id: socket.id,
                    name,
                    score: 0,
                    currentQuestionIndex: 0,
                    finished: false,
                    violationCount: 0,
                    violations: {},
                });
                io.to(game.hostId).emit('player_joined', { players: game.players });
                socket.emit('joined_game', { pin });
            } else {
                socket.emit('error', { message: 'Game not found or already started' });
            }
        });

        // Host starts the game
        socket.on('start_game', ({ pin }) => {
            const game = games[pin];
            if (game && game.hostId === socket.id) {
                game.status = 'active';
                game.startTime = Date.now();
                const totalTime = game.quiz.totalTime || 10;
                io.to(pin).emit('game_started', { totalTime });
                // Send first question to ALL players
                game.players.forEach(player => {
                    sendQuestionToPlayer(io, player.id, game.quiz.questions[0], 0, game.quiz.questions.length);
                });
            }
        });

        // Player requests next question (Self-paced)
        socket.on('request_next_question', ({ pin }) => {
            const game = games[pin];
            if (!game || game.status !== 'active') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            player.currentQuestionIndex++;

            if (player.currentQuestionIndex < game.quiz.questions.length) {
                const question = game.quiz.questions[player.currentQuestionIndex];
                sendQuestionToPlayer(io, player.id, question, player.currentQuestionIndex, game.quiz.questions.length);
            } else {
                player.finished = true;
                socket.emit('game_over', {
                    score: player.score,
                    quiz: game.quiz
                });
                io.to(game.hostId).emit('update_dashboard', { players: game.players });
            }
        });

        // Player submits answer
        socket.on('submit_answer', ({ pin, answerIndex }) => {
            const game = games[pin];
            if (!game || game.status !== 'active') return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player || player.finished) return;

            const question = game.quiz.questions[player.currentQuestionIndex];
            const isCorrect = question.correctIndex === answerIndex;

            if (isCorrect) {
                player.score += 1;
            }

            socket.emit('answer_result', { isCorrect, correctIndex: question.correctIndex, score: player.score });

            io.to(game.hostId).emit('update_dashboard', {
                players: game.players
            });
        });

        // Player violation (tab switch, minimize, fullscreen exit, webcam denied, etc.)
        socket.on('player_violation', ({ pin, type }) => {
            const game = games[pin];
            if (!game) return;

            const player = game.players.find(p => p.id === socket.id);
            if (!player) return;

            player.violationCount = (player.violationCount || 0) + 1;
            if (!player.violations) player.violations = {};
            player.violations[type] = (player.violations[type] || 0) + 1;
            player.lastViolationType = type;

            // Notify host immediately
            io.to(game.hostId).emit('update_dashboard', {
                players: game.players,
                lastViolation: {
                    playerId: socket.id,
                    playerName: player.name,
                    type: type
                }
            });
        });

        socket.on('disconnect', () => {
            // Cleanup: remove player from active games
            for (const pin in games) {
                const game = games[pin];
                const playerIndex = game.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    game.players.splice(playerIndex, 1);
                    io.to(game.hostId).emit('update_dashboard', { players: game.players });
                }
                // If host disconnects, clean up the game
                if (game.hostId === socket.id) {
                    io.to(pin).emit('error', { message: 'Host has disconnected' });
                    delete games[pin];
                }
            }
        });
    });
};

function sendQuestionToPlayer(io, playerId, question, index, total) {
    io.to(playerId).emit('new_question', {
        text: question.text,
        options: question.options,
        current: index + 1,
        total: total,
        timeLimit: question.timeLimit || 20
    });
}
