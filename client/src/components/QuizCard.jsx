import React from 'react';

const QuizCard = ({ quiz, onLaunch, onEdit, onDuplicate, onDelete, onTogglePublic, onSchedule }) => {
    const sourceLabels = {
        'ai': { label: 'AI' },
        'manual': { label: 'Manual' },
        'ai-edited': { label: 'Edited' },
    };

    const source = sourceLabels[quiz.source] || sourceLabels['ai'];
    const [showMenu, setShowMenu] = React.useState(false);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatScheduled = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    return (
        <div className="card-glass p-5 flex flex-col justify-between group hover:border-white/5 transition-all duration-300 relative">
            {/* Top Meta Row */}
            <div>
                <div className="flex items-center gap-2 text-xs text-onSurfaceVariant mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-white/5 font-medium">
                        {source.label}
                    </span>
                    <span>•</span>
                    <span>{quiz.questionCount || 0} questions</span>
                    <span>•</span>
                    <span>{quiz.totalTime || 10} min</span>
                    {quiz.isDraft && (
                        <>
                            <span>•</span>
                            <span className="text-yellow-400 font-bold">Draft</span>
                        </>
                    )}
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-onSurface mb-1.5 line-clamp-2 leading-snug">
                    {quiz.title || 'Untitled Quiz'}
                </h3>

                {/* Tags */}
                {quiz.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {quiz.tags.slice(0, 4).map((tag, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 font-medium">
                                {tag}
                            </span>
                        ))}
                        {quiz.tags.length > 4 && (
                            <span className="text-xs text-onSurfaceVariant">+{quiz.tags.length - 4}</span>
                        )}
                    </div>
                )}

                {/* Usage / Schedule Info */}
                <div className="text-xs text-onSurfaceVariant mb-4">
                    {quiz.scheduledAt ? (
                        <span className="text-sky-400 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                            Scheduled: {formatScheduled(quiz.scheduledAt)}
                        </span>
                    ) : (
                        <span>Used {quiz.usageCount || 0} times • Created {formatDate(quiz.createdAt)}</span>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 relative">
                <button
                    onClick={() => onLaunch(quiz)}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary font-bold text-sm hover:scale-[1.02] transition-transform shadow-md"
                >
                    Launch
                </button>
                <button
                    onClick={() => onEdit(quiz)}
                    className="px-4 py-2.5 rounded-xl bg-surface border border-white/5 hover:bg-surfaceContainerLow transition-colors text-sm font-medium"
                >
                    Edit
                </button>
                <button
                    onClick={() => onDuplicate(quiz)}
                    className="px-4 py-2.5 rounded-xl bg-surface border border-white/5 hover:bg-surfaceContainerLow transition-colors text-sm font-medium"
                    title="Duplicate"
                >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                </button>

                {/* More Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="px-3 py-2.5 rounded-xl bg-surface border border-white/5 hover:bg-surfaceContainerLow transition-colors text-sm"
                    >
                        ⋮
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 bg-surface border border-white/5 rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                            <button
                                onClick={() => { onDelete(quiz); setShowMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                Delete
                            </button>
                            <button
                                onClick={() => { onTogglePublic(quiz); setShowMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-onSurfaceVariant hover:bg-surface transition-colors flex items-center gap-2"
                            >
                                {quiz.isPublic ? (
                                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg> Make Private</>
                                ) : (
                                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg> Make Public</>
                                )}
                            </button>
                            <button
                                onClick={() => { onSchedule(quiz); setShowMenu(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-onSurfaceVariant hover:bg-surface transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                                Schedule
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Click-away to close menu */}
            {showMenu && (
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            )}
        </div>
    );
};

export default QuizCard;
