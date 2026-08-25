import React, { useState } from 'react';

const ScheduleModal = ({ isOpen, onClose, currentDate, onSchedule }) => {
    const [date, setDate] = useState(currentDate ? new Date(currentDate).toISOString().slice(0, 16) : '');

    if (!isOpen) return null;

    const handleSchedule = () => {
        onSchedule(date ? new Date(date).toISOString() : null);
        onClose();
    };

    const handleClear = () => {
        onSchedule(null);
        onClose();
    };

    const minDate = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16); // 5 min from now

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surfaceContainerLow backdrop-blur-sm animate-fade-in"
             onClick={onClose}>
            <div className="card-glass p-8 max-w-md w-full mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="text-center mb-6">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                    </div>
                    <h2 className="text-2xl font-black mb-2">Schedule Quiz</h2>
                    <p className="text-onSurfaceVariant text-sm">Set a date and time for this quiz to go live.</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-primary uppercase tracking-widest">Date & Time</label>
                        <input
                            type="datetime-local"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            min={minDate}
                            className="input-glass text-lg"
                        />
                    </div>

                    <button
                        onClick={handleSchedule}
                        disabled={!date}
                        className="btn-primary w-full py-3 disabled:opacity-40"
                    >
                        {date ? 'Set Schedule' : 'Select a date first'}
                    </button>

                    {currentDate && (
                        <button
                            onClick={handleClear}
                            className="w-full py-3 rounded-xl text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors font-bold text-sm"
                        >
                            Remove Schedule
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3 text-onSurfaceVariant hover:text-onSurface transition-colors text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScheduleModal;
