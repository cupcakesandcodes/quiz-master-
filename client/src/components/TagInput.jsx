import React, { useState } from 'react';

const TagInput = ({ tags = [], onChange, maxTags = 10 }) => {
    const [input, setInput] = useState('');

    const addTag = (tag) => {
        const trimmed = tag.trim().toLowerCase();
        if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
            onChange([...tags, trimmed]);
        }
        setInput('');
    };

    const removeTag = (index) => {
        onChange(tags.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2 input-glass p-2 min-h-[48px] cursor-text"
             onClick={() => document.getElementById('tag-input-field')?.focus()}>
            {tags.map((tag, i) => (
                <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium border border-primary/30 hover:border-primary/60 transition-colors"
                >
                    {tag}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                        className="ml-0.5 text-primary/60 hover:text-onSurface transition-colors text-xs font-bold"
                    >
                        ✕
                    </button>
                </span>
            ))}
            <input
                id="tag-input-field"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => input && addTag(input)}
                placeholder={tags.length === 0 ? "Add tags (press Enter)..." : ""}
                className="bg-transparent outline-none text-onSurface text-sm flex-1 min-w-[120px] placeholder:text-onSurfaceVariant"
            />
        </div>
    );
};

export default TagInput;
