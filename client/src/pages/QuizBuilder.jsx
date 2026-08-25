import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuestionSidebar from '../components/QuestionSidebar';
import QuestionEditor from '../components/QuestionEditor';
import TagInput from '../components/TagInput';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

function createBlankQuestion() {
    return {
        id: crypto.randomUUID(),
        text: '',
        options: ['', '', '', ''],
        correctIndex: null,
        timeLimit: 20,
    };
}

const QuizBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    // Quiz meta
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');
    const [tags, setTags] = useState([]);
    const [totalTime, setTotalTime] = useState(10);
    const [isPublic, setIsPublic] = useState(false);
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('manual');

    // Questions
    const [questions, setQuestions] = useState([createBlankQuestion()]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // UI state
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showMetaPanel, setShowMetaPanel] = useState(true);
    const [showAIModal, setShowAIModal] = useState(false);
    const [toast, setToast] = useState(null);

    // AI Import state
    const [aiTopic, setAiTopic] = useState('');
    const [aiFile, setAiFile] = useState(null);
    const [aiNumQuestions, setAiNumQuestions] = useState(5);
    const [aiTimeLimit, setAiTimeLimit] = useState(10);
    const [aiLoading, setAiLoading] = useState(false);

    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    const showToast = (message, type = 'info') => {
        setToast({ message, type, id: Date.now() });
        setTimeout(() => setToast(null), 4000);
    };

    // Load existing quiz in edit mode
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`${API_URL}/api/quizzes/${id}`, { headers })
            .then(r => {
                if (r.status === 401) {
                    localStorage.removeItem('token');
                    navigate('/host/login');
                    throw new Error('Session expired');
                }
                if (!r.ok) throw new Error('Failed to load quiz');
                return r.json();
            })
            .then(quiz => {
                setTitle(quiz.title || '');
                setTopic(quiz.topic || '');
                setTags(quiz.tags || []);
                setTotalTime(quiz.totalTime || 10);
                setIsPublic(quiz.isPublic || false);
                setDescription(quiz.description || '');
                setSource(quiz.source || 'manual');
                setQuestions(quiz.questions.map(q => ({
                    id: q._id || crypto.randomUUID(),
                    text: q.text || '',
                    options: q.options || ['', '', '', ''],
                    correctIndex: q.correctIndex ?? null,
                    timeLimit: q.timeLimit || 20,
                })));
                setSelectedIndex(0);
            })
            .catch(err => showToast(err.message, 'error'))
            .finally(() => setLoading(false));
    }, [id]);

    // Question operations
    const addQuestion = () => {
        if (questions.length >= 20) return;
        const newQ = createBlankQuestion();
        setQuestions(prev => [...prev, newQ]);
        setSelectedIndex(questions.length);
    };

    const deleteQuestion = (index) => {
        if (questions.length <= 1) return;
        setQuestions(prev => prev.filter((_, i) => i !== index));
        setSelectedIndex(prev => Math.min(prev, questions.length - 2));
    };

    const reorderQuestions = (from, to) => {
        setQuestions(prev => {
            const arr = [...prev];
            const [item] = arr.splice(from, 1);
            arr.splice(to, 0, item);
            return arr;
        });
        setSelectedIndex(to);
    };

    const updateQuestion = (updated) => {
        setQuestions(prev => prev.map((q, i) => i === selectedIndex ? updated : q));
    };

    // Save
    const saveQuiz = async (asDraft = true) => {
        if (!title.trim()) {
            showToast('Please enter a quiz title', 'error');
            return null;
        }
        if (questions.length === 0) {
            showToast('Add at least one question', 'error');
            return null;
        }

        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                topic: topic.trim(),
                questions: questions.map(q => ({
                    text: q.text,
                    options: q.options,
                    correctIndex: q.correctIndex,
                    timeLimit: q.timeLimit,
                })),
                totalTime,
                tags,
                isPublic,
                isDraft: asDraft,
                description,
                source,
            };

            const url = isEditMode ? `${API_URL}/api/quizzes/${id}` : `${API_URL}/api/quizzes`;
            const method = isEditMode ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to save quiz');
            }

            const saved = await res.json();
            showToast(asDraft ? 'Draft saved!' : 'Quiz saved!', 'success');
            return saved;
        } catch (err) {
            showToast(err.message, 'error');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        const saved = await saveQuiz(true);
        if (saved && !isEditMode) {
            navigate(`/host/quiz-builder/${saved._id}`, { replace: true });
        }
    };

    const handleSaveAndLaunch = async () => {
        const saved = await saveQuiz(false);
        if (saved) {
            navigate('/host', { state: { launchQuizId: saved._id } });
        }
    };

    // AI Distractor suggestion
    const handleSuggestDistractors = async (questionText, correctAnswer) => {
        const res = await fetch(`${API_URL}/api/quizzes/suggest-distractors`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionText, correctAnswer }),
        });
        if (!res.ok) throw new Error('Failed to get suggestions');
        const data = await res.json();
        return data.suggestions || [];
    };

    // AI Import
    const handleAIImport = async () => {
        if (!aiTopic && !aiFile) {
            showToast('Provide a topic or upload a PDF', 'error');
            return;
        }
        setAiLoading(true);
        try {
            const formData = new FormData();
            formData.append('numQuestions', aiNumQuestions);
            formData.append('timeLimit', aiTimeLimit);
            if (aiTopic) formData.append('topic', aiTopic);
            if (aiFile) formData.append('pdf', aiFile);

            const res = await fetch(`${API_URL}/api/quizzes/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(`${err.message}: ${err.error || 'Unknown API error'}`);
            }
            const quiz = await res.json();

            // Load into builder
            setTitle(quiz.title || '');
            setTopic(quiz.topic || aiTopic || '');
            setQuestions(quiz.questions.map(q => ({
                id: crypto.randomUUID(),
                text: q.text || '',
                options: q.options || ['', '', '', ''],
                correctIndex: q.correctIndex ?? null,
                timeLimit: q.timeLimit || 20,
            })));
            setSource('ai-edited');
            setSelectedIndex(0);
            setShowAIModal(false);
            showToast(`Generated ${quiz.questions.length} questions! Review and edit below.`, 'success');

            // Navigate to edit mode for the saved quiz
            if (quiz._id) {
                navigate(`/host/quiz-builder/${quiz._id}`, { replace: true });
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setAiLoading(false);
        }
    };

    const currentQuestion = questions[selectedIndex] || questions[0];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center animate-fade-in">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                    <p className="text-onSurfaceVariant">Loading quiz...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* ─── Header ─── */}
            <header className="border-b border-white/5 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/host')} className="text-onSurfaceVariant hover:text-onSurface transition-colors text-sm flex items-center gap-1">
                            <span>←</span> Back
                        </button>
                        <h1 className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                            Quiz Builder
                        </h1>
                        <span className="hidden sm:inline text-xs text-onSurfaceVariant bg-surface px-3 py-1 rounded-full font-mono">
                            {questions.length}/20 questions
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAIModal(true)}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-white/5 hover:bg-surfaceContainerLow transition-colors text-sm font-medium"
                        >
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                            Import from AI
                        </button>
                        <button
                            onClick={handleSaveDraft}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl bg-surface border border-white/5 hover:bg-surfaceContainerLow transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {saving ? '...' : 'Save Draft'}
                        </button>
                        <button
                            onClick={handleSaveAndLaunch}
                            disabled={saving}
                            className="btn-primary text-sm shadow-lg shadow-primary/20"
                        >
                            {saving ? '...' : 'Save & Launch'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ─── Meta Panel (collapsible) ─── */}
            <div className="border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <button
                        onClick={() => setShowMetaPanel(!showMetaPanel)}
                        className="py-3 w-full text-left text-xs font-bold text-onSurfaceVariant uppercase tracking-widest flex items-center gap-2 hover:text-onSurface transition-colors"
                    >
                        <span className={`transition-transform ${showMetaPanel ? 'rotate-90' : ''}`}>▶</span>
                        Quiz Settings
                    </button>
                    {showMetaPanel && (
                        <div className="pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-wider">Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Quiz title..."
                                    className="input-glass"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-wider">Tags</label>
                                <TagInput tags={tags} onChange={setTags} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-wider">Time Limit (min)</label>
                                <input
                                    type="number"
                                    value={totalTime}
                                    onChange={(e) => setTotalTime(parseInt(e.target.value) || 10)}
                                    min="1" max="60"
                                    className="input-glass"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-wider">Visibility</label>
                                <label className="flex items-center gap-3 input-glass cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPublic}
                                        onChange={(e) => setIsPublic(e.target.checked)}
                                        className="w-4 h-4 accent-primary"
                                    />
                                    <span className="text-sm text-onSurfaceVariant">Make Public</span>
                                </label>
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                                <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-wider">Description (optional)</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of this quiz..."
                                    className="input-glass"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Main Editor Area ─── */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
                <div className="flex gap-6 h-full min-h-[500px]">
                    {/* Question Sidebar */}
                    <div className="w-64 shrink-0 hidden md:block">
                        <QuestionSidebar
                            questions={questions}
                            selectedIndex={selectedIndex}
                            onSelect={setSelectedIndex}
                            onAdd={addQuestion}
                            onDelete={deleteQuestion}
                            onReorder={reorderQuestions}
                        />
                    </div>

                    {/* Mobile question nav */}
                    <div className="md:hidden mb-4 flex items-center gap-2 overflow-x-auto pb-2">
                        {questions.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedIndex(i)}
                                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                                    selectedIndex === i
                                        ? 'bg-primary text-onSurface'
                                        : 'bg-surface text-onSurfaceVariant border border-white/5'
                                }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={addQuestion}
                            disabled={questions.length >= 20}
                            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg bg-surface text-onSurfaceVariant border border-dashed border-white/5 disabled:opacity-30"
                        >
                            +
                        </button>
                    </div>

                    {/* Editor Pane */}
                    <div className="flex-1 card-glass p-6 sm:p-8 overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-onSurfaceVariant">
                                Question {selectedIndex + 1}
                            </h2>
                        </div>
                        <QuestionEditor
                            question={currentQuestion}
                            onChange={updateQuestion}
                            onSuggestDistractors={handleSuggestDistractors}
                        />
                    </div>
                </div>
            </div>

            {/* ─── AI Import Modal ─── */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-surfaceContainerLow backdrop-blur-sm animate-fade-in" onClick={() => setShowAIModal(false)}>
                    <div className="card-glass p-8 max-w-lg w-full mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                            </div>
                            <h2 className="text-2xl font-black">Import from AI</h2>
                            <p className="text-onSurfaceVariant text-sm mt-1">Generate questions, then review & edit in the builder</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                                    PDF (Optional)
                                </label>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-onSurfaceVariant file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-surface file:text-onSurface cursor-pointer border border-white/5 rounded-xl p-2"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
                                    Topic / Instructions
                                </label>
                                <textarea
                                    value={aiTopic}
                                    onChange={(e) => setAiTopic(e.target.value)}
                                    placeholder="e.g., The French Revolution, 10th grade..."
                                    className="input-glass min-h-[80px] resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-widest">Questions</label>
                                    <input type="number" value={aiNumQuestions} onChange={(e) => setAiNumQuestions(e.target.value)} min="1" max="20" className="input-glass text-center text-xl font-black" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-onSurfaceVariant uppercase tracking-widest">Duration (min)</label>
                                    <input type="number" value={aiTimeLimit} onChange={(e) => setAiTimeLimit(e.target.value)} min="1" max="60" className="input-glass text-center text-xl font-black" />
                                </div>
                            </div>
                            <button
                                onClick={handleAIImport}
                                disabled={aiLoading || (!aiTopic && !aiFile)}
                                className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
                            >
                                {aiLoading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/5 border-t-white rounded-full animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                                        Generate & Import
                                    </>
                                )}
                            </button>
                            <button onClick={() => setShowAIModal(false)} className="w-full text-center text-sm text-onSurfaceVariant hover:text-onSurface transition-colors py-2">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold animate-slide-in flex items-center gap-2 ${
                    toast.type === 'error' ? 'bg-red-500 text-onSurface' :
                    toast.type === 'success' ? 'bg-primary text-onSurface' :
                    'bg-surface/10 text-onSurface border border-white/5 backdrop-blur-md'
                }`}>
                    {toast.type === 'error' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    ) : toast.type === 'success' ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                    )}
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default QuizBuilder;
