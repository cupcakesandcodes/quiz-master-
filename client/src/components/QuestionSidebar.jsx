import React from 'react';

const QuestionSidebar = ({ questions, selectedIndex, onSelect, onAdd, onDelete, onReorder }) => {
    const handleDragStart = (e, index) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (dragIndex !== dropIndex) {
            onReorder(dragIndex, dropIndex);
        }
    };

    const isComplete = (q) => {
        return q.text?.trim() &&
            q.options?.every(opt => opt?.trim()) &&
            q.correctIndex !== null &&
            q.correctIndex !== undefined;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-bold text-onSurfaceVariant uppercase tracking-widest">Questions</h3>
                <span className="text-xs text-onSurfaceVariant font-mono">{questions.length}/20</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {questions.map((q, i) => (
                    <div
                        key={q.id || i}
                        draggable
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, i)}
                        onClick={() => onSelect(i)}
                        className={`group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                            selectedIndex === i
                                ? 'bg-primary/20 border-primary/50 shadow-lg shadow-primary/10'
                                : 'bg-surface border-white/5 hover:bg-surfaceContainerLow hover:border-white/5'
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            {/* Status dot */}
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                isComplete(q) ? 'bg-green-400' : 'bg-yellow-400'
                            }`} />

                            {/* Question preview */}
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-onSurfaceVariant">Q{i + 1}</span>
                                <p className="text-sm text-onSurface truncate mt-0.5">
                                    {q.text?.trim() || 'Untitled question...'}
                                </p>
                            </div>

                            {/* Delete button */}
                            {questions.length > 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-onSurfaceVariant hover:text-red-400 p-1 shrink-0"
                                    title="Delete question"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                </button>
                            )}
                        </div>

                        {/* Drag handle visual */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover:opacity-50 transition-opacity text-onSurfaceVariant text-[10px]">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 6 10"><circle cx="1" cy="1" r="1"/><circle cx="5" cy="1" r="1"/><circle cx="1" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="1" cy="9" r="1"/><circle cx="5" cy="9" r="1"/></svg>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onAdd}
                disabled={questions.length >= 20}
                className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-white/5 hover:border-primary/50 text-onSurfaceVariant hover:text-primary transition-all text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <span className="text-lg">+</span> Add Question
            </button>
        </div>
    );
};

export default QuestionSidebar;
