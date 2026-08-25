import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useNavigate, useLocation } from 'react-router-dom';
import QuizCard from '../components/QuizCard';
import ScheduleModal from '../components/ScheduleModal';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

const HostDashboard = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const location = useLocation();

    // ─── Tab State ───
    const [activeTab, setActiveTab] = useState('library'); // 'library' | 'create' | 'live'

    // ─── Library Tab State ───
    const [quizzes, setQuizzes] = useState([]);
    const [quizTotal, setQuizTotal] = useState(0);
    const [quizPage, setQuizPage] = useState(1);
    const [quizSearch, setQuizSearch] = useState('');
    const [quizFilter, setQuizFilter] = useState('all');
    const [quizSort, setQuizSort] = useState('recent');
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [scheduleModal, setScheduleModal] = useState(null);

    // ─── Create Tab State ───
    const [topic, setTopic] = useState('');
    const [file, setFile] = useState(null);
    const [numQuestions, setNumQuestions] = useState(5);
    const [timeLimit, setTimeLimit] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);

    // ─── Live Session State ───
    const [quiz, setQuiz] = useState(null);
    const [pin, setPin] = useState(null);
    const [players, setPlayers] = useState([]);
    const [gameStatus, setGameStatus] = useState('idle');
    const [notifications, setNotifications] = useState([]);
    const [showEndSessionModal, setShowEndSessionModal] = useState(false);
    const [minutes, setMinutes] = useState(0);
    const [seconds, setSeconds] = useState(0);
    const [timeUp, setTimeUp] = useState(false);

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    // ─── Auto-launch from QuizBuilder ───
    useEffect(() => {
        if (location.state?.launchQuizId) {
            const quizId = location.state.launchQuizId;
            // Clear the state so it doesn't re-trigger
            window.history.replaceState({}, document.title);
            // Fetch quiz and auto-launch
            fetch(`${API_URL}/api/quizzes/${quizId}`, { headers })
                .then(r => r.json())
                .then(data => {
                    setQuiz(data);
                    setActiveTab('live');
                    if (socket) socket.emit('create_game', { quizId: data._id });
                })
                .catch(console.error);
        }
    }, [location.state, socket]);

    // ─── Library Fetch ───
    const fetchQuizzes = useCallback(async (page = 1, append = false) => {
        setLibraryLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '12',
                sort: quizSort,
            });
            if (quizSearch) params.set('search', quizSearch);
            if (quizFilter !== 'all') params.set('filter', quizFilter);

            const res = await fetch(`${API_URL}/api/quizzes?${params}`, { headers });
            
            if (res.status === 401) {
                localStorage.removeItem('token');
                navigate('/host/login');
                return;
            }
            
            if (!res.ok) throw new Error('Failed to load quizzes');
            const data = await res.json();

            if (append) {
                setQuizzes(prev => [...prev, ...data.quizzes]);
            } else {
                setQuizzes(data.quizzes);
            }
            setQuizTotal(data.total);
            setQuizPage(data.page);
        } catch (err) {
            console.error(err);
        } finally {
            setLibraryLoading(false);
        }
    }, [quizSearch, quizFilter, quizSort, token]);

    useEffect(() => {
        if (activeTab === 'library') {
            fetchQuizzes(1);
        }
    }, [activeTab, quizSearch, quizFilter, quizSort]);

    // ─── Debounced search ───
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setQuizSearch(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // ─── Live Session Timer ───
    useEffect(() => {
        if (gameStatus === 'active' && !timeUp) {
            const interval = setInterval(() => {
                if (seconds > 0) setSeconds(p => p - 1);
                else if (minutes > 0) { setMinutes(p => p - 1); setSeconds(59); }
                else { clearInterval(interval); setTimeUp(true); }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [gameStatus, timeUp, minutes, seconds]);

    // ─── Socket Events ───
    useEffect(() => {
        if (!socket) return;
        socket.on('game_created', ({ pin }) => { setPin(pin); setGameStatus('lobby'); });
        socket.on('player_joined', ({ players }) => setPlayers(players));
        socket.on('game_started', ({ totalTime }) => {
            setGameStatus('active');
            setMinutes(totalTime || 10);
            setSeconds(0);
            setTimeUp(false);
        });
        socket.on('update_dashboard', ({ players, lastViolation }) => {
            setPlayers(players);
            if (lastViolation) {
                let message = `${lastViolation.playerName} `;
                switch (lastViolation.type) {
                    case 'minimize_or_tab': message += "switched tabs!"; break;
                    case 'blur': message += "clicked away!"; break;
                    case 'resize': message += "resized window!"; break;
                    case 'fullscreen_exit': message += "exited fullscreen!"; break;
                    case 'fullscreen_denied': message += "denied fullscreen!"; break;
                    case 'webcam_denied': message += "denied webcam!"; break;
                    case 'not_fullscreen': message += "is not in fullscreen!"; break;
                    default: message += "left the quiz!";
                }
                const newNote = { id: Date.now() + Math.random(), message, type: lastViolation.type, time: new Date().toLocaleTimeString() };
                setNotifications(prev => [newNote, ...prev].slice(0, 5));
                setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== newNote.id)), 5000);
            }
        });
        socket.on('snapshot_captured', ({ playerName, timestamp, snapshotCount }) => {
            // Update player snapshot count in local state
            setPlayers(prev => prev.map(p =>
                p.name === playerName ? { ...p, snapshotCount } : p
            ));
        });
        return () => {
            socket.off('game_created'); socket.off('player_joined');
            socket.off('game_started'); socket.off('update_dashboard');
            socket.off('snapshot_captured');
        };
    }, [socket]);

    // ─── Quiz Actions ───
    const generateQuiz = async () => {
        if (!topic && !file) { alert("Provide a topic or upload a PDF."); return; }
        setIsGenerating(true);
        try {
            const formData = new FormData();
            formData.append('numQuestions', numQuestions);
            formData.append('timeLimit', timeLimit);
            if (topic) formData.append('topic', topic);
            if (file) formData.append('pdf', file);

            const res = await fetch(`${API_URL}/api/quizzes/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                // Navigate to quiz builder for review
                navigate(`/host/quiz-builder/${data._id}`);
            } else {
                alert(data.message || 'Generation failed');
            }
        } catch (err) {
            alert('Failed: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLaunch = async (q) => {
        setQuiz(q);
        setActiveTab('live');
        
        // Call API to create session in DB
        try {
            const res = await fetch(`${API_URL}/api/sessions/start`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizId: q._id })
            });
            const data = await res.json();
            
            // Pass the generated pin to the socket
            if (socket) socket.emit('create_game', { quizId: q._id, customPin: data.gamePin });
        } catch (e) {
            console.error('Failed to create session:', e);
            // Fallback to socket only if API fails
            if (socket) socket.emit('create_game', { quizId: q._id });
        }

        // Increment usage count
        fetch(`${API_URL}/api/quizzes/${q._id}`, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ usageCount: (q.usageCount || 0) + 1, isDraft: false }),
        }).catch(console.error);
    };

    const handleEdit = (q) => navigate(`/host/quiz-builder/${q._id}`);

    const handleDuplicate = async (q) => {
        try {
            const res = await fetch(`${API_URL}/api/quizzes/${q._id}/duplicate`, { method: 'POST', headers });
            if (res.ok) fetchQuizzes(1);
        } catch (err) { console.error(err); }
    };

    const [deleteModal, setDeleteModal] = useState(null);

    const handleDelete = (q) => {
        setDeleteModal(q);
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        try {
            const res = await fetch(`${API_URL}/api/quizzes/${deleteModal._id}`, { method: 'DELETE', headers });
            if (res.ok) {
                fetchQuizzes(1);
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to delete quiz');
            }
        } catch (err) { console.error(err); }
        setDeleteModal(null);
    };

    const handleTogglePublic = async (q) => {
        try {
            await fetch(`${API_URL}/api/quizzes/${q._id}`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: !q.isPublic }),
            });
            fetchQuizzes(1);
        } catch (err) { console.error(err); }
    };

    const handleSchedule = async (q) => setScheduleModal(q);

    const handleScheduleSubmit = async (dateString) => {
        if (!scheduleModal) return;
        try {
            await fetch(`${API_URL}/api/quizzes/${scheduleModal._id}/schedule`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduledAt: dateString }),
            });
            fetchQuizzes(1);
        } catch (err) { console.error(err); }
    };

    const startGame = () => { if (socket && pin) socket.emit('start_game', { pin }); };
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const handleLogout = () => { localStorage.removeItem('token'); navigate('/'); };

    const exportToExcel = () => {
        if (players.length === 0) return;
        // POST player data to server — server sends back the .xlsx with
        // Content-Disposition: attachment, which works in ALL browsers
        // including enterprise-managed Chrome where JS download tricks fail.
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `${API_URL}/api/quizzes/export-excel`;
        form.style.display = 'none';

        const addField = (name, value) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
        };

        addField('token', token);
        addField('players', JSON.stringify(sortedPlayers));
        addField('pin', pin || 'export');

        document.body.appendChild(form);
        form.submit();
        setTimeout(() => document.body.removeChild(form), 1000);
    };

    const handleEndSessionAPI = async () => {
        if (!pin) return;
        try {
            await fetch(`${API_URL}/api/sessions/${pin}/end`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ players: sortedPlayers })
            });
        } catch (err) {
            console.error('Failed to end session:', err);
        }
    };

    const confirmEndSession = async () => { 
        await handleEndSessionAPI();
        window.location.reload(); 
    };
    const exportAndEndSession = async () => { 
        exportToExcel(); 
        await handleEndSessionAPI();
        setTimeout(() => window.location.reload(), 500); 
    };

    // ─── Get violation breakdown for a player ───
    const getViolationTooltip = (player) => {
        if (!player.violationCount) return '';
        return `Violations: ${player.violationCount}`;
    };

    // ─── Filter chips ───
    const filterOptions = [
        { key: 'all', label: 'All' },
        { key: 'draft', label: 'Draft' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'public', label: 'Public' },
        { key: 'ai', label: 'AI-Generated' },
        { key: 'manual', label: 'Manual' },
    ];

    const tabs = [
        { key: 'library', label: 'My Quizzes', icon: 'library' },
        { key: 'create', label: 'Create / Build', icon: 'create' },
        { key: 'live', label: 'Live Session', icon: 'live' },
    ];

    const tabIcons = {
        library: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>,
        create: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>,
        live: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>,
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* ─── Header ─── */}
            <header className="border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent cursor-pointer" onClick={() => navigate('/')}>
                        Host Dashboard
                    </h1>
                    <div className="flex items-center gap-3">
                        {pin && (
                            <div className="px-5 py-2 bg-gradient-to-r from-primary to-secondary rounded-full font-mono text-lg font-bold shadow-lg animate-pulse-fast">
                                PIN: {pin}
                            </div>
                        )}
                        <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-surface border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* ─── Tabs ─── */}
            <div className="border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-3.5 text-sm font-bold transition-all relative whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'text-white'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                {tabIcons[tab.key]} {tab.label}
                            </span>
                            {activeTab === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary rounded-full" />
                            )}
                            {tab.key === 'live' && pin && (
                                <span className="ml-2 w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Tab Content ─── */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 sm:py-8">

                {/* ═══════ TAB 1: MY QUIZZES ═══════ */}
                {activeTab === 'library' && (
                    <div className="animate-fade-in">
                        {/* Search + Filters */}
                        <div className="mb-6 space-y-4">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search quizzes..."
                                className="input-glass max-w-md"
                            />
                            <div className="flex flex-wrap gap-2">
                                {filterOptions.map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setQuizFilter(f.key)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            quizFilter === f.key
                                                ? 'bg-primary text-white'
                                                : 'bg-surface text-gray-400 hover:bg-white/10 border border-white/10'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                                <div className="ml-auto">
                                    <select
                                        value={quizSort}
                                        onChange={(e) => setQuizSort(e.target.value)}
                                        className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-400 outline-none focus:border-primary"
                                    >
                                        <option value="recent">Recent</option>
                                        <option value="popular">Most Used</option>
                                        <option value="scheduled">Scheduled First</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Quiz Grid */}
                        {libraryLoading && quizzes.length === 0 ? (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="card-glass p-5 animate-pulse">
                                        <div className="h-3 w-1/2 bg-white/10 rounded mb-4" />
                                        <div className="h-5 w-3/4 bg-white/10 rounded mb-3" />
                                        <div className="h-2 w-1/3 bg-white rounded mb-6" />
                                        <div className="h-10 w-full bg-white rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        ) : quizzes.length > 0 ? (
                            <>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {quizzes.map(q => (
                                        <QuizCard
                                            key={q._id}
                                            quiz={q}
                                            onLaunch={handleLaunch}
                                            onEdit={handleEdit}
                                            onDuplicate={handleDuplicate}
                                            onDelete={handleDelete}
                                            onTogglePublic={handleTogglePublic}
                                            onSchedule={handleSchedule}
                                        />
                                    ))}
                                </div>
                                {quizzes.length < quizTotal && (
                                    <div className="mt-8 text-center">
                                        <button
                                            onClick={() => fetchQuizzes(quizPage + 1, true)}
                                            disabled={libraryLoading}
                                            className="px-8 py-3 rounded-xl bg-surface border border-white/10 hover:bg-white/10 transition-colors text-sm font-bold disabled:opacity-50"
                                        >
                                            {libraryLoading ? 'Loading...' : 'Load More'}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="card-glass p-16 text-center">
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center opacity-50">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                                </div>
                                <h3 className="text-2xl font-black mb-2">No quizzes yet</h3>
                                <p className="text-gray-400 mb-6">Create your first quiz to get started!</p>
                                <button onClick={() => setActiveTab('create')} className="btn-primary">
                                    Create Your First Quiz
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ TAB 2: CREATE / BUILD ═══════ */}
                {activeTab === 'create' && (
                    <div className="animate-fade-in flex-1 flex items-start justify-center pt-8">
                        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
                            {/* AI Generate Card */}
                            <div className="card-glass p-8 flex flex-col relative overflow-hidden group hover:border-primary/30 transition-all">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
                                <div className="relative z-10 flex flex-col flex-1">
                                    <div className="w-16 h-16 mb-6 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-black mb-2">Generate with AI</h3>
                                    <p className="text-gray-400 text-sm mb-6 flex-1">
                                        Paste a topic or upload a PDF. AI builds the quiz in seconds. You can review and edit before launching.
                                    </p>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg> PDF (Optional)</label>
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                                className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-surface file:text-white cursor-pointer border border-white/10 rounded-xl p-2"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg> Topic</label>
                                            <textarea
                                                value={topic}
                                                onChange={(e) => setTopic(e.target.value)}
                                                placeholder="e.g., French Revolution, 10th grade..."
                                                className="input-glass min-h-[80px] resize-none text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Questions</label>
                                                <input type="number" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} min="1" max="20" className="input-glass text-center text-lg font-black" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Minutes</label>
                                                <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} min="1" max="60" className="input-glass text-center text-lg font-black" />
                                            </div>
                                        </div>
                                        <button
                                            onClick={generateQuiz}
                                            disabled={isGenerating || (!topic && !file)}
                                            className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
                                        >
                                            {isGenerating ? (
                                                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
                                            ) : (
                                                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg> Generate Quiz</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Manual Build Card */}
                            <div className="card-glass p-8 flex flex-col relative overflow-hidden group hover:border-accent/30 transition-all">
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none" />
                                <div className="relative z-10 flex flex-col flex-1">
                                    <div className="w-16 h-16 mb-6 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                    </div>
                                    <h3 className="text-2xl font-black mb-2">Build Manually</h3>
                                    <p className="text-gray-400 text-sm mb-6 flex-1">
                                        Create questions one by one using the quiz builder editor. Full control over every question and answer option.
                                    </p>
                                    <button
                                        onClick={() => navigate('/host/quiz-builder')}
                                        className="w-full py-4 rounded-xl font-bold text-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-all hover:border-accent/50 flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg> Open Quiz Builder
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════ TAB 3: LIVE SESSION ═══════ */}
                {activeTab === 'live' && (
                    <div className="animate-fade-in">
                        {!pin ? (
                            <div className="card-glass p-16 text-center max-w-xl mx-auto">
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center opacity-50">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>
                                </div>
                                <h3 className="text-2xl font-black mb-2">No Active Session</h3>
                                <p className="text-gray-400 mb-6">Launch a quiz from your library or create a new one to start a live session.</p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button onClick={() => setActiveTab('library')} className="px-6 py-3 rounded-xl bg-surface border border-white/10 hover:bg-white/10 transition-colors font-medium flex items-center justify-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                                        Browse Library
                                    </button>
                                    <button onClick={() => setActiveTab('create')} className="btn-primary flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                                        Create Quiz
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-4 gap-6">
                                {/* Sidebar Controls */}
                                <div className="lg:col-span-1 space-y-4">
                                    <div className="card-glass p-5 text-center">
                                        <span className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Game Status</span>
                                        <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-sm font-bold bg-surface border border-white/10 ${
                                            gameStatus === 'active' ? 'text-green-400 border-green-500/50' : 'text-yellow-400 border-yellow-500/50'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${gameStatus === 'active' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                                            {gameStatus === 'lobby' ? 'Lobby Open' : 'Game Active'}
                                        </div>

                                        {gameStatus === 'active' && (
                                            <>
                                                <div className="mt-4 p-3 bg-surface rounded-xl border border-white/10">
                                                    <span className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Time Remaining</span>
                                                    <div className={`text-3xl font-black font-mono ${minutes < 1 ? 'text-red-400 animate-pulse' : 'text-primary'}`}>
                                                        {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                                                    </div>
                                                    {timeUp && <span className="block text-xs text-red-400 mt-1 font-bold">TIME'S UP!</span>}
                                                </div>
                                                <button className="mt-3 w-full px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-bold" onClick={() => setShowEndSessionModal(true)}>
                                                    End Session
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {gameStatus === 'lobby' && (
                                        <button onClick={startGame} disabled={players.length === 0} className="btn-primary w-full py-4 text-lg shadow-xl shadow-primary/20 disabled:opacity-40">
                                            Start Game
                                        </button>
                                    )}

                                    {players.length > 0 && (
                                        <>
                                            <button onClick={exportToExcel} className="w-full px-4 py-3 bg-green-500/20 text-green-400 border border-green-500/50 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> Export to Excel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    fetch(`${API_URL}/api/sessions/${pin}/report/pdf`, {
                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                    })
                                                    .then(res => {
                                                        if (!res.ok) throw new Error('Report not available');
                                                        return res.blob();
                                                    })
                                                    .then(blob => {
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `QuizMaster-Report-${pin || 'session'}-${new Date().toISOString().slice(0, 10)}.pdf`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        window.URL.revokeObjectURL(url);
                                                        document.body.removeChild(a);
                                                    })
                                                    .catch(err => {
                                                        console.error('PDF download error:', err);
                                                        alert('PDF report is not available for this session. End the session first to generate a report.');
                                                    });
                                                }}
                                                className="w-full px-4 py-3 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg> Download PDF Report
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Leaderboard */}
                                <div className="lg:col-span-3 card-glass p-6 min-h-[400px]">
                                    <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                                        <h2 className="text-2xl font-black">
                                            {gameStatus === 'lobby' ? 'Waiting for Players...' : 'Live Leaderboard'}
                                        </h2>
                                        <div className="text-right">
                                            <span className="block text-3xl font-black text-primary">{players.length}</span>
                                            <span className="text-xs uppercase tracking-widest text-gray-400">Players</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {sortedPlayers.map((p, i) => (
                                            <div
                                                key={p.id}
                                                className={`rounded-2xl p-4 flex items-center gap-3 border transition-all duration-300 animate-fade-in ${
                                                    p.violationCount > 0
                                                        ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                                        : 'bg-surface border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-lg ${
                                                    i === 0 ? 'bg-yellow-500 text-black' :
                                                    i === 1 ? 'bg-gray-300 text-black' :
                                                    i === 2 ? 'bg-orange-700 text-white' :
                                                    p.violationCount > 0 ? 'bg-red-500 text-white' :
                                                    'bg-white/10 text-gray-400'
                                                }`}>
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-base flex items-center gap-2">
                                                        <span className="truncate">{p.name}</span>
                                                        {p.violationCount > 0 && (
                                                            <span className="text-red-500 text-xs font-black animate-pulse flex items-center gap-1 shrink-0" title={getViolationTooltip(p)}>
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg> {p.violationCount}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <span className="text-primary font-mono">{p.score} marks {p.finished && <svg className="w-3.5 h-3.5 inline text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {players.length === 0 && (
                                            <div className="col-span-full py-16 text-center text-gray-500 italic">
                                                Share PIN <span className="text-primary font-bold">{pin}</span> with players to join
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ─── Notification Toasts ─── */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
                {notifications.map(note => (
                    <div key={note.id} className="bg-red-500 text-white px-5 py-3 rounded-2xl shadow-2xl animate-slide-in flex items-center gap-3 border border-red-400/50 backdrop-blur-md">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                        <div>
                            <p className="font-black text-xs uppercase tracking-tighter">Violation</p>
                            <p className="font-bold text-sm leading-tight">{note.message}</p>
                            <p className="text-white/60 text-[10px] font-mono mt-0.5">{note.time}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── End Session Modal ─── */}
            {showEndSessionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
                    <div className="card-glass p-8 max-w-md w-full mx-4 animate-fade-in">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                                <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                            </div>
                            <h2 className="text-2xl font-black mb-2">End Session?</h2>
                            <p className="text-gray-400 text-sm">Are you sure you want to end this quiz session?</p>
                        </div>
                        <div className="space-y-3">
                            {players.length > 0 && (
                                <button onClick={exportAndEndSession} className="w-full px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> Export Results & End
                                </button>
                            )}
                            <button onClick={confirmEndSession} className="w-full px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded-xl transition-colors font-bold">
                                End Without Export
                            </button>
                            <button onClick={() => setShowEndSessionModal(false)} className="w-full px-6 py-3 bg-surface hover:bg-white/10 rounded-xl transition-colors font-bold text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Schedule Modal ─── */}
            <ScheduleModal
                isOpen={!!scheduleModal}
                onClose={() => setScheduleModal(null)}
                currentDate={scheduleModal?.scheduledAt}
                onSchedule={handleScheduleSubmit}
            />

            {/* ─── Delete Confirmation Modal ─── */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
                    <div className="card-glass p-8 max-w-md w-full mx-4 animate-fade-in">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                            </div>
                            <h2 className="text-2xl font-black mb-2">Delete Quiz?</h2>
                            <p className="text-gray-400 text-sm">
                                Are you sure you want to delete <span className="text-white font-bold">"{deleteModal.title || 'Untitled Quiz'}"</span>? This action cannot be undone.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <button onClick={confirmDelete} className="w-full px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg> Yes, Delete Quiz
                            </button>
                            <button onClick={() => setDeleteModal(null)} className="w-full px-6 py-3 bg-surface hover:bg-white/10 rounded-xl transition-colors font-bold text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HostDashboard;
