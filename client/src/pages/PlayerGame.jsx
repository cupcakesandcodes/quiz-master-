import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';


const PlayerGame = () => {
    const { pin } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const socket = useSocket();

    // Game state
    const [status, setStatus] = useState('lobby');
    const [question, setQuestion] = useState(null);
    const [answered, setAnswered] = useState(false);
    const [result, setResult] = useState(null);
    const [waiting, setWaiting] = useState(false);
    const [minutes, setMinutes] = useState(0);
    const [seconds, setSeconds] = useState(0);
    const [timeUp, setTimeUp] = useState(false);

    // Fullscreen state
    const [gamePaused, setGamePaused] = useState(false);
    const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
    const [fullscreenConsent, setFullscreenConsent] = useState(false);
    const fullscreenRequested = useRef(false);

    // Anti-cheat state
    const [isPageBlurred, setIsPageBlurred] = useState(false);

    const gameActive = status === 'active' && !timeUp;

    const recordViolation = React.useCallback((type) => {
        const now = Date.now();
        if (window._lastViolationType === type && now - (window._lastViolationTime || 0) < 1000) return;
        window._lastViolationTime = now;
        window._lastViolationType = type;
        if (socket && pin) {
            socket.emit('player_violation', { pin, type });
        }
    }, [socket, pin]);

    // ─── Socket Events ───
    useEffect(() => {
        if (!socket) return;
        socket.on('game_started', ({ totalTime }) => {
            setStatus('ready');
            setMinutes(totalTime || 10);
            setSeconds(0);
        });
        socket.on('new_question', (q) => { setQuestion(q); setAnswered(false); setResult(null); setWaiting(false); });
        socket.on('answer_result', (res) => { setResult(res); setWaiting(true); });
        socket.on('game_over', ({ score, quiz }) => {
            setStatus('finished');
            setResult({ score, quiz });
            exitFullscreen();
        });
        socket.on('error', ({ message }) => {
            if (message === 'Host has disconnected') {
                setStatus('finished');
                alert('Host has ended the session.');
                exitFullscreen();
                navigate('/player');
            } else {
                alert(message);
            }
        });
        return () => {
            socket.off('game_started');
            socket.off('new_question');
            socket.off('answer_result');
            socket.off('game_over');
            socket.off('error');
        };
    }, [socket]);

    // ─── Timer ───
    useEffect(() => {
        if (status === 'active' && !timeUp && !gamePaused) {
            const interval = setInterval(() => {
                if (seconds > 0) setSeconds(p => p - 1);
                else if (minutes > 0) { setMinutes(p => p - 1); setSeconds(59); }
                else { clearInterval(interval); setTimeUp(true); setStatus('finished'); exitFullscreen(); }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [status, timeUp, minutes, seconds, gamePaused]);

    // ─── Browser Navigation Lock (Reload/Back/Forward) ───
    useEffect(() => {
        if (!gameActive) return;

        // 1. Trap backward/forward navigation with History API
        window.history.pushState(null, "", window.location.href);
        const handlePopState = () => {
            window.history.pushState(null, "", window.location.href);
        };
        window.addEventListener('popstate', handlePopState);

        // 2. Prevent Reload (Shows browser confirmation dialog)
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // 3. Intercept common keyboard shortcuts for reload (F5, Ctrl+R)
        const handleKeyDown = (e) => {
            if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [gameActive]);

    // ═══════════════════════════════════════════════
    //  FULLSCREEN ENFORCEMENT
    // ═══════════════════════════════════════════════
    const requestFullscreen = async () => {
        try {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
            fullscreenRequested.current = true;
        } catch (err) {
            console.error("Fullscreen error:", err);
            // Browser denied fullscreen — flag as soft violation
            recordViolation('fullscreen_denied');
        }
    };

    const exitFullscreen = () => {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (isFullscreen) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    const isInFullscreen = () => {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            const fullscreen = isInFullscreen();
            if (!fullscreen && gameActive && fullscreenRequested.current) {
                setGamePaused(true);
                setShowFullscreenWarning(true);
                recordViolation('fullscreen_exit');
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        }
    }, [gameActive, socket, pin]);

    // ─── Periodic fullscreen check — emit violation if not fullscreen ───
    useEffect(() => {
        if (!gameActive || !fullscreenRequested.current) return;
        const checkInterval = setInterval(() => {
            if (!isInFullscreen()) {
                if (!gamePaused) {
                    setGamePaused(true);
                    setShowFullscreenWarning(true);
                }
                recordViolation('not_fullscreen');
            }
        }, 3000);
        return () => clearInterval(checkInterval);
    }, [gameActive, gamePaused, recordViolation]);

    const handleReturnToFullscreen = async () => {
        try {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
            setGamePaused(false);
            setShowFullscreenWarning(false);
            // Do NOT re-emit violation on retry
        } catch (err) {
            console.error("Return to fullscreen error:", err);
            // Still denied — keep paused
        }
    };

    // ─── Fullscreen + Start Quiz handler (user gesture) ───
    // IMPORTANT: requestFullscreen MUST be called directly in the synchronous
    // portion of the click handler to satisfy the browser's user-gesture requirement.
    const handleFullscreenConsent = () => {
        const elem = document.documentElement;
        
        // Emphasize: mark it synchronously so that when gameActive triggers the useEffect,
        // it registers the setInterval correctly!
        fullscreenRequested.current = true;

        const fsPromise = elem.requestFullscreen
            ? elem.requestFullscreen()
            : elem.webkitRequestFullscreen
                ? elem.webkitRequestFullscreen()
                : elem.msRequestFullscreen
                    ? elem.msRequestFullscreen()
                    : Promise.reject(new Error('Fullscreen API not supported'));

        // Always start the quiz
        setFullscreenConsent(true);
        setStatus('active');

        Promise.resolve(fsPromise)
            .catch((err) => {
                console.error('Fullscreen request denied:', err);
                recordViolation('fullscreen_denied');
            });
    };

    // ═══════════════════════════════════════════════
    //  ANTI-CHEAT MONITORING
    // ═══════════════════════════════════════════════
    useEffect(() => {
        const hideScreen = () => {
            const root = document.getElementById('root');
            if (root) root.style.opacity = '0';
            setIsPageBlurred(true);
        };

        const showScreen = () => {
            const root = document.getElementById('root');
            if (root) root.style.opacity = '1';
            setIsPageBlurred(false);
        };

        const handleBlur = () => {
            hideScreen();
            recordViolation('blur');
        };
        const handleFocus = () => showScreen();
        const handleVisibilityChange = () => {
            if (document.hidden) { hideScreen(); recordViolation('minimize_or_tab'); }
        };
        const handleResize = () => recordViolation('resize');
        const handleKeys = (e) => {
            if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p') || (e.metaKey && e.shiftKey && e.key === 's')) {
                hideScreen();
                recordViolation('screenshot');
                
                // Try to overwrite clipboard aggressively if they hit PrintScreen
                if (navigator.clipboard && navigator.clipboard.writeText) {
                     navigator.clipboard.writeText("Screenshots are disabled during quizzes.");
                }

                setTimeout(() => showScreen(), 3000);
            }
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('keyup', handleKeys);
        window.addEventListener('keydown', handleKeys);
        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('keyup', handleKeys);
            window.removeEventListener('keydown', handleKeys);
        };
    }, [socket, pin]);

    // ─── Actions ───
    const submitAnswer = (index) => {
        if (!answered && !waiting && !timeUp && !gamePaused) {
            socket.emit('submit_answer', { pin, answerIndex: index });
            setAnswered(true);
        }
    };
    const nextQuestion = () => { socket.emit('request_next_question', { pin }); };
    const preventCopy = (e) => { e.preventDefault(); return false; };

    const downloadSolutions = async () => {
        if (!result?.quiz) return;
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ text: result.quiz.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
                    new Paragraph({ text: `Your Final Score: ${result.score} Marks`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
                    ...result.quiz.questions.flatMap((q, i) => [
                        new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${q.text}`, bold: true })], spacing: { before: 200, after: 100 } }),
                        new Paragraph({ children: [new TextRun({ text: "Options:", italics: true })] }),
                        ...q.options.map((opt) => new Paragraph({ text: `- ${opt}`, indent: { left: 720 } })),
                        new Paragraph({ children: [new TextRun({ text: "Correct Answer: ", bold: true }), new TextRun({ text: q.options[q.correctIndex], color: "228B22", bold: true })], spacing: { after: 200 } }),
                    ]),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${result.quiz.title}_Solutions.docx`);
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4 select-none relative"
            onContextMenu={preventCopy}
            onCopy={preventCopy}
            onCut={preventCopy}
            onPaste={preventCopy}
        >
            {/* ─── Fullscreen Paused Overlay ─── */}
            {showFullscreenWarning && gamePaused && (
                <div className="fixed inset-0 z-[60] bg-background backdrop-blur-2xl flex items-center justify-center text-center p-8">
                    <div className="animate-fade-in max-w-md">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                            <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black text-yellow-400 mb-3">Quiz Paused</h2>
                        <p className="text-gray-300 mb-2">You exited fullscreen.</p>
                        <p className="text-gray-500 text-sm mb-8">Return to fullscreen to continue your quiz. This violation has been logged.</p>
                        <button
                            onClick={handleReturnToFullscreen}
                            className="btn-primary px-8 py-4 text-lg shadow-2xl shadow-primary/30 flex items-center justify-center gap-2 mx-auto"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
                            Return to Fullscreen
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Anti-Cheat Blur Overlay ─── */}
            {isPageBlurred && !gamePaused && (
                <div className="fixed inset-0 z-50 bg-background backdrop-blur-2xl flex items-center justify-center text-center p-8">
                    <div className="animate-pulse">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                        </div>
                        <h2 className="text-4xl font-black text-red-500 mb-2">Anti-Cheating Active</h2>
                        <p className="text-gray-500">Please keep the quiz window focused.</p>
                    </div>
                </div>
            )}

            <div className={`w-full max-w-2xl transition-all duration-300 ${(isPageBlurred || gamePaused) ? 'blur-2xl grayscale' : ''}`}>
                {/* Header bar */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="font-bold text-sm tracking-wide">{location.state?.name || 'Guest'}</span>
                    </div>
                    {status === 'active' && (
                        <div className={`px-4 py-2 rounded-full border font-mono font-bold transition-colors ${
                            minutes < 1 ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' : 'bg-primary/20 border-primary/50 text-primary'
                        }`}>
                            {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                        </div>
                    )}
                </div>

                {/* ─── Lobby ─── */}
                {status === 'lobby' && (
                    <div className="card-glass text-center py-10 sm:py-16 animate-fade-in mx-auto w-full">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-bounce-slow">
                            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></svg>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black mb-4">You're In!</h2>

                        <div className="flex justify-center items-center gap-3 text-gray-400">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                            <span>Waiting for host</span>
                        </div>
                    </div>
                )}

                {/* ─── Ready State — Fullscreen Permission Gate ─── */}
                {status === 'ready' && (
                    <div className="card-glass text-center py-10 sm:py-16 animate-fade-in mx-auto w-full">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-bounce">
                            <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black mb-4">Quiz Started!</h2>
                        
                        {/* Fullscreen permission gate */}
                        <div className="mx-auto max-w-md space-y-6">
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 text-left space-y-3">
                                <h3 className="text-lg font-black text-yellow-400 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                                    Exam Mode Requirements
                                </h3>
                                <ul className="space-y-2 text-sm text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-yellow-400 mt-0.5">•</span>
                                        <span>Your browser will enter <strong className="text-white">fullscreen mode</strong>. Exiting fullscreen will log a violation.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-yellow-400 mt-0.5">•</span>
                                        <span><strong className="text-white">Tab switching</strong>, <strong className="text-white">window resizing</strong>, and <strong className="text-white">screenshots</strong> are monitored.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-yellow-400 mt-0.5">•</span>
                                        <span>All violations will be <strong className="text-white">reported to the host</strong>.</span>
                                    </li>
                                </ul>
                            </div>
                            <p className="text-gray-500 text-xs">By clicking below, you agree to enter fullscreen exam mode.</p>
                            <button
                                onClick={handleFullscreenConsent}
                                className="btn-primary w-full py-4 text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
                                Enter Fullscreen & Start Quiz
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Active Game ─── */}
                {status === 'active' && !timeUp && !gamePaused && (
                    <div className="animate-fade-in">
                        {question ? (
                            <>
                                {waiting ? (
                                    <div className="card-glass text-center py-10 sm:py-16">
                                        {result?.isCorrect ? (
                                            <div className="space-y-4">
                                                <div className="w-20 h-20 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center animate-bounce">
                                                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                                </div>
                                                <h2 className="text-3xl sm:text-4xl font-black text-green-400 mb-2">Correct!</h2>
                                                <p className="text-green-400/60 font-mono">+1 Mark</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center animate-pulse">
                                                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                                </div>
                                                <h2 className="text-3xl sm:text-4xl font-black text-red-400 mb-2">Wrong!</h2>
                                                <p className="text-red-400/60">Better luck next time</p>
                                            </div>
                                        )}
                                        <button onClick={nextQuestion} className="btn-primary mt-8 sm:mt-12 w-full max-w-xs text-lg flex items-center justify-center gap-2 mx-auto">
                                            Next Question
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6 sm:space-y-8">
                                        <div>
                                            <span className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wider mb-1 block">
                                                Question {question.current} / {question.total}
                                            </span>
                                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{question.text}</h2>
                                        </div>
                                        <div className="grid gap-4">
                                            {question.options.map((opt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => submitAnswer(i)}
                                                    className="group w-full text-left p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 hover:scale-[1.01] transition-all duration-200 flex items-center gap-3 sm:gap-4"
                                                >
                                                    <span className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm sm:text-base text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                                        {String.fromCharCode(65 + i)}
                                                    </span>
                                                    <span className="text-lg sm:text-xl line-clamp-2">{opt}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="card-glass p-12 text-center">
                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                                <p className="text-gray-500">Loading your question...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Game Over ─── */}
                {(status === 'finished' || timeUp) && (
                    <div className="card-glass text-center py-12 sm:py-16 animate-fade-in relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
                            </div>
                            <h2 className="text-4xl sm:text-5xl font-black mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary px-4">
                                {timeUp ? "Time's Up!" : "Quiz Complete!"}
                            </h2>
                            <div className="my-8 p-6 sm:p-8 bg-white/5 mx-4 sm:mx-6 rounded-2xl border border-white/10 inline-block min-w-[260px]">
                                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Final Marks</p>
                                <h1 className="text-6xl sm:text-8xl font-black text-white tracking-tighter">{result?.score || 0}</h1>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 px-6">
                                <button onClick={() => navigate('/')} className="btn-primary w-full sm:w-auto px-6 py-3 text-lg flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                                    Back to Home
                                </button>
                                {result?.quiz && (
                                    <button onClick={downloadSolutions} className="w-full sm:w-auto px-6 py-3 text-lg font-bold flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-all shadow-lg hover:shadow-sky-500/20">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                        Download Answers
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerGame;
