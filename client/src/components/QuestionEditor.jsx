import React, { useState } from 'react';

const QuestionEditor = ({ question, onChange, onSuggestDistractors }) => {
    const [loadingDistractors, setLoadingDistractors] = useState(false);
    const [distractorSuggestions, setDistractorSuggestions] = useState([]);

    const updateField = (field, value) => {
        onChange({ ...question, [field]: value });
    };

    const updateOption = (index, value) => {
        const newOptions = [...question.options];
        newOptions[index] = value;
        onChange({ ...question, options: newOptions });
    };

    const setCorrectIndex = (index) => {
        onChange({ ...question, correctIndex: index });
    };

    const handleSuggestDistractors = async () => {
        if (!question.text?.trim() || question.correctIndex === null || question.correctIndex === undefined) {
            return;
        }
        const correctAnswer = question.options[question.correctIndex];
        if (!correctAnswer?.trim()) return;

        setLoadingDistractors(true);
        setDistractorSuggestions([]);
        try {
            const suggestions = await onSuggestDistractors(question.text, correctAnswer);
            setDistractorSuggestions(suggestions || []);
        } catch {
            setDistractorSuggestions([]);
        } finally {
            setLoadingDistractors(false);
        }
    };

    const applyDistractor = (suggestion) => {
        // Find first empty option slot (that isn't the correct answer)
        const newOptions = [...question.options];
        for (let i = 0; i < newOptions.length; i++) {
            if (i !== question.correctIndex && !newOptions[i]?.trim()) {
                newOptions[i] = suggestion;
                onChange({ ...question, options: newOptions });
                setDistractorSuggestions(prev => prev.filter(s => s !== suggestion));
                return;
            }
        }
        // If no empty slots, replace last non-correct empty-ish option
        for (let i = newOptions.length - 1; i >= 0; i--) {
            if (i !== question.correctIndex) {
                newOptions[i] = suggestion;
                onChange({ ...question, options: newOptions });
                setDistractorSuggestions(prev => prev.filter(s => s !== suggestion));
                return;
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Question Text */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" /></svg>
                    Question Text
                </label>
                <textarea
                    value={question.text || ''}
                    onChange={(e) => updateField('text', e.target.value)}
                    placeholder="Enter your question here..."
                    className="input-glass min-h-[100px] resize-none text-lg p-4 leading-relaxed"
                    style={{ height: 'auto', minHeight: '100px' }}
                    onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                />
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                    Answer Options
                    <span className="text-onSurfaceVariant normal-case font-normal ml-1">(select the correct answer)</span>
                </label>

                <div className="space-y-3">
                    {question.options.map((opt, i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                                question.correctIndex === i
                                    ? 'bg-primary/10 border-primary/50 shadow-lg shadow-accent/10'
                                    : 'bg-surface border-white/5 hover:border-white/5'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => setCorrectIndex(i)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                                    question.correctIndex === i
                                        ? 'bg-primary text-onSurface shadow-md'
                                        : 'bg-surface/10 text-onSurfaceVariant hover:bg-surface/20'
                                }`}
                            >
                                {String.fromCharCode(65 + i)}
                            </button>
                            <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(i, e.target.value)}
                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                className="flex-1 bg-transparent outline-none text-onSurface placeholder:text-gray-600"
                            />
                            {question.correctIndex === i && (
                                <span className="text-primary text-xs font-bold shrink-0 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                    Correct
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Distractor Suggestions */}
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={handleSuggestDistractors}
                    disabled={loadingDistractors || !question.text?.trim() || question.correctIndex === null}
                    className="text-sm text-primary hover:text-primary transition-colors font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {loadingDistractors ? (
                        <>
                            <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            Generating distractors...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
                            Suggest AI Distractors
                        </>
                    )}
                </button>

                {distractorSuggestions.length > 0 && (
                    <div className="bg-surface rounded-xl border border-white/5 p-4 space-y-2 animate-fade-in">
                        <p className="text-xs text-onSurfaceVariant font-bold uppercase tracking-wider">AI Suggestions — click to apply</p>
                        {distractorSuggestions.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => applyDistractor(s)}
                                className="block w-full text-left px-4 py-2 rounded-lg bg-surface hover:bg-primary/20 text-sm text-onSurfaceVariant hover:text-onSurface transition-all border border-transparent hover:border-primary/30"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionEditor;
