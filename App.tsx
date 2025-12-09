import React, { useState } from 'react';
import ExperimentalApp from './ExperimentalApp';
import './index.css';

const ICON_PNG = '/visus/icon.png';

interface LandingProps {
    onInitialize: () => void;
}

const LandingScreen: React.FC<LandingProps> = ({ onInitialize }) => (
    <div className="flex items-center justify-center h-screen w-screen bg-slate-950 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black"></div>
        <div className="text-center p-12 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl max-w-lg relative z-10 animate-in fade-in duration-700 mx-4 flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"></div>
            <div className="mb-8 relative group w-40 h-40 flex items-center justify-center bg-black rounded-full border-4 border-white/10 shadow-[0_0_50px_rgba(167,139,250,0.3)] hover:scale-105 transition-transform duration-500 overflow-hidden">
                <div className="absolute inset-0 bg-accent rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>
                <img src={ICON_PNG} alt="VISUS Logo" className="w-full h-full object-cover p-2" />
            </div>
            <h1 className="text-6xl md:text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tighter">VISUS</h1>
            <div className="flex gap-3 flex-col sm:flex-row">
                <button
                    className="group relative px-16 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300 tracking-widest text-sm overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                    onClick={() => { console.log('[VISUS] INITIALIZE click'); onInitialize(); }}
                >
                    <span className="relative z-10">INITIALIZE</span>
                </button>
            </div>
            <div className="mt-6 text-[11px] text-slate-400">
                WebGL + Audio startują dopiero po kliknięciu INITIALIZE.
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
    const [isSystemActive, setIsSystemActive] = useState(false);

    if (isSystemActive) {
        return <ExperimentalApp onExit={() => setIsSystemActive(false)} />;
    }

    return <LandingScreen onInitialize={() => setIsSystemActive(true)} />;
};

export default App;
