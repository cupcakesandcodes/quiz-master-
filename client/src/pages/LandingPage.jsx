import React from 'react';
import { Link } from 'react-router-dom';
import DotGrid from '../components/DotGrid';

const LandingPage = () => {
    return (
        <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 selection:bg-primary/30">
            {/* Ambient Background Blobs */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] animate-pulse-slow pointer-events-none"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px] animate-pulse-slow delay-1000 pointer-events-none"></div>

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 -z-10 bg-background overflow-hidden inline">
                <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                    <DotGrid
                        dotSize={4}
                        gap={42}
                        baseColor="#197b67"
                        activeColor="#ededed"
                        proximity={220}
                        speedTrigger={100}
                        shockRadius={250}
                        shockStrength={5}
                        maxSpeed={5000}
                        resistance={750}
                        returnDuration={1.5}
                    />
                </div>
            </div>

            <div className="text-center mb-12 relative z-10 animate-fade-in md:mb-24">
                <div className="inline-block px-4 py-1.5 mb-6 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs sm:text-sm font-medium text-gray-300 animate-slide-down">
                    Intelligent Quiz Generation & Proctoring
                </div>
                <h1 className="text-5xl sm:text-7xl md:text-9xl font-black mb-6 md:mb-8 leading-[1.1] tracking-tighter drop-shadow-2xl">
                    Quiz
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-cyan-400 to-secondary animate-gradient-x bg-[length:200%_auto]">
                        Master
                    </span>
                    <span className="text-primary">.</span>AI
                </h1>
                <p className="text-lg md:text-2xl text-gray-400 max-w-3xl mx-auto font-light leading-relaxed px-4">
                    Transform any PDF or topic into an interactive battle of wits. <br className="hidden md:block" />
                    Powered by advanced AI for instant, unlimited learning.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 md:gap-12 w-full max-w-5xl px-4 relative z-10">
                <Link to="/player" className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-cyan-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="card-glass h-full flex flex-col items-center text-center p-6 sm:p-10 hover:translate-y-[-5px] transition-transform duration-300 border-white/10 group-hover:border-sky-500/30 bg-black/40">
                        <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-sky-500/30">
                            <svg className="w-9 h-9 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg>
                        </div>
                        <h2 className="text-4xl font-black mb-3 text-white group-hover:text-sky-400 transition-colors">I'm a Student</h2>
                        <p className="text-gray-400 mb-8 text-lg">Join a live session, compete with friends, and track your progress.</p>
                        <button className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 font-bold text-lg shadow-lg shadow-sky-500/25 group-hover:shadow-sky-500/40 transition-all">
                            Join with PIN
                        </button>
                    </div>
                </Link>

                <Link to={localStorage.getItem('token') ? '/host' : '/host/login'} className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-teal-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="card-glass h-full flex flex-col items-center text-center p-6 sm:p-10 hover:translate-y-[-5px] transition-transform duration-300 border-white/10 group-hover:border-primary/30 bg-black/40">
                        <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-primary/30">
                            <svg className="w-9 h-9 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>
                        </div>
                        <h2 className="text-4xl font-black mb-3 text-white group-hover:text-primary transition-colors">I'm a Host</h2>
                        <p className="text-gray-400 mb-8 text-lg">Create unlimited quizzes from PDFs or topics and host live games.</p>
                        <button className="w-full py-4 rounded-xl font-bold text-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-all group-hover:border-primary/50">
                            Launch Dashboard
                        </button>
                    </div>
                </Link>
            </div>


        </div>
    );
};

export default LandingPage;
