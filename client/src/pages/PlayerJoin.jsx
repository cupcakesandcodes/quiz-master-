import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

const PlayerJoin = () => {
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const navigate = useNavigate();
    const socket = useSocket();

    const joinGame = (e) => {
        e.preventDefault();
        if (name && pin) {
            if (socket) {
                socket.emit('join_game', { pin, name });
                socket.once('joined_game', ({ pin }) => {
                    navigate(`/game/${pin}`, { state: { name } });
                });
                socket.once('error', (err) => {
                    alert(err.message);
                });
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="card-glass w-full max-w-md animate-fade-in text-center p-6 sm:p-10">
                <div className="w-16 h-16 mx-auto mb-4 sm:mb-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    Join Game Room
                </h2>

                <form onSubmit={joinGame} className="space-y-6">
                    <div className="space-y-2 text-left">
                        <label className="text-sm font-bold text-primary uppercase tracking-wider ml-1">Game PIN</label>
                        <input
                            type="text"
                            placeholder="Enter 6-digit PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="input-glass text-center text-2xl font-mono tracking-widest placeholder:text-gray-600 placeholder:text-lg placeholder:font-sans"
                            maxLength={6}
                        />
                    </div>

                    <div className="space-y-2 text-left">
                        <label className="text-sm font-bold text-primary uppercase tracking-wider ml-1">Nickname</label>
                        <input
                            type="text"
                            placeholder="Your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-glass text-lg"
                            maxLength={12}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full shadow-lg shadow-primary/20 text-lg py-4">
                        Enter Game Lobby
                    </button>
                </form>

                <button
                    onClick={() => navigate('/')}
                    className="w-full mt-8 text-sm text-onSurfaceVariant hover:text-onSurface transition-colors flex items-center justify-center gap-2"
                >
                    <span>←</span> Back to Home
                </button>
            </div>
        </div>
    );
};

export default PlayerJoin;
