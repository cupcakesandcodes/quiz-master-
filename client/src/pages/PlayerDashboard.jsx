import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

const PlayerDashboard = () => {
    const navigate = useNavigate();
    const socket = useSocket();
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [scheduledQuizzes, setScheduledQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const [showInfoModal, setShowInfoModal] = useState(null);

    // Fetch scheduled public quizzes
    useEffect(() => {
        fetch(`${API_URL}/api/quizzes/scheduled/public`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setScheduledQuizzes(data))
            .catch(() => setScheduledQuizzes([]))
            .finally(() => setLoading(false));
    }, []);

    // Update countdown every minute
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    const joinGame = (e) => {
        e.preventDefault();
        if (name && pin && socket) {
            socket.emit('join_game', { pin, name });
            socket.once('joined_game', ({ pin: joinedPin }) => {
                navigate(`/game/${joinedPin}`, { state: { name } });
            });
            socket.once('error', (err) => {
                alert(err.message);
            });
        }
    };

    const formatCountdown = (scheduledAt) => {
        const diff = new Date(scheduledAt).getTime() - now;
        if (diff <= 0) return 'Starting now!';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `Starts in ${days}d ${hours}h`;
        if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
        return `Starts in ${minutes}m`;
    };

    const isJoinable = (scheduledAt) => {
        const diff = new Date(scheduledAt).getTime() - now;
        return diff <= 10 * 60 * 1000 && diff > 0; // within 10 minutes
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 sm:py-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-10 sm:mb-16">
                    <h1
                        className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent cursor-pointer"
                        onClick={() => navigate('/')}
                    >
                        QuizMaster<span className="text-primary">.</span>AI
                    </h1>
                </div>

                {/* ─── Join a Live Quiz ─── */}
                <section className="mb-12 sm:mb-16">
                    <h2 className="text-2xl sm:text-3xl font-black mb-6 flex items-center gap-3">
                        <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></svg>
                        Join a Live Quiz
                    </h2>
                    <form onSubmit={joinGame} className="card-glass p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-xs font-bold text-primary uppercase tracking-widest">Game PIN</label>
                                <input
                                    type="text"
                                    placeholder="Enter 6-digit PIN"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="input-glass text-center text-xl font-mono tracking-widest"
                                    maxLength={6}
                                />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-xs font-bold text-primary uppercase tracking-widest">Nickname</label>
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="input-glass text-lg"
                                    maxLength={12}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    disabled={!name || !pin}
                                    className="btn-primary w-full sm:w-auto px-8 py-3 text-lg shadow-lg shadow-primary/20 disabled:opacity-40"
                                >
                                    Join →
                                </button>
                            </div>
                        </div>
                    </form>
                </section>

                {/* ─── Upcoming Scheduled Quizzes ─── */}
                <section className="mb-12 sm:mb-16">
                    <h2 className="text-2xl sm:text-3xl font-black mb-6 flex items-center gap-3">
                        <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                        Upcoming Scheduled Quizzes
                    </h2>

                    {loading ? (
                        <div className="card-glass p-12 text-center">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-onSurfaceVariant text-sm">Loading scheduled quizzes...</p>
                        </div>
                    ) : scheduledQuizzes.length > 0 ? (
                        <div className="space-y-3">
                            {scheduledQuizzes.map((quiz) => (
                                <div
                                    key={quiz._id}
                                    className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/5 transition-all"
                                >
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-onSurface text-lg">{quiz.title}</h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-onSurfaceVariant">
                                                <span>{quiz.questionCount} questions</span>
                                                <span>•</span>
                                                <span>{quiz.totalTime} min</span>
                                                <span>•</span>
                                                <span>by {quiz.hostName}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 sm:shrink-0">
                                        <span className={`text-sm font-bold ${isJoinable(quiz.scheduledAt) ? 'text-green-400 animate-pulse' : 'text-sky-400'}`}>
                                            {formatCountdown(quiz.scheduledAt)}
                                        </span>

                                        {isJoinable(quiz.scheduledAt) ? (
                                            <button
                                                onClick={() => {
                                                    setPin('');
                                                    // Focus the PIN input
                                                    document.querySelector('input[placeholder="Enter 6-digit PIN"]')?.focus();
                                                }}
                                                className="btn-primary text-sm py-2"
                                            >
                                                Join
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setShowInfoModal(quiz)}
                                                className="px-4 py-2 rounded-xl bg-surface border border-white/5 hover:bg-surfaceContainerLow transition-colors text-sm font-medium"
                                            >
                                                Info
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card-glass p-12 text-center">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center opacity-50">
                                <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                            </div>
                            <p className="text-onSurfaceVariant">No upcoming quizzes scheduled.</p>
                            <p className="text-onSurfaceVariant text-sm mt-1">Check back later or join a live quiz with a PIN above!</p>
                        </div>
                    )}
                </section>

                {/* ─── Public Quizzes (Coming Soon) ─── */}
                <section>
                    <h2 className="text-2xl sm:text-3xl font-black mb-6 flex items-center gap-3 opacity-50">
                        <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                        Public Quizzes
                        <span className="text-xs px-3 py-1 rounded-full bg-surface border border-white/5 text-onSurfaceVariant font-medium">Coming Soon</span>
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-30 pointer-events-none select-none">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card-glass p-5">
                                <div className="h-3 w-3/4 bg-surface/10 rounded-md mb-3" />
                                <div className="h-2 w-1/2 bg-surface rounded-md mb-6" />
                                <div className="h-8 w-full bg-surface rounded-xl" />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Back to home */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => navigate('/')}
                        className="text-sm text-onSurfaceVariant hover:text-onSurface transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <span>←</span> Back to Home
                    </button>
                </div>
            </div>

            {/* ─── Info Modal ─── */}
            {showInfoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-surfaceContainerLow backdrop-blur-sm animate-fade-in" onClick={() => setShowInfoModal(null)}>
                    <div className="card-glass p-8 max-w-md w-full mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                            </div>
                            <h2 className="text-2xl font-black">{showInfoModal.title}</h2>
                        </div>
                        <div className="space-y-4 text-sm">
                            {showInfoModal.topic && (
                                <div className="flex justify-between py-2 border-b border-white/5">
                                    <span className="text-onSurfaceVariant">Topic</span>
                                    <span className="text-onSurface font-medium">{showInfoModal.topic}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-onSurfaceVariant">Questions</span>
                                <span className="text-onSurface font-medium">{showInfoModal.questionCount}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-onSurfaceVariant">Duration</span>
                                <span className="text-onSurface font-medium">{showInfoModal.totalTime} minutes</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/5">
                                <span className="text-onSurfaceVariant">Host</span>
                                <span className="text-onSurface font-medium">{showInfoModal.hostName}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-onSurfaceVariant">Starts</span>
                                <span className="text-sky-400 font-medium">
                                    {new Date(showInfoModal.scheduledAt).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setShowInfoModal(null)} className="mt-6 w-full py-3 rounded-xl bg-surface hover:bg-surfaceContainerLow transition-colors font-bold text-sm">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerDashboard;
