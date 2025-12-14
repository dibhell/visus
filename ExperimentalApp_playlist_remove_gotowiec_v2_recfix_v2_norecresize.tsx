import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FastGLService, ExperimentalFxPacket } from './services/fastGlService';
import { ExperimentalAudioEngine } from './services/experimentalAudioService';
import { AudioEngine } from './services/audioService';
import { FxState, SyncParam, AspectRatioMode, TransformConfig, SHADER_LIST, QualityMode, QUALITY_SCALE, FallbackReason, AdditiveEnvConfig, DEFAULT_ADDITIVE_ENV_CONFIG } from './constants';
import { RecordingPreset, RecordingAudioPreset, RECORDING_AUDIO_PRESETS, RECORDING_VIDEO_PRESETS, DEFAULT_RECORDING_AUDIO_PRESET_ID, DEFAULT_RECORDING_VIDEO_PRESET_ID } from './constants/recordingPresets';
import RenderWorker from './services/renderWorker?worker';
import FxSlot from './components/FxSlot';
import BandControls from './components/BandControls';
import SpectrumVisualizer from './components/SpectrumVisualizer';
import MusicCatalog from './components/MusicCatalog';
import Knob from './components/Knob';
import MixerChannel from './components/MixerChannel';
import packageJson from './package.json';

const ICON_PNG = '/visus/icon.png';
const APP_VERSION = packageJson.version;

const ICONS = {
    Video: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>,
    Music: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>,
    Mic: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
    Camera: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
    Folder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
    Globe: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
    Mirror: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7"></path><path d="M14 2L22 12L14 22"></path></svg>,
    Settings: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
};

const getFxPreference = (): 'auto' | 'forceOn' | 'forceOff' => {
    if (typeof window === 'undefined') return 'auto';
    const params = new URLSearchParams(window.location.search);
    const fxParam = params.get('fx');
    const ls = localStorage.getItem('visus_fx');
    if (fxParam === '1' || ls === 'on') return 'forceOn';
    if (fxParam === '0' || ls === 'off') return 'forceOff';
    return 'auto';
};

const getRenderPreference = (): 'auto' | 'webgl' | 'canvas' => {
    if (typeof window === 'undefined') return 'auto';
    const params = new URLSearchParams(window.location.search);
    const render = params.get('render') || localStorage.getItem('visus_render') || 'auto';
    if (render === 'webgl') return 'webgl';
    if (render === 'canvas') return 'canvas';
    return 'auto';
};

const getWorkerPreference = (): boolean => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get('worker');
    const ls = localStorage.getItem('visus_worker');
    if (workerParam === '0' || workerParam === 'false' || ls === 'off') return false;
    return true;
};

const getUseWorkletFFT = (): boolean => {
    if (typeof window === 'undefined') return true;
    const ls = localStorage.getItem('visus_worklet_fft');
    return ls === '0' || ls === 'off' ? false : true;
};

const getUseVideoFrameCallback = (): boolean => {
    if (typeof window === 'undefined') return true;
    const ls = localStorage.getItem('visus_vfc');
    return ls === '0' || ls === 'off' ? false : true;
};

const getDebugInitMode = (): 'none' | 'mock' | 'layout' => {
    if (typeof window === 'undefined') return 'none';
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('debug_init') || localStorage.getItem('visus_debug_init') || 'none';
    return mode === 'mock' || mode === 'layout' ? (mode as 'mock' | 'layout') : 'none';
};

const getDebugFlag = (name: string): boolean => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get(name) === '1' || params.get(name) === 'true') return true;
    const ls = localStorage.getItem(`visus_${name}`);
    return ls === '1' || ls === 'true';
};

type PerformanceMode = 'high' | 'medium' | 'low';

const getPerformanceMode = (): PerformanceMode => {
    if (typeof window === 'undefined') return 'high';
    const ls = localStorage.getItem('visus_perf_mode') as PerformanceMode | null;
    if (ls === 'medium' || ls === 'low') return ls;
    return 'high';
};

const getFrameCapMode = (): 'dynamic' | 'manual' => {
    if (typeof window === 'undefined') return 'dynamic';
    const ls = localStorage.getItem('visus_framecap_mode');
    return ls === 'manual' ? 'manual' : 'dynamic';
};

const getFrameCapValue = (): number => {
    if (typeof window === 'undefined') return 60;
    const ls = parseInt(localStorage.getItem('visus_framecap') || '', 10);
    return Number.isFinite(ls) ? ls : 60;
};

const getUiFpsLimit = (): number => {
    if (typeof window === 'undefined') return 20;
    const ls = parseInt(localStorage.getItem('visus_ui_fps') || '', 10);
    if (ls === 15 || ls === 20 || ls === 30) return ls;
    return 20;
};

const getLockResolution = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('visus_lock_res') === '1';
};

const isDevMode = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1' || localStorage.getItem('visus_dev') === '1';
};

const detectWebGLSupport = () => {
    const result = { webgl2: false, webgl: false };
    try {
        const probeCanvas = document.createElement('canvas');
        const gl2 = probeCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
        const gl1 = probeCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || probeCanvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false } as any);
        result.webgl2 = !!gl2;
        result.webgl = !!gl1 || !!gl2;
    } catch (err) {
        console.error('[VISUS] WebGL probe exception:', err);
    }
    console.info('[VISUS] WebGL probe webgl2:', result.webgl2, 'webgl:', result.webgl);
    return result;
};

type RenderMode = 'webgl-worker' | 'webgl-fastgl' | 'canvas2d';

interface ExperimentalProps {
    onExit: () => void;
    bootRequested?: boolean;
}

const Credits: React.FC = () => (
    <div className="fixed bottom-3 left-4 z-[120] text-[10px] text-slate-200 bg-black/70 border border-white/10 px-4 py-2 rounded-full backdrop-blur pointer-events-none flex items-center gap-2">
        <span className="opacity-90">Studio Popech (c) 2025 * Pan Grzyb *</span>
        <a className="underline pointer-events-auto" href="mailto:ptr@o2.pl">ptr@o2.pl</a>
        <span className="opacity-90">* v{APP_VERSION}</span>
    </div>
);

const InitOverlay: React.FC<{ onInitialize: () => void }> = ({ onInitialize }) => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black"></div>
        <div className="text-center p-12 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl max-w-lg relative z-10 animate-in fade-in duration-700 mx-4 flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"></div>
            <div className="mb-8 relative group w-40 h-40 flex items-center justify-center bg-black rounded-full border-4 border-white/10 shadow-[0_0_50px_rgba(167,139,250,0.3)] hover:scale-105 transition-transform duration-500 overflow-hidden">
                <div className="absolute inset-0 bg-accent rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>
                <img src={ICON_PNG} alt="VISUS Logo" className="w-full h-full object-cover p-2" />
            </div>
            <h1 className="text-6xl md:text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tighter">VISUS</h1>
            <button
                type="button"
                className="group relative px-16 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300 tracking-widest text-sm overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                onClick={onInitialize}
            >
                <span className="relative z-10">INITIALIZE</span>
            </button>
            <div className="mt-6 text-[11px] text-slate-600 text-center max-w-sm">
                Click INITIALIZE to start WebGL + Audio (requires a user gesture).
            </div>
        </div>
    </div>
);

const PerformanceHUD: React.FC<{
    fps: number;
    dt: number;
    renderScale: number;
    frameCap: number;
    frameCapMode: 'dynamic' | 'manual';
    renderMode: RenderMode;
    performanceMode: PerformanceMode;
    micActive: boolean;
    isRecording: boolean;
}> = memo(({ fps, dt, renderScale, frameCap, frameCapMode, renderMode, performanceMode, micActive, isRecording }) => (
    <div className="fixed top-4 right-4 z-50 font-mono text-[10px] text-slate-200 flex gap-3 bg-black/70 p-2 rounded-full backdrop-blur-xl border border-white/5 px-5 shadow-2xl pointer-events-none">
        <span className={fps < 55 ? 'text-red-400' : 'text-accent'}>FPS: {fps}</span>
        <span className="hidden md:inline">dt: {dt.toFixed(1)}ms</span>
        <span className="hidden md:inline">Scale: {Math.round(renderScale * 100)}%</span>
        <span className="hidden md:inline">Cap: {frameCapMode === 'dynamic' ? `${frameCap} auto` : frameCap}</span>
        <span className="hidden md:inline">Mode: {renderMode}</span>
        <span className="hidden md:inline">Perf: {performanceMode}</span>
        {micActive && <span className="text-red-400 font-black tracking-widest">MIC</span>}
        {isRecording && <span className="text-red-400 font-black tracking-widest">REC</span>}
    </div>
));

const ExperimentalAppMock: React.FC<ExperimentalProps> = ({ onExit }) => (
    <div className="w-full h-screen flex items-center justify-center bg-slate-900 text-slate-100 flex-col gap-4">
        <div className="text-3xl font-black">VISUS STUDIO MOCK</div>
        <div className="text-sm text-slate-400">debug_init=mock - bez WebGL/Audio/FX</div>
        <button className="px-4 py-2 bg-accent text-black rounded-lg" onClick={onExit}>Exit</button>
    </div>
);

const ExperimentalAppLayout: React.FC<ExperimentalProps> = ({ onExit }) => (
    <div className="w-full h-screen overflow-hidden bg-[#010312] relative font-sans text-slate-300 selection:bg-accent selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black"></div>
        <div className="absolute top-4 left-4 z-50 text-xs bg-black/60 px-3 py-2 rounded-lg border border-white/10">
            Layout debug mode (no init)
        </div>
        {/* Canvas placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
                <div className="bg-black/70 border border-white/10 shadow-2xl" style={{ width: '960px', height: '540px' }}>
                    <div className="w-full h-full opacity-20 flex items-center justify-center text-slate-500 text-lg font-semibold">
                        Canvas placeholder
                    </div>
                </div>
            </div>
        </div>
        {/* HUD placeholder */}
        <div className="fixed top-4 right-4 z-50 font-mono text-[10px] text-slate-200 flex gap-3 bg-black/70 p-2 rounded-full backdrop-blur-xl border border-white/5 px-5 shadow-2xl pointer-events-none">
            <span className="text-accent">FPS: --</span>
            <span className="hidden md:inline">dt: -- ms</span>
            <span className="hidden md:inline">Scale: --</span>
            <span className="hidden md:inline">Cap: --</span>
            <span className="hidden md:inline">Mode: --</span>
            <span className="hidden md:inline">Perf: --</span>
        </div>
        {/* Left panel skeleton */}
        <div className="fixed z-40 glass-panel flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.6)] md:top-0 md:left-0 md:h-full md:w-[380px] md:border-r md:border-t-0 md:rounded-none bottom-0 left-0 w-full h-[60vh] rounded-t-3xl border-t border-white/10">
            <div className="px-6 py-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-white/10 shadow-lg bg-black flex items-center justify-center overflow-hidden">
                        <img src={ICON_PNG} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter leading-none">VISUS</h2>
                        <div className="text-[9px] text-accent font-mono tracking-[0.3em] opacity-80">LAYOUT ONLY</div>
                    </div>
                </div>
                <button onClick={onExit} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">X</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-8 pb-24">
                <section>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                        Source Mixer
                    </div>
                    <div className="flex justify-between gap-2 p-2 bg-black/30 rounded-2xl border border-white/10">
                        {['VIDEO', 'MUSIC', 'MIC'].map((label, idx) => (
                            <div key={label} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center text-[11px] text-slate-300">
                                <div className="font-bold mb-2">{label}</div>
                                <div className="h-2 bg-slate-700 rounded-full mb-2"></div>
                                <div className="text-[10px] text-slate-500">Inactive (layout)</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        Output & Framing
                    </div>
                    <div className="grid grid-cols-3 gap-1 mb-3">
                        {['native', '16:9', '9:16', '4:5', '1:1', 'fit'].map((r) => (
                            <button key={r} className="p-2 text-[9px] font-bold rounded border bg-white/5 border-white/5 text-slate-400 cursor-default">
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[9px] text-slate-500 font-bold tracking-wider">GEOMETRY</div>
                            <button className="flex items-center gap-2 px-2 py-1 rounded text-[9px] font-bold border bg-white/5 border-white/5 text-slate-400 cursor-default">
                                MIRROR
                            </button>
                        </div>
                        <div className="flex justify-around items-center text-[10px] text-slate-500">
                            <div>Scale</div>
                            <div>Pan X</div>
                            <div>Pan Y</div>
                        </div>
                    </div>
                </section>

                <section>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                            FX Chain
                        </div>
                    </div>
                    <div className="space-y-2">
                        {['Main', 'Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5'].map((name) => (
                            <div key={name} className="bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-slate-300">
                                {name} (layout)
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-slate-300">
                        Additive Master (layout)
                    </div>
                </section>

                <section>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                        Performance Lab
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {['Quality', 'Frame Cap', 'Performance Mode', 'UI Update Limit', 'Recording FPS', 'Recorder Bitrate', 'WebCodecs', 'Auto Scale'].map((label) => (
                            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-slate-300">
                                {label} (layout)
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    </div>
);

const PanelSettings: React.FC<{
    quality: QualityMode;
    setQuality: (q: QualityMode) => void;
    lockResolution: boolean;
    setLockResolution: (v: boolean) => void;
    frameCap: number;
    frameCapMode: 'dynamic' | 'manual';
    setFrameCap: (v: number) => void;
    setFrameCapMode: (m: 'dynamic' | 'manual') => void;
    performanceMode: PerformanceMode;
    setPerformanceMode: (m: PerformanceMode) => void;
    uiFpsLimit: number;
    setUiFpsLimit: (v: number) => void;
    recordFps: number;
    setRecordFps: (v: number) => void;
    recordBitrate: number;
    setRecordBitrate: (v: number) => void;
    recordResolution: { width: number; height: number };
    setRecordResolution: (v: { width: number; height: number }) => void;
    recordingVideoPresetId: string;
    setRecordingVideoPresetId: (v: string) => void;
    recordingAudioPresetId: string;
    setRecordingAudioPresetId: (v: string) => void;
    recordAudioBitrate: number;
    setRecordAudioBitrate: (v: number) => void;
    webCodecsSupported: boolean;
    useWebCodecsRecord: boolean;
    setUseWebCodecsRecord: (v: boolean) => void;
    autoScale: boolean;
    setAutoScale: (v: boolean) => void;
    useWorkletFFT: boolean;
    setUseWorkletFFT: (v: boolean) => void;
    useVideoFrameCb: boolean;
    setUseVideoFrameCb: (v: boolean) => void;
}> = memo((props) => {
    const {
        quality, setQuality,
        lockResolution, setLockResolution,
        frameCap, frameCapMode, setFrameCap, setFrameCapMode,
        performanceMode, setPerformanceMode,
        uiFpsLimit, setUiFpsLimit,
        recordFps, setRecordFps,
        recordBitrate, setRecordBitrate,
        recordResolution, setRecordResolution,
        recordingVideoPresetId, setRecordingVideoPresetId,
        recordingAudioPresetId, setRecordingAudioPresetId,
        recordAudioBitrate, setRecordAudioBitrate,
        webCodecsSupported, useWebCodecsRecord, setUseWebCodecsRecord,
        autoScale, setAutoScale,
        useWorkletFFT, setUseWorkletFFT,
        useVideoFrameCb, setUseVideoFrameCb,
    } = props;

    // Aliases for clearer naming in UI
    const autoScaleQuality = autoScale;
    const setAutoScaleQuality = setAutoScale;
    const useVideoFrameCallback = useVideoFrameCb;
    const setUseVideoFrameCallback = setUseVideoFrameCb;

    const qualityOptions: { key: QualityMode; label: string }[] = [
        { key: 'ultraLow', label: 'ULow' },
        { key: 'low', label: 'Low' },
        { key: 'medium', label: 'Med' },
        { key: 'high', label: 'High' },
    ];

    const perfOptions: { key: PerformanceMode; label: string }[] = [
        { key: 'high', label: 'Hi' },
        { key: 'medium', label: 'Med' },
        { key: 'low', label: 'Lo' },
    ];

    const uiFpsOptions = [15, 20, 30];
    const minBitrateMbps = 5;
    const maxBitrateMbps = 80;
    const toMbps = (bits: number) => Number((bits / 1_000_000).toFixed(1));
    const clampBitrate = (mbps: number) => {
        const safeValue = Number.isFinite(mbps) ? mbps : minBitrateMbps;
        const clamped = Math.max(minBitrateMbps, Math.min(maxBitrateMbps, safeValue));
        return Math.round(clamped * 1_000_000);
    };
    const minAudioKbps = 64;
    const maxAudioKbps = 320;
    const toKbps = (bits: number) => Math.round(bits / 1000);
    const clampAudioBitrate = (kbps: number) => {
        const safeValue = Number.isFinite(kbps) ? kbps : minAudioKbps;
        const clamped = Math.max(minAudioKbps, Math.min(maxAudioKbps, safeValue));
        return Math.round(clamped * 1000);
    };
    const findAudioPreset = (bitrate: number) => RECORDING_AUDIO_PRESETS.find(p => p.bitrate === bitrate);
    const selectVideoPreset = (preset: RecordingPreset) => {
        setRecordingVideoPresetId(preset.id);
        setRecordResolution({ width: preset.width, height: preset.height });
        setRecordFps(preset.fps);
        setRecordBitrate(preset.videoBitrate);
        setRecordAudioBitrate(preset.audioBitrate);
        const matchAudio = findAudioPreset(preset.audioBitrate);
        setRecordingAudioPresetId(matchAudio?.id ?? 'custom');
    };
    const selectAudioPreset = (preset: RecordingAudioPreset) => {
        setRecordingAudioPresetId(preset.id);
        setRecordAudioBitrate(preset.bitrate);
    };

    const toggleClass = (active: boolean) => active ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10';

    return (
        <section className="bg-black/20 border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Performance Lab</div>

            <div className="grid grid-cols-4 gap-2">
                {qualityOptions.map((q) => (
                    <button
                        key={q.key}
                        onClick={() => setQuality(q.key)}
                        className={`px-2 py-2 rounded text-[10px] font-bold border ${toggleClass(quality === q.key)}`}
                    >
                        {q.label}
                    </button>
                ))}
            </div>

            <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input type="checkbox" checked={lockResolution} onChange={(e) => setLockResolution(e.target.checked)} />
                Lock resolution (force 0.5x)
            </label>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">Frame cap mode</div>
                    <div className="flex gap-2">
                        {['dynamic', 'manual'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setFrameCapMode(m as 'dynamic' | 'manual')}
                                className={`flex-1 px-2 py-2 rounded text-[10px] font-bold border ${toggleClass(frameCapMode === m)}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                        <input
                            type="range"
                            min={15}
                            max={120}
                            step={1}
                            value={frameCap}
                            onChange={(e) => setFrameCap(parseInt(e.target.value, 10))}
                            disabled={frameCapMode === 'dynamic'}
                            className="flex-1"
                        />
                        <span className="w-10 text-right text-[11px]">{frameCap}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">Performance mode</div>
                    <div className="grid grid-cols-3 gap-2">
                        {perfOptions.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setPerformanceMode(p.key)}
                                className={`px-2 py-2 rounded text-[10px] font-bold border ${toggleClass(performanceMode === p.key)}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">UI FPS limit</div>
                    <div className="flex gap-2">
                        {uiFpsOptions.map((fps) => (
                            <button
                                key={fps}
                                onClick={() => setUiFpsLimit(fps)}
                                className={`flex-1 px-2 py-2 rounded text-[10px] font-bold border ${toggleClass(uiFpsLimit === fps)}`}
                            >
                                {fps}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Recording</div>
                <div className="space-y-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                            Video
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Quality preset</div>
                            <div className="relative">
                                <select
                                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-[11px] text-slate-100 focus:outline-none focus:border-accent/70 appearance-none"
                                    value={recordingVideoPresetId}
                                    onChange={(e) => {
                                        const p = RECORDING_VIDEO_PRESETS.find(v => v.id === e.target.value);
                                        if (p) selectVideoPreset(p); else setRecordingVideoPresetId('custom');
                                    }}
                                >
                                    {RECORDING_VIDEO_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-100">
                                            {preset.label} — {preset.width}x{preset.height} — {preset.fps} fps — {toMbps(preset.videoBitrate)} Mb/s / {toKbps(preset.audioBitrate)} kbps
                                        </option>
                                    ))}
                                    <option value="custom" className="bg-slate-900 text-slate-100">Custom</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">▾</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                <span className="w-16">FPS</span>
                                <input
                                    type="number"
                                    min={15}
                                    max={60}
                                    value={recordFps}
                                    onChange={(e) => {
                                        setRecordingVideoPresetId('custom');
                                        setRecordFps(Math.max(15, Math.min(60, parseInt(e.target.value || '0', 10))));
                                    }}
                                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-100"
                                />
                            </label>
                            <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                <span className="w-20">Bitrate</span>
                                <input
                                    type="number"
                                    min={minBitrateMbps}
                                    max={maxBitrateMbps}
                                    step={0.5}
                                    value={toMbps(recordBitrate)}
                                    onChange={(e) => {
                                        setRecordingVideoPresetId('custom');
                                        setRecordBitrate(clampBitrate(parseFloat(e.target.value || '0')));
                                    }}
                                    className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-100"
                                />
                                <span className="text-[10px] text-slate-500">Mb/s</span>
                            </label>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
                            Audio
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Audio preset</div>
                            <div className="relative">
                                <select
                                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-[11px] text-slate-100 focus:outline-none focus:border-accent/70 appearance-none"
                                    value={recordingAudioPresetId}
                                    onChange={(e) => {
                                        const p = RECORDING_AUDIO_PRESETS.find(v => v.id === e.target.value);
                                        if (p) selectAudioPreset(p); else setRecordingAudioPresetId('custom');
                                    }}
                                >
                                    {RECORDING_AUDIO_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-100">
                                            {preset.label} — {preset.note}
                                        </option>
                                    ))}
                                    <option value="custom" className="bg-slate-900 text-slate-100">Custom</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">▾</div>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-300">
                            <span className="w-24">Audio (kbps)</span>
                            <input
                                type="number"
                                min={minAudioKbps}
                                max={maxAudioKbps}
                                step={8}
                                value={toKbps(recordAudioBitrate)}
                                onChange={(e) => {
                                    setRecordingAudioPresetId('custom');
                                    setRecordAudioBitrate(clampAudioBitrate(parseFloat(e.target.value || '0')));
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-slate-100"
                            />
                        </label>
                    </div>
                </div>

                <section className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
                    <h3 className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                        Pipeline
                    </h3>

                    <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-slate-200">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={useWebCodecsRecord}
                                onChange={(e) => setUseWebCodecsRecord(e.target.checked)}
                                disabled={!webCodecsSupported}
                                className="accent-sky-400"
                            />
                            <span className="leading-tight">WebCodecs (HW preferred){!webCodecsSupported && <span className="text-amber-400"> (n/a)</span>}</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={autoScaleQuality}
                                onChange={e => setAutoScaleQuality(e.target.checked)}
                                className="accent-sky-400"
                            />
                            <span className="leading-tight">Auto scale quality</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={useWorkletFFT}
                                onChange={e => setUseWorkletFFT(e.target.checked)}
                                className="accent-sky-400"
                            />
                            <span className="leading-tight">Use worklet FFT</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={useVideoFrameCallback}
                                onChange={e => setUseVideoFrameCallback(e.target.checked)}
                                className="accent-sky-400"
                            />
                            <span className="leading-tight break-words">
                                reqVidFrameCallback
                            </span>
                        </label>
                    </div>
                </section>
            </div>
        </section>
    );
});

const getDebugFlags = () => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return {
        noGL: p.get('debug_nogl') === '1' || p.get('debug_no_gl') === '1',
        noAudio: p.get('debug_noaudio') === '1' || p.get('debug_no_audio') === '1',
        noWorker: p.get('debug_noworker') === '1' || p.get('debug_no_worker') === '1',
    };
};

let __visusMountSeq = 0;

const ExperimentalAppFull: React.FC<ExperimentalProps> = ({ onExit, bootRequested = false }) => {
    const mountIdRef = useRef<number>(++__visusMountSeq);
    useEffect(() => {
        console.log('[VISUS] ExperimentalAppFull mount start', { mountId: mountIdRef.current, time: Date.now() });
        return () => console.log('[VISUS] ExperimentalAppFull unmount', { mountId: mountIdRef.current });
    }, []);
    const debugFlagSet = getDebugFlags();
    const debugNoAudio = getDebugFlag('debug_no_audio') || debugFlagSet.noAudio;
    const debugNoGL = getDebugFlag('debug_no_gl') || debugFlagSet.noGL;
    const debugNoLoop = getDebugFlag('debug_no_loop');
    useEffect(() => {
        console.info('[VISUS] debug flags', { debugNoAudio, debugNoGL, debugNoLoop, flags: debugFlagSet });
    }, [debugNoAudio, debugNoGL, debugNoLoop, debugFlagSet.noAudio, debugFlagSet.noGL, debugFlagSet.noWorker]);
    const rendererRef = useRef<FastGLService | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const workerReadyRef = useRef(false);
    const bitmapInFlightRef = useRef(false);
    const useWorkerRenderRef = useRef(false);
    const canvas2dRef = useRef<CanvasRenderingContext2D | null>(null);
    const webCodecsSupported = typeof (window as any).VideoEncoder !== 'undefined' && typeof (window as any).MediaStreamTrackProcessor !== 'undefined';
    const [audioEngine] = useState<AudioEngine>(() => new ExperimentalAudioEngine());
    const audioRef = useRef<AudioEngine>(audioEngine);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiPanelRef = useRef<HTMLDivElement>(null);
    const resizePendingRef = useRef<boolean>(false);
    const panelRectRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
    const pendingResizeRef = useRef<{ w: number; h: number } | null>(null);
    const envCanvasRef = useRef<HTMLCanvasElement>(null);
    const additiveSliderRef = useRef<HTMLDivElement | null>(null);
    const additiveDraggingRef = useRef(false);
    const additiveDragOffsetRef = useRef(0);
    const spectrumRef = useRef<Uint8Array | null>(null);
    const frameStateRef = useRef<{ spectrum: Uint8Array | null }>({ spectrum: null });
    const ensureAudioContext = useCallback(async () => {
        const ae = audioRef.current;
        try {
            if (!ae.ctx) {
                await ae.initContext();
            } else if (ae.ctx.state === 'suspended') {
                await ae.ctx.resume();
            }
        } catch (err) {
            console.warn('[VISUS] ensureAudioContext failed (will retry on gesture)', err);
        }
        const ready = !!ae.ctx;
        if (audioReadyRef.current !== ready) {
            audioReadyRef.current = ready;
            setAudioReady(ready);
        }
    }, []);

    const didInitRef = useRef(false);
    const disposedRef = useRef(false);
    const initScheduledRef = useRef(false);
    const idleIdRef = useRef<number | null>(null);
    const engineStartedRef = useRef(false);

    useEffect(() => {
        if (didInitRef.current || !bootRequested) return;
        didInitRef.current = true;
        disposedRef.current = false;
        const initWork = () => {
            if (disposedRef.current || engineStartedRef.current) return;
            engineStartedRef.current = true;
            console.log('[VISUS] init useEffect enter', { mountId: mountIdRef.current });
            console.log('[VISUS] init start', { noGL: debugFlagSet.noGL, noAudio: debugFlagSet.noAudio, noWorker: debugFlagSet.noWorker });
            try {
                if (!debugFlagSet.noGL) {
                    rendererRef.current = new FastGLService({ noWorker: debugFlagSet.noWorker });
                    console.log('[VISUS] FastGLService created');
                } else {
                    rendererRef.current = new FastGLService({ noWorker: true });
                    console.log('[VISUS] GL disabled via debug flag');
                }
                flushPendingResize();
                handleResize();
            } catch (err) {
                console.error('[VISUS] init error', err);
            }
        };
        if (!initScheduledRef.current) {
            initScheduledRef.current = true;
            if (typeof (window as any).requestIdleCallback === 'function') {
                idleIdRef.current = (window as any).requestIdleCallback(() => initWork());
            } else {
                const id = window.setTimeout(() => initWork(), 0);
                idleIdRef.current = id;
            }
        }
        return () => {
            disposedRef.current = true;
            if (idleIdRef.current !== null) {
                if (typeof (window as any).cancelIdleCallback === 'function') {
                    (window as any).cancelIdleCallback(idleIdRef.current);
                } else {
                    clearTimeout(idleIdRef.current);
                }
                idleIdRef.current = null;
            }
            console.log('[VISUS] cleanup init', { mountId: mountIdRef.current });
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try { mediaRecorderRef.current.stop(); } catch {}
            }
            if (workerRef.current) {
                try { workerRef.current.terminate(); } catch {}
                workerRef.current = null;
            }
            rendererRef.current = null;
            audioReadyRef.current = false;
            setAudioReady(false);
            engineStartedRef.current = false;
            initScheduledRef.current = false;
        };
    }, [bootRequested, debugFlagSet.noAudio, debugFlagSet.noGL, debugFlagSet.noWorker]);

    const rafRef = useRef<number>(0);
    const lastFrameRef = useRef<number>(0);
    const lastUiUpdateRef = useRef<number>(0);
    const lastEnvUiUpdateRef = useRef<number>(0);
    const lastFpsTickRef = useRef<number>(0);
    const fpsSmoothRef = useRef<number>(60);
    const frameIndexRef = useRef<number>(0);
    const slowFrameStreakRef = useRef<number>(0);
    const autoScaleLowStreakRef = useRef<number>(0);
    const autoScaleHighStreakRef = useRef<number>(0);
    const lastAutoScaleChangeRef = useRef<number>(0);
    const lastBandLevelsRef = useRef<{ sync1: number; sync2: number; sync3: number }>({ sync1: 0, sync2: 0, sync3: 0 });
    const lastFftDataRef = useRef<Uint8Array | null>(null);
    const lastDtRef = useRef<number>(0);
    const videoFrameRequestRef = useRef<number | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingPresetRef = useRef<RecordingPreset | null>(null);
    const recordingLocksRef = useRef<null | {
        autoScale: boolean;
        renderScale: number;
        frameCap: number;
        frameCapMode: 'dynamic' | 'manual';
        performanceMode: PerformanceMode;
        uiFpsLimit: number;
        lockResolution: boolean;
    }>(null);
    const recordingCanvasSizeRef = useRef<{ width: number; height: number } | null>(null);
    const recordingBusyRef = useRef<boolean>(false);
    const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const recordingCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const recordingCopyTimerRef = useRef<number | null>(null); // legacy interval fallback
    const recordingCopyRafRef = useRef<number | null>(null);
    const recordingStartTsRef = useRef<number | null>(null);
    const audioReadyRef = useRef<boolean>(false);
    const [lastRecordingStats, setLastRecordingStats] = useState<null | {
        presetId: string;
        mimeType: string;
        fileExt: string;
        blobSize: number;
        durationSec: number;
        effectiveMbps: number;
        effectiveBps: number;
        targetVideoMbps: number;
        targetAudioKbps: number;
        videoTrackSettings?: MediaTrackSettings;
        chunkCount?: number;
    }>(null);
    const [recorderPath, setRecorderPath] = useState<'MediaRecorder' | 'WebCodecs' | 'unknown'>('unknown');

    const [fxPreference, setFxPreference] = useState<'auto' | 'forceOn' | 'forceOff'>(getFxPreference());
    const [renderPreference, setRenderPreference] = useState<'auto' | 'webgl' | 'canvas'>(getRenderPreference());
    const [workerPreference, setWorkerPreference] = useState<boolean>(getWorkerPreference());
    const devMode = isDevMode();
    const [panelVisible, setPanelVisible] = useState(true);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [isBooting, setIsBooting] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [fps, setFps] = useState(0);
    const [renderMode, setRenderMode] = useState<RenderMode>('webgl-worker');
    const [frameCap, setFrameCap] = useState(getFrameCapValue());
    const [frameCapMode, setFrameCapMode] = useState<'dynamic' | 'manual'>(getFrameCapMode());
    const defaultVideoPreset = RECORDING_VIDEO_PRESETS.find(p => p.id === DEFAULT_RECORDING_VIDEO_PRESET_ID) ?? RECORDING_VIDEO_PRESETS[0];
    const defaultAudioPreset = RECORDING_AUDIO_PRESETS.find(p => p.id === DEFAULT_RECORDING_AUDIO_PRESET_ID) ?? RECORDING_AUDIO_PRESETS[0];
    const [recordingVideoPresetId, setRecordingVideoPresetId] = useState<string>(defaultVideoPreset?.id ?? 'custom');
    const [recordingAudioPresetId, setRecordingAudioPresetId] = useState<string>(defaultAudioPreset?.id ?? 'custom');
    const [recordResolution, setRecordResolution] = useState<{ width: number; height: number }>({
        width: defaultVideoPreset?.width ?? 1920,
        height: defaultVideoPreset?.height ?? 1080,
    });
    const [recordFps, setRecordFps] = useState(defaultVideoPreset?.fps ?? 30);
    const [recordBitrate, setRecordBitrate] = useState(defaultVideoPreset?.videoBitrate ?? 15_000_000);
    const [recordAudioBitrate, setRecordAudioBitrate] = useState(defaultAudioPreset?.bitrate ?? 192_000);
    const [useWebCodecsRecord, setUseWebCodecsRecord] = useState(false);
    const [autoScale, setAutoScale] = useState(false);
    const [renderScale, setRenderScale] = useState(QUALITY_SCALE.high);
    const [quality, setQuality] = useState<QualityMode>('high');
    const [performanceMode, setPerformanceMode] = useState<PerformanceMode>(getPerformanceMode());
    const [uiFpsLimit, setUiFpsLimit] = useState<number>(getUiFpsLimit());
    const [lockResolution, setLockResolution] = useState<boolean>(getLockResolution());
    const [useWorkletFFT, setUseWorkletFFT] = useState<boolean>(getUseWorkletFFT());
    const [useVideoFrameCb, setUseVideoFrameCb] = useState<boolean>(getUseVideoFrameCallback());
    const [audioReady, setAudioReady] = useState(false);
    const frameCapRef = useRef<number>(frameCap);
    const uiFpsLimitRef = useRef<number>(uiFpsLimit);
    const performanceModeRef = useRef<PerformanceMode>(performanceMode);
    const frameCapModeRef = useRef<'dynamic' | 'manual'>(frameCapMode);
    const useWorkletFFTRef = useRef<boolean>(useWorkletFFT);
    const useVideoFrameCbRef = useRef<boolean>(useVideoFrameCb);
    const [webglProbe, setWebglProbe] = useState<{ webgl2: boolean; webgl: boolean }>({ webgl2: false, webgl: false });
    const [fallbackReason, setFallbackReason] = useState<FallbackReason>('NONE');
    const [lastShaderError, setLastShaderError] = useState<string>('');

    const [showCatalog, setShowCatalog] = useState(false);
    const [showCameraSelector, setShowCameraSelector] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');

    const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('native');
    const [isMirrored, setIsMirrored] = useState(false);
    const [transform, setTransform] = useState<TransformConfig>({ x: 0, y: 0, scale: 1.0 });
    const [additiveGain, setAdditiveGain] = useState(80);
    const [additiveEnvConfig, setAdditiveEnvConfig] = useState<AdditiveEnvConfig>(DEFAULT_ADDITIVE_ENV_CONFIG);
    const [additiveEnvValue, setAdditiveEnvValue] = useState(0.5);
    const [additiveEnvTrace, setAdditiveEnvTrace] = useState<{ env: Float32Array; det: Float32Array; eff: Float32Array } | null>(null);
    const [showEnvAdvanced, setShowEnvAdvanced] = useState(false);
    const [visualLevels, setVisualLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });
    const [fxVuLevels, setFxVuLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });
    const [vuLevels, setVuLevels] = useState({ video: 0, music: 0, mic: 0 });

    const [syncParams, setSyncParams] = useState<SyncParam[]>([
        { bpm: 128.0, offset: 0, freq: 60, width: 30, gain: 1.0 },
        { bpm: 128.0, offset: 0, freq: 800, width: 40, gain: 1.0 },
        { bpm: 128.0, offset: 0, freq: 6000, width: 40, gain: 1.0 },
    ]);

    const [fxState, setFxState] = useState<FxState>({
        main: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 },
        fx1: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 },
        fx2: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 },
        fx3: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 },
        fx4: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 },
        fx5: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 },
    });

    const activeRecordingPreset = useMemo<RecordingPreset>(() => {
        const videoPreset = RECORDING_VIDEO_PRESETS.find(p => p.id === recordingVideoPresetId);
        const fallbackVideo = RECORDING_VIDEO_PRESETS[0];
        return {
            id: videoPreset?.id ?? 'custom',
            label: videoPreset?.label ?? 'Custom',
            note: videoPreset?.note ?? 'Custom preset',
            width: recordResolution.width,
            height: recordResolution.height,
            fps: recordFps,
            videoBitrate: recordBitrate,
            audioBitrate: recordAudioBitrate,
            codecVideo: videoPreset?.codecVideo ?? fallbackVideo.codecVideo,
            codecAudio: 'opus',
            container: 'webm',
        };
    }, [recordingVideoPresetId, recordResolution.width, recordResolution.height, recordFps, recordBitrate, recordAudioBitrate]);

    useEffect(() => {
        recordingPresetRef.current = activeRecordingPreset;
    }, [activeRecordingPreset]);

    type PlaylistItem = {
        id: string;
        name: string;
        url: string;
    };

    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const [playlistMode, setPlaylistMode] = useState<'sequential' | 'random'>('sequential');
    const [playlistAvoidRepeat, setPlaylistAvoidRepeat] = useState(true);
    const [playlistCurrentIndex, setPlaylistCurrentIndex] = useState<number | null>(null);
    const [playlistNextIndex, setPlaylistNextIndex] = useState<number | null>(null);

    const [mixer, setMixer] = useState({
        video: { active: true, volume: 1.0, hasSource: false, playing: false, name: '' },
        music: { active: true, volume: 0.8, hasSource: false, playing: false, name: '' },
        mic: { active: false, volume: 1.5, hasSource: false }
    });

    const fxStateRef = useRef(fxState);
    const syncParamsRef = useRef(syncParams);
    const additiveGainRef = useRef(additiveGain);
    const additiveEnvConfigRef = useRef<AdditiveEnvConfig>(DEFAULT_ADDITIVE_ENV_CONFIG);
    const additiveEnvValueRef = useRef(0.5);
    const transformRef = useRef(transform);
    const isMirroredRef = useRef(isMirrored);
    const renderScaleRef = useRef(renderScale);
    const renderModeRef = useRef<RenderMode>(renderMode);
    const fxPreferenceRef = useRef(fxPreference);
    const fallbackReasonRef = useRef<FallbackReason>('NONE');
    const fxVuLevelsRef = useRef(fxVuLevels);
    const visualLevelsRef = useRef(visualLevels);
    const mixerRef = useRef(mixer);
    const playlistRef = useRef<PlaylistItem[]>([]);
    const playlistModeRef = useRef<'sequential' | 'random'>('sequential');
    const playlistAvoidRepeatRef = useRef(true);
    const playlistCurrentIndexRef = useRef<number | null>(null);
    const playlistNextIndexRef = useRef<number | null>(null);

    useEffect(() => { fxStateRef.current = fxState; }, [fxState]);
    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { additiveGainRef.current = additiveGain; }, [additiveGain]);
    useEffect(() => { additiveEnvConfigRef.current = additiveEnvConfig; }, [additiveEnvConfig]);
    useEffect(() => { additiveEnvValueRef.current = additiveEnvValue; }, [additiveEnvValue]);
    useEffect(() => { transformRef.current = transform; }, [transform]);
    useEffect(() => { isMirroredRef.current = isMirrored; }, [isMirrored]);
    useEffect(() => { renderScaleRef.current = renderScale; }, [renderScale]);
    useEffect(() => { renderModeRef.current = renderMode; }, [renderMode]);
    useEffect(() => { fxPreferenceRef.current = fxPreference; }, [fxPreference]);
    useEffect(() => { fallbackReasonRef.current = fallbackReason; }, [fallbackReason]);
    useEffect(() => { fxVuLevelsRef.current = fxVuLevels; }, [fxVuLevels]);
    useEffect(() => { mixerRef.current = mixer; }, [mixer]);
    useEffect(() => { visualLevelsRef.current = visualLevels; }, [visualLevels]);
    useEffect(() => { playlistRef.current = playlist; }, [playlist]);
    useEffect(() => { playlistModeRef.current = playlistMode; }, [playlistMode]);
    useEffect(() => { playlistAvoidRepeatRef.current = playlistAvoidRepeat; }, [playlistAvoidRepeat]);
    useEffect(() => { playlistCurrentIndexRef.current = playlistCurrentIndex; }, [playlistCurrentIndex]);
    useEffect(() => { playlistNextIndexRef.current = playlistNextIndex; }, [playlistNextIndex]);
    useEffect(() => { performanceModeRef.current = performanceMode; localStorage.setItem('visus_perf_mode', performanceMode); }, [performanceMode]);
    useEffect(() => { uiFpsLimitRef.current = uiFpsLimit; localStorage.setItem('visus_ui_fps', String(uiFpsLimit)); }, [uiFpsLimit]);
    useEffect(() => { frameCapRef.current = frameCap; localStorage.setItem('visus_framecap', String(frameCap)); }, [frameCap]);
    useEffect(() => { frameCapModeRef.current = frameCapMode; localStorage.setItem('visus_framecap_mode', frameCapMode); }, [frameCapMode]);
    useEffect(() => { localStorage.setItem('visus_lock_res', lockResolution ? '1' : '0'); }, [lockResolution]);
    useEffect(() => { audioReadyRef.current = audioReady; }, [audioReady]);
    useEffect(() => {
        useWorkletFFTRef.current = useWorkletFFT;
        localStorage.setItem('visus_worklet_fft', useWorkletFFT ? '1' : '0');
        if (debugNoAudio) return;
        audioRef.current.setUseWorkletFFT(useWorkletFFT);
    }, [useWorkletFFT, debugNoAudio]);
    useEffect(() => { useVideoFrameCbRef.current = useVideoFrameCb; localStorage.setItem('visus_vfc', useVideoFrameCb ? '1' : '0'); }, [useVideoFrameCb]);
    useEffect(() => {
        if (!audioReady || debugNoAudio) return;
        audioRef.current?.updateAdditiveEnvConfig(additiveEnvConfig);
    }, [additiveEnvConfig, audioReady, debugNoAudio]);
    useEffect(() => {
        const canvas = envCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth || 240;
        const height = canvas.clientHeight || 60;
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(0, 0, width, height);

        const trace = additiveEnvTrace;
        if (trace && trace.env.length > 1) {
            const { env, det, eff } = trace;
            const N = env.length;
            const barW = Math.max(1, width / N);

            // Detector bars
            ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
            for (let i = 0; i < N; i++) {
                const x = (i / (N - 1)) * width;
                const amp = Math.pow(Math.max(0, det[i] || 0), 0.7);
                const h = amp * (height * 0.9);
                ctx.fillRect(x, height - 2 - h, barW, h);
            }

            // Envelope line
            ctx.beginPath();
            for (let i = 0; i < N; i++) {
                const x = (i / (N - 1)) * width;
                const envVal = Number.isFinite(env[i]) ? env[i] : 0;
                const y = height - 2 - envVal * (height * 0.9);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Effective line (dashed)
            if (eff && eff.length === N) {
                ctx.setLineDash([4, 3]);
                ctx.beginPath();
                for (let i = 0; i < N; i++) {
                    const x = (i / (N - 1)) * width;
                    const effVal = Number.isFinite(eff[i]) ? eff[i] : Number.isFinite(env[i]) ? env[i] : 0;
                    const y = height - 2 - effVal * (height * 0.9);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        const baseLine = Math.max(0, Math.min(1, additiveGain / 100));
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const yBase = height - baseLine * height;
        ctx.moveTo(0, yBase);
        ctx.lineTo(width, yBase);
        ctx.stroke();
        ctx.setLineDash([]);
    }, [additiveEnvTrace, additiveGain]);
    useEffect(() => { setFxPreference(getFxPreference()); }, []);
    useEffect(() => {
        setRenderPreference(getRenderPreference());
        const baseWorkerPref = getWorkerPreference();
        setWorkerPreference(debugFlagSet.noWorker ? false : baseWorkerPref);
    }, [debugFlagSet.noWorker]);
    useEffect(() => {
        (window as any).__VISUS_METRICS__ = {
            renderScaleRef,
            performanceModeRef,
            renderModeRef,
            fpsRef: fpsSmoothRef,
            autoScaleRef: { current: autoScale },
            qualityRef: { current: quality },
            lastDtRef
        };
        return () => { delete (window as any).__VISUS_METRICS__; };
    }, [autoScale, quality]);

    useEffect(() => {
        if (!audioReady || debugNoAudio) return;
        const ae = audioRef.current;
        if (!ae) return;
        ae.setVolume('video', mixer.video.active ? mixer.video.volume : 0);
        ae.setVolume('music', mixer.music.active ? mixer.music.volume : 0);
        ae.setVolume('mic', mixer.mic.active ? mixer.mic.volume : 0);
        if ((ae as any).setChannelActive) {
            (ae as any).setChannelActive('video', mixer.video.active);
            (ae as any).setChannelActive('music', mixer.music.active);
            (ae as any).setChannelActive('mic', mixer.mic.active);
        }
    }, [audioReady, debugNoAudio, mixer.video.volume, mixer.video.active, mixer.music.volume, mixer.music.active, mixer.mic.volume, mixer.mic.active]);

    const getActivationLevel = (routing: string, phase: number) => {
        if (routing === 'off') return 1.0;
        if (routing === 'bpm') return (phase < 0.15) ? 1.0 : 0.0;
        const ae = audioRef.current;
        if (!ae || !audioReady || debugNoAudio) return 0;
        const bandsGain = syncParamsRef.current;
        if (routing === 'sync1') return ae.bands.sync1 * (bandsGain[0]?.gain ?? 1);
        if (routing === 'sync2') return ae.bands.sync2 * (bandsGain[1]?.gain ?? 1);
        if (routing === 'sync3') return ae.bands.sync3 * (bandsGain[2]?.gain ?? 1);
        return 0;
    };

    const applyRendererResize = useCallback((renderW: number, renderH: number) => {
        if (disposedRef.current) return;
        if (useWorkerRenderRef.current) {
            if (!workerReadyRef.current || !workerRef.current) {
                pendingResizeRef.current = { w: renderW, h: renderH };
                return;
            }
            workerRef.current.postMessage({ type: 'resize', width: renderW, height: renderH });
            return;
        }
        const renderer = rendererRef.current;
        if (!renderer) {
            pendingResizeRef.current = { w: renderW, h: renderH };
            return;
        }
        renderer.resize(renderW, renderH);
    }, []);

    const flushPendingResize = useCallback(() => {
        const pending = pendingResizeRef.current;
        if (!pending) return;
        pendingResizeRef.current = null;
        applyRendererResize(pending.w, pending.h);
    }, [applyRendererResize]);

    const handleResize = useCallback(() => {
        if (resizePendingRef.current) return;
        resizePendingRef.current = true;
        requestAnimationFrame(() => {
            resizePendingRef.current = false;
            if (disposedRef.current) return;
            const canvas = canvasRef.current;
            if (!canvas) return;

            const wWindow = window.innerWidth;
            const hWindow = window.innerHeight;
            const isMobileNow = wWindow < 768;
            setIsMobile(isMobileNow);
            const panelWidth = (panelVisible && panelRectRef.current.width > 0)
                ? panelRectRef.current.width
                : ((panelVisible && uiPanelRef.current) ? uiPanelRef.current.getBoundingClientRect().width : 0);
            if (panelVisible && panelRectRef.current.width === 0 && uiPanelRef.current) {
                const r = uiPanelRef.current.getBoundingClientRect();
                panelRectRef.current = { width: r.width, height: r.height };
            }
            const sideGap = panelVisible ? 16 : 0;
            const availableW = isMobileNow ? wWindow : Math.max(0, wWindow - panelWidth - sideGap);
            let availableH = hWindow;
            let topOffset = 0;

            if (isMobileNow && panelVisible) {
                availableH = hWindow * 0.45;
                topOffset = 8;
            }

            let finalW = wWindow;
            let finalH = hWindow;

            if (aspectRatio === 'native') {
                if (videoRef.current && videoRef.current.videoWidth > 0) {
                    finalW = videoRef.current.videoWidth;
                    finalH = videoRef.current.videoHeight;
                }
            } else if (aspectRatio === '16:9') {
                finalH = 1080; finalW = 1920;
            } else if (aspectRatio === '9:16') {
                finalW = 1080; finalH = 1920;
            } else if (aspectRatio === '4:5') {
                finalW = 1080; finalH = 1350;
            } else if (aspectRatio === '1:1') {
                finalW = 1080; finalH = 1080;
            } else if (aspectRatio === '21:9') {
                finalH = 1080; finalW = 2520;
            } else if (aspectRatio === 'fit') {
                finalW = wWindow; finalH = hWindow;
            }

            const scale = Math.min(availableW / finalW, availableH / finalH);
            const displayW = finalW * scale;
            const displayH = finalH * scale;

            const renderW = Math.max(4, Math.round(finalW * renderScaleRef.current));
            const renderH = Math.max(4, Math.round(finalH * renderScaleRef.current));

            canvas.style.width = `${displayW}px`;
            canvas.style.height = `${displayH}px`;
            canvas.style.left = `${(isMobileNow ? (wWindow - displayW) / 2 : panelWidth + sideGap + (availableW - displayW) / 2)}px`;
            canvas.style.top = `${topOffset + (availableH - displayH) / 2}px`;

            applyRendererResize(renderW, renderH);
        });
    }, [applyRendererResize, aspectRatio, panelVisible]);

    useEffect(() => {
        handleResize();
        const onResize = () => handleResize();
        window.addEventListener('resize', onResize);
        const v = videoRef.current;
        if (v) v.addEventListener('loadedmetadata', onResize);
        let ro: ResizeObserver | null = null;
        if (uiPanelRef.current && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry && entry.contentRect) {
                    panelRectRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
                    handleResize();
                }
            });
            ro.observe(uiPanelRef.current);
        }
        return () => {
            window.removeEventListener('resize', onResize);
            if (v) v.removeEventListener('loadedmetadata', onResize);
            if (ro) ro.disconnect();
        };
    }, [handleResize, renderScale]);

    useEffect(() => {
        const mapped = QUALITY_SCALE[quality];
        if (renderScaleRef.current !== mapped) {
            setRenderScale(mapped);
            renderScaleRef.current = mapped;
            handleResize();
        }
    }, [quality, handleResize]);

    useEffect(() => {
        if (lockResolution) {
            if (quality !== 'low') setQuality('low');
            if (renderScaleRef.current !== QUALITY_SCALE.low) {
                setRenderScale(QUALITY_SCALE.low);
                renderScaleRef.current = QUALITY_SCALE.low;
                handleResize();
            }
        }
    }, [lockResolution, quality, handleResize]);

    useEffect(() => {
        if (!canvasRef.current) return;
        if (debugNoGL && debugNoAudio) {
            console.info('[VISUS] debug_no_gl=1 & debug_no_audio=1 -> init skipped');
            setIsBooting(false);
            return;
        }

        const initWork = async () => {
            const canvas = canvasRef.current as HTMLCanvasElement;
            const ensureCanvas2D = () => {
                const ctx = canvas.getContext('2d');
                if (ctx) canvas2dRef.current = ctx;
            };

            const forceCanvas = renderPreference === 'canvas' || fxPreferenceRef.current === 'forceOff';
            const forceWebgl = renderPreference === 'webgl';
            const workerAllowed = workerPreference && !forceWebgl && renderPreference !== 'canvas';

            const probe = detectWebGLSupport();
            setWebglProbe(probe);

            const tryWorker = async () => {
                if (!workerAllowed) return false;
                if (!(canvas as any).transferControlToOffscreen) return false;
                try {
                    const worker = new (RenderWorker as any)();
                    workerRef.current = worker;
                    const offscreen = (canvas as any).transferControlToOffscreen();
                    const shaderDef = SHADER_LIST[fxStateRef.current.main.shader] || SHADER_LIST['00_NONE'];
                    const initPromise = new Promise<boolean>((resolve) => {
                        worker.onmessage = (ev: MessageEvent) => {
                            if (ev.data?.type === 'frame-done') {
                                bitmapInFlightRef.current = false;
                                return;
                            }
                            if (ev.data?.type === 'init-result') {
                                const ok = !!ev.data.success && ev.data.mode === 'webgl';
                                if (!ok) {
                                    console.warn('[VISUS] worker init failed', ev.data?.lastShaderError);
                                } else {
                                    console.info('[VISUS] worker init ok');
                                }
                                resolve(ok);
                            }
                        };
                    });
                    worker.postMessage({ type: 'init', canvas: offscreen, fragSrc: shaderDef.src }, [offscreen]);
                    const ok = await initPromise;
                    if (!ok) {
                        workerRef.current?.terminate();
                        workerRef.current = null;
                        workerReadyRef.current = false;
                        useWorkerRenderRef.current = false;
                        return false;
                    }
                    // Reattach handler for regular frame completion
                    worker.onmessage = (ev: MessageEvent) => {
                        if (ev.data?.type === 'frame-done') bitmapInFlightRef.current = false;
                    };
                    workerReadyRef.current = true;
                    useWorkerRenderRef.current = true;
                    setRenderMode('webgl-worker');
                    setFallbackReason('NONE');
                    setLastShaderError('');
                    flushPendingResize();
                    console.info('[VISUS] start FX (worker):', fxStateRef.current.main.shader);
                    return true;
                } catch (err) {
                    workerReadyRef.current = false;
                    useWorkerRenderRef.current = false;
                    return false;
                }
            };

            if (forceCanvas) {
                setRenderMode('canvas2d');
                setFallbackReason('USER_FORCE');
                setLastShaderError('');
                ensureCanvas2D();
                useWorkerRenderRef.current = false;
                workerReadyRef.current = false;
                if (workerRef.current) {
                    workerRef.current.terminate();
                    workerRef.current = null;
                }
                console.info('[VISUS] fallback Canvas2D (user forced render=canvas or fx=off)');
            } else {
                if (!probe.webgl && !probe.webgl2) {
                    setRenderMode('canvas2d');
                    setFallbackReason('NO_CONTEXT');
                    setLastShaderError('');
                    ensureCanvas2D();
                    useWorkerRenderRef.current = false;
                    workerReadyRef.current = false;
                    console.warn('[VISUS] fallback Canvas2D (WebGL probe failed: no context)');
                } else {
                    const workerUsed = forceWebgl ? false : await tryWorker();
                    if (!workerUsed) {
                        useWorkerRenderRef.current = false;
                        workerReadyRef.current = false;
                        let renderer = rendererRef.current;
                        if (!renderer) {
                            renderer = new FastGLService({ noWorker: debugFlagSet.noWorker });
                            rendererRef.current = renderer;
                            console.info('[VISUS] FastGLService created (late)');
                        }
                        const webglReady = renderer.init(canvas);
                        if (webglReady) {
                            const shaderDef = SHADER_LIST[fxStateRef.current.main.shader] || SHADER_LIST['00_NONE'];
                            const ok = renderer.loadShader(shaderDef.src);
                            if (!ok) {
                                setRenderMode('canvas2d');
                                setFallbackReason('SHADER_FAIL');
                                setLastShaderError(renderer.lastShaderError || 'shader init failed');
                                ensureCanvas2D();
                                console.warn('[VISUS] fallback Canvas2D (shader init failed)');
                            } else {
                                setRenderMode('webgl-fastgl');
                                setFallbackReason('NONE');
                                setLastShaderError('');
                                flushPendingResize();
                                console.info('[VISUS] start FX (fastgl):', fxStateRef.current.main.shader);
                            }
                        } else {
                            setRenderMode('canvas2d');
                            setFallbackReason('INIT_ERROR');
                            setLastShaderError('');
                            ensureCanvas2D();
                            console.warn('[VISUS] fallback Canvas2D (WebGL init failed)');
                        }
                    } else {
                        setLastShaderError('');
                    }
                }
            }

            const initializeAudio = async () => {
                const eng = audioRef.current;
                try {
                    await eng.initContext();
                } catch (err) {
                    console.warn('[VISUS] audio init failed (will retry on gesture)', err);
                }

                if (!debugNoAudio) {
                    eng.setupFilters(syncParamsRef.current);
                    const spec = eng.getSpectrum();
                    if (!spectrumRef.current || spectrumRef.current.length !== spec.length) {
                        spectrumRef.current = new Uint8Array(spec.length);
                    }
                    spectrumRef.current.set(spec);
                    frameStateRef.current.spectrum = spectrumRef.current;
                } else {
                    console.info('[VISUS] debug_no_audio=1 -> AudioContext utworzony, filtry/FFT pominiete');
                }
                const ready = !!eng.ctx;
                audioReadyRef.current = ready;
                setAudioReady(ready);
            };

            await initializeAudio();
            setIsBooting(false);
            handleResize();
        };

        const schedule = (cb: () => void) => {
            if (typeof (window as any).requestIdleCallback === 'function') {
                (window as any).requestIdleCallback(cb);
            } else {
                setTimeout(cb, 0);
            }
        };

        if (!debugNoGL) {
            schedule(initWork);
        } else {
            setRenderMode('canvas2d');
            setFallbackReason('USER_FORCE');
            setLastShaderError('debug_no_gl');
            setIsBooting(false);
            console.info('[VISUS] debug_no_gl=1 -> WebGL init skipped, forcing Canvas2D');
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (debugNoGL) return;
        const onLost = (ev: Event) => {
            if (typeof (ev as any).preventDefault === 'function') {
                (ev as any).preventDefault();
            }
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            workerReadyRef.current = false;
            useWorkerRenderRef.current = false;
            setRenderMode('canvas2d');
            setFallbackReason('CONTEXT_LOST');
            const ctx = canvas.getContext('2d');
            if (ctx) canvas2dRef.current = ctx;
            console.warn('[VISUS] webglcontextlost -> fallback Canvas2D');
        };
        canvas.addEventListener('webglcontextlost', onLost as EventListener, { passive: false });
        return () => canvas.removeEventListener('webglcontextlost', onLost as EventListener);
    }, []);

    useEffect(() => {
        if (renderMode === 'canvas2d' || debugNoGL) return;
        const shaderDef = SHADER_LIST[fxState.main.shader] || SHADER_LIST['00_NONE'];
        if (renderMode === 'webgl-worker' && workerReadyRef.current && workerRef.current) {
            workerRef.current.postMessage({ type: 'loadShader', fragSrc: shaderDef.src });
            setFallbackReason('NONE');
            setLastShaderError('');
            console.info('[VISUS] start FX (worker):', fxState.main.shader);
        } else if (renderMode === 'webgl-fastgl') {
            const renderer = rendererRef.current;
            if (!renderer) return;
            const ok = renderer.loadShader(shaderDef.src);
            if (!ok) {
                setRenderMode('canvas2d');
                setFallbackReason('SHADER_FAIL');
                setLastShaderError(renderer.lastShaderError || 'shader init failed');
                const ctx = canvasRef.current?.getContext('2d') || null;
                if (ctx) canvas2dRef.current = ctx;
                console.warn('[VISUS] fallback Canvas2D (shader compile failure)');
            } else {
                setFallbackReason('NONE');
                setLastShaderError('');
                flushPendingResize();
                console.info('[VISUS] start FX (fastgl):', fxState.main.shader);
            }
        }
    }, [fxState.main.shader, flushPendingResize, renderMode]);

    const didStartLoopRef = useRef(false);
    const stopLoop = useCallback(() => {
        didStartLoopRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (videoRef.current && videoFrameRequestRef.current !== null && typeof (videoRef.current as any).cancelVideoFrameCallback === 'function') {
            (videoRef.current as any).cancelVideoFrameCallback(videoFrameRequestRef.current);
        }
    }, []);

    useEffect(() => {
        if (debugNoLoop || didStartLoopRef.current) {
            if (debugNoLoop) console.info('[VISUS] debug_no_loop=1 -> render loop skipped');
            return;
        }
        didStartLoopRef.current = true;
        let mounted = true;

        const scheduleNext = () => {
            if (!mounted) return;
            const videoEl: any = videoRef.current;
            if (useVideoFrameCbRef.current && videoEl && typeof videoEl.requestVideoFrameCallback === 'function') {
                videoFrameRequestRef.current = videoEl.requestVideoFrameCallback(loop);
            } else {
                rafRef.current = requestAnimationFrame(loop);
            }
        };

        const loop = (t: number) => {
            if (!mounted) return;

            if (lastFrameRef.current === 0) {
                lastFrameRef.current = t;
            }

            const capTarget = frameCapRef.current;
            const frameBudget = capTarget > 0 ? (1000 / capTarget) : 0;
            if (frameBudget && (t - lastFrameRef.current) < frameBudget) {
                scheduleNext();
                return;
            }

            const now = t;
            const dt = lastFrameRef.current === 0 ? 0 : now - lastFrameRef.current;
            lastFrameRef.current = now;
            lastDtRef.current = dt;
            frameIndexRef.current += 1;

            const ae = audioRef.current;
            if (!ae) {
                scheduleNext();
                return;
            }
            const isSlowFrame = dt > 40;
            if (isSlowFrame) {
                slowFrameStreakRef.current += 1;
            } else {
                slowFrameStreakRef.current = 0;
            }
            const skipHeavy = slowFrameStreakRef.current >= 2 && (frameIndexRef.current % 2 === 1);

            if (!skipHeavy) {
                ae.update();
                const spec = ae.getSpectrum();
                if (spec && spec.length > 0) {
                    if (!spectrumRef.current || spectrumRef.current.length !== spec.length) {
                        spectrumRef.current = new Uint8Array(spec.length);
                    }
                    spectrumRef.current.set(spec);
                    frameStateRef.current.spectrum = spectrumRef.current;
                }
            }
            const vu = (ae as ExperimentalAudioEngine).getLevelsFast(0.08); // channel RMS (video, music, mic)
            const uiBudget = 1000 / Math.max(1, uiFpsLimitRef.current);
            const shouldUpdateUi = (now - lastUiUpdateRef.current) > uiBudget;

            const currentSyncParams = syncParamsRef.current;
            const currentFxState = fxStateRef.current;
            const currentTransform = transformRef.current;

            const bpm = currentSyncParams[0].bpm;
            const offset = currentSyncParams[0].offset;
            const beatMs = 60000 / bpm;
            const adjustedTime = now - offset;
            const phase = (adjustedTime % beatMs) / beatMs;

            const fxSlots = [currentFxState.main, currentFxState.fx1, currentFxState.fx2, currentFxState.fx3, currentFxState.fx4, currentFxState.fx5];
            const needsSpectrum = fxSlots.some(fx => fx.routing === 'sync1' || fx.routing === 'sync2' || fx.routing === 'sync3');

            let bandLevels = lastBandLevelsRef.current;
            if (!bandLevels) {
                bandLevels = { sync1: 0, sync2: 0, sync3: 0 };
                lastBandLevelsRef.current = bandLevels;
            }
            if (!skipHeavy) {
                bandLevels.sync1 = 0;
                bandLevels.sync2 = 0;
                bandLevels.sync3 = 0;

                const sampleStride = performanceModeRef.current === 'high' ? 1 : performanceModeRef.current === 'medium' ? 2 : 3;
                const shouldSampleFft = needsSpectrum && (frameIndexRef.current % sampleStride === 0);
                let fftData: Uint8Array | null = null;
                if (shouldSampleFft && (ae as any).getFFTData) {
                    fftData = (ae as any).getFFTData();
                    if (fftData && fftData.length > 0) {
                        lastFftDataRef.current = fftData;
                    }
                } else if (needsSpectrum) {
                    fftData = lastFftDataRef.current;
                }

                if (fftData && fftData.length > 0) {
                    const nyquist = ((ae as any).ctx?.sampleRate || 48000) / 2;
                    const sampleBand = (freq: number, width: number, gain: number) => {
                        const minF = Math.max(20, freq * Math.max(0.1, 1 - width / 100));
                        const maxF = Math.min(nyquist, freq * (1 + width / 100));
                        const minBin = Math.max(0, Math.floor((minF / nyquist) * fftData.length));
                        const maxBin = Math.min(fftData.length - 1, Math.ceil((maxF / nyquist) * fftData.length));
                        let sum = 0;
                        let count = 0;
                        for (let i = minBin; i <= maxBin; i++) {
                            sum += fftData[i];
                            count++;
                        }
                        const avg = count > 0 ? sum / count : 0;
                        const norm = Math.min(1, avg / 255);
                        return Math.min(1, norm * gain);
                    };

                    bandLevels.sync1 = sampleBand(currentSyncParams[0].freq, currentSyncParams[0].width, currentSyncParams[0]?.gain ?? 1);
                    bandLevels.sync2 = sampleBand(currentSyncParams[1].freq, currentSyncParams[1].width, currentSyncParams[1]?.gain ?? 1);
                    bandLevels.sync3 = sampleBand(currentSyncParams[2].freq, currentSyncParams[2].width, currentSyncParams[2]?.gain ?? 1);
                }
                lastBandLevelsRef.current = bandLevels;
            }

            const getLevel = (routing: string, forVu = false) => {
                if (routing === 'off') return forVu ? 0.0 : 1.0;
                if (routing === 'bpm') return (phase < 0.15) ? 1.0 : 0.0;
                if (routing === 'sync1') return bandLevels.sync1;
                if (routing === 'sync2') return bandLevels.sync2;
                if (routing === 'sync3') return bandLevels.sync3;
                return 0;
            };

            const lerp = (prev: number, next: number, alpha: number) => (prev * (1 - alpha)) + (next * alpha);
            // FX depth ceiling: give headroom without saturating at low %.
            const fxCeiling = 6.0;
            const vuCeiling = 10.0;
            const fxAlpha = 0.30; // slightly snappier to avoid UI lag
            const vuAlpha = 0.35; // keep VU responsive without jitter

            const computeFxVal = (config: any, prev: number) => {
                const sourceLevel = Math.max(0, getLevel(config.routing));
                const gainMult = (config.gain ?? 100) / 100; // Depth knob as max
                const shaped = Math.pow(sourceLevel, 0.8);
                const target = Math.min(fxCeiling, shaped * gainMult * fxCeiling);
                return lerp(prev, target, fxAlpha);
            };

            const computeFxVu = (config: any, prev: number) => {
                const sourceLevel = Math.max(0, getLevel(config.routing, true));
                const gainMult = (config.gain ?? 100) / 100;
                const shaped = Math.pow(sourceLevel, 0.8);
                const target = Math.min(vuCeiling, shaped * gainMult * vuCeiling);
                return lerp(prev, target, vuAlpha);
            };

            visualLevelsRef.current.main = computeFxVal(currentFxState.main, visualLevelsRef.current.main);
            visualLevelsRef.current.fx1 = computeFxVal(currentFxState.fx1, visualLevelsRef.current.fx1);
            visualLevelsRef.current.fx2 = computeFxVal(currentFxState.fx2, visualLevelsRef.current.fx2);
            visualLevelsRef.current.fx3 = computeFxVal(currentFxState.fx3, visualLevelsRef.current.fx3);
            visualLevelsRef.current.fx4 = computeFxVal(currentFxState.fx4, visualLevelsRef.current.fx4);
            visualLevelsRef.current.fx5 = computeFxVal(currentFxState.fx5, visualLevelsRef.current.fx5);

            fxVuLevelsRef.current.main = computeFxVu(currentFxState.main, fxVuLevelsRef.current.main);
            fxVuLevelsRef.current.fx1 = computeFxVu(currentFxState.fx1, fxVuLevelsRef.current.fx1);
            fxVuLevelsRef.current.fx2 = computeFxVu(currentFxState.fx2, fxVuLevelsRef.current.fx2);
            fxVuLevelsRef.current.fx3 = computeFxVu(currentFxState.fx3, fxVuLevelsRef.current.fx3);
            fxVuLevelsRef.current.fx4 = computeFxVu(currentFxState.fx4, fxVuLevelsRef.current.fx4);
            fxVuLevelsRef.current.fx5 = computeFxVu(currentFxState.fx5, fxVuLevelsRef.current.fx5);

            const envValue = (ae as any).getAdditiveEnvValue ? (ae as any).getAdditiveEnvValue() : 0.5;
            additiveEnvValueRef.current = envValue;

            const envDepth = additiveEnvConfigRef.current.enabled
                ? Math.max(0, Math.min(1, additiveEnvConfigRef.current.depth))
                : 0;

            const baseAdditive = Math.max(0, Math.min(1, additiveGainRef.current / 100));

            // Env modulates the base instead of fully replacing it:
            // depth=0   -> final = base
            // depth=1   -> final = base * env
            let effectiveAdditive = baseAdditive;
            if (envDepth > 0) {
                const mod = (1 - envDepth) + envDepth * envValue;
                effectiveAdditive = baseAdditive * mod;
            }

            effectiveAdditive = Math.max(0, Math.min(1, effectiveAdditive));
            if (!debugNoAudio && audioReadyRef.current) {
                audioRef.current?.updateAdditiveEnvEffective(effectiveAdditive);
            }

            const shouldUpdateEnvUi = (now - lastEnvUiUpdateRef.current) > 50;
            if (shouldUpdateEnvUi) {
                const trace = debugNoAudio || !audioReadyRef.current ? null : audioRef.current?.getAdditiveEnvTrace(1000);
                if (trace) setAdditiveEnvTrace(trace);
                setAdditiveEnvValue(envValue);
                lastEnvUiUpdateRef.current = now;
            }

            if (shouldUpdateUi) {
                setVisualLevels({ ...visualLevelsRef.current });
                setFxVuLevels({ ...fxVuLevelsRef.current });
                setVuLevels({ video: vu[0], music: vu[1], mic: vu[2] });
                lastUiUpdateRef.current = now;
            }

            const computedFx: ExperimentalFxPacket = {
                mainFXGain: visualLevelsRef.current.main,
                main_id: SHADER_LIST[currentFxState.main.shader]?.id || 0,
                mainMix: (currentFxState.main.mix ?? 100) / 100,
                additiveMasterGain: effectiveAdditive,
                transform: currentTransform,
                isMirrored: isMirroredRef.current,
                fx1: visualLevelsRef.current.fx1, fx2: visualLevelsRef.current.fx2, fx3: visualLevelsRef.current.fx3, fx4: visualLevelsRef.current.fx4, fx5: visualLevelsRef.current.fx5,
                fx1Mix: (currentFxState.fx1.mix ?? 100) / 100,
                fx2Mix: (currentFxState.fx2.mix ?? 100) / 100,
                fx3Mix: (currentFxState.fx3.mix ?? 100) / 100,
                fx4Mix: (currentFxState.fx4.mix ?? 100) / 100,
                fx5Mix: (currentFxState.fx5.mix ?? 100) / 100,
                fx1_id: SHADER_LIST[currentFxState.fx1.shader]?.id || 0,
                fx2_id: SHADER_LIST[currentFxState.fx2.shader]?.id || 0,
                fx3_id: SHADER_LIST[currentFxState.fx3.shader]?.id || 0,
                fx4_id: SHADER_LIST[currentFxState.fx4.shader]?.id || 0,
                fx5_id: SHADER_LIST[currentFxState.fx5.shader]?.id || 0,
            };

            const canUseWebGL = renderModeRef.current !== 'canvas2d';
            const hasVideoReady = !!videoRef.current && videoRef.current.readyState >= 2;

            if (canUseWebGL && renderModeRef.current === 'webgl-worker' && useWorkerRenderRef.current && workerRef.current && videoRef.current && !bitmapInFlightRef.current) {
                if (hasVideoReady) {
                    bitmapInFlightRef.current = true;
                    const timeout = window.setTimeout(() => { bitmapInFlightRef.current = false; }, 80);
                    createImageBitmap(videoRef.current)
                        .then((bitmap) => {
                            workerRef.current?.postMessage({
                                type: 'frame',
                                bitmap,
                                time: now,
                                fx: computedFx,
                                videoSize: { w: videoRef.current?.videoWidth || 0, h: videoRef.current?.videoHeight || 0 }
                            }, [bitmap]);
                            window.clearTimeout(timeout);
                        })
                        .catch(() => { bitmapInFlightRef.current = false; window.clearTimeout(timeout); });
                }
            } else if (canUseWebGL && renderModeRef.current === 'webgl-fastgl' && videoRef.current) {
                const renderer = rendererRef.current;
                if (renderer && renderer.isReady()) {
                    renderer.updateTexture(videoRef.current);
                    renderer.draw(now, videoRef.current, computedFx);
                }
            } else if (!canUseWebGL && videoRef.current && hasVideoReady && canvasRef.current) {
                const ctx2d = canvas2dRef.current || canvasRef.current.getContext('2d');
                if (ctx2d) {
                    canvas2dRef.current = ctx2d;
                    ctx2d.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    ctx2d.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                }
            }

            if (hasVideoReady && dt > 0) {
                const instFps = 1000 / Math.max(1, dt);
                fpsSmoothRef.current = fpsSmoothRef.current * 0.7 + instFps * 0.3;
                setFps(Math.round(fpsSmoothRef.current));

                if (frameCapModeRef.current === 'dynamic') {
                    let nextCap = frameCapRef.current;
                    if (fpsSmoothRef.current < 27 && frameCapRef.current > 24) {
                        nextCap = 24;
                    } else if (fpsSmoothRef.current < 33 && frameCapRef.current > 30) {
                        nextCap = 30;
                    } else if (fpsSmoothRef.current > 50 && frameCapRef.current < 60) {
                        nextCap = 60;
                    }
                    if (nextCap !== frameCapRef.current) {
                        frameCapRef.current = nextCap;
                        setFrameCap(nextCap);
                    }
                }

                if (autoScale && !lockResolution) {
                    const targets: Array<{ label: QualityMode, scale: number }> = [
                        { label: 'high', scale: QUALITY_SCALE.high },
                        { label: 'medium', scale: QUALITY_SCALE.medium },
                        { label: 'low', scale: QUALITY_SCALE.low },
                        { label: 'ultraLow', scale: QUALITY_SCALE.ultraLow },
                    ];
                    const currentIdx = Math.max(0, targets.findIndex(t => t.scale === renderScaleRef.current));
                    const cooldownMs = 1400;
                    const canChange = (now - lastAutoScaleChangeRef.current) > cooldownMs;
                    if (fpsSmoothRef.current < 25) {
                        autoScaleLowStreakRef.current += 1;
                    } else {
                        autoScaleLowStreakRef.current = 0;
                    }
                    if (fpsSmoothRef.current > 50) {
                        autoScaleHighStreakRef.current += 1;
                    } else {
                        autoScaleHighStreakRef.current = 0;
                    }
                    if (canChange && autoScaleLowStreakRef.current >= 10 && currentIdx < targets.length - 1) {
                        const next = targets[currentIdx + 1];
                        setQuality(next.label);
                        setRenderScale(next.scale);
                        renderScaleRef.current = next.scale;
                        handleResize();
                        lastAutoScaleChangeRef.current = now;
                        autoScaleLowStreakRef.current = 0;
                        autoScaleHighStreakRef.current = 0;
                    } else if (canChange && autoScaleHighStreakRef.current >= 20 && currentIdx > 0) {
                        const next = targets[currentIdx - 1];
                        setQuality(next.label);
                        setRenderScale(next.scale);
                        renderScaleRef.current = next.scale;
                        handleResize();
                        lastAutoScaleChangeRef.current = now;
                        autoScaleLowStreakRef.current = 0;
                        autoScaleHighStreakRef.current = 0;
                    }
                }

                lastFpsTickRef.current = now;
            }

            scheduleNext();
        };

        scheduleNext();
        return () => {
            mounted = false;
            stopLoop();
        };
    }, [debugNoLoop, handleResize, stopLoop]);

    useEffect(() => {
        if (!didStartLoopRef.current && !debugNoLoop) {
            // trigger loop start if toggled after init
            stopLoop();
            didStartLoopRef.current = false;
        }
    }, [useVideoFrameCb]);

    const toggleMic = useCallback(async (isActive: boolean) => {
        if (debugNoAudio) {
            console.info('[VISUS] debug_no_audio=1 -> mic init skipped');
            setMixer(prev => ({ ...prev, mic: { ...prev.mic, active: false, hasSource: false } }));
            return;
        }
        setMixer(prev => ({ ...prev, mic: { ...prev.mic, active: isActive } }));

        if (isActive) {
            try {
                await audioRef.current.initContext();
                await audioRef.current.connectMic();
                setMixer(prev => ({ ...prev, mic: { ...prev.mic, hasSource: true } }));
                audioRef.current.setupFilters(syncParamsRef.current);
            } catch (e: any) {
                console.error('Mic Error:', e);
                let msg = 'Could not access microphone.';
                if (e.name === 'NotAllowedError') msg += ' Permission denied. Please allow microphone access.';
                else if (e.name === 'NotFoundError') msg += ' No microphone found.';
                else msg += ' ' + e.message;
                alert(msg);
                setMixer(prev => ({ ...prev, mic: { ...prev.mic, active: false } }));
                audioRef.current?.disconnectMic();
            }
        } else {
            audioRef.current.disconnectMic();
        }
    }, [debugNoAudio]);

    const updateMixer = useCallback((channel: 'video' | 'music' | 'mic', changes: any) => {
        setMixer(prev => ({
            ...prev,
            [channel]: { ...prev[channel], ...changes }
        }));
    }, []);

    const toggleTransport = useCallback(async (channel: 'video' | 'music') => {
        if (audioRef.current?.ctx?.state === 'suspended') {
            await audioRef.current.ctx.resume();
        }

        if (channel === 'video' && videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(e => console.error('Video play fail', e));
                updateMixer('video', { playing: true });
            } else {
                videoRef.current.pause();
                updateMixer('video', { playing: false });
            }
        } else if (channel === 'music' && audioElRef.current) {
            if (audioElRef.current.paused) {
                audioElRef.current.play().catch(e => console.error('Audio play fail', e));
                updateMixer('music', { playing: true });
            } else {
                audioElRef.current.pause();
                updateMixer('music', { playing: false });
            }
        }
    }, [updateMixer]);

    const stopTransport = useCallback((channel: 'video' | 'music') => {
        if (channel === 'video' && videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            updateMixer('video', { playing: false });
        } else if (channel === 'music' && audioElRef.current) {
            audioElRef.current.pause();
            audioElRef.current.currentTime = 0;
            updateMixer('music', { playing: false });
        }
    }, [updateMixer]);

    const handleVideoToggle = useCallback((active: boolean) => updateMixer('video', { active }), [updateMixer]);
    const handleVideoVolume = useCallback((val: number) => updateMixer('video', { volume: val }), [updateMixer]);
    const handleMusicToggle = useCallback((active: boolean) => updateMixer('music', { active }), [updateMixer]);
    const handleMusicVolume = useCallback((val: number) => updateMixer('music', { volume: val }), [updateMixer]);
    const handleMicVolume = useCallback((val: number) => updateMixer('mic', { volume: val }), [updateMixer]);
    const playPauseVideo = useCallback(() => toggleTransport('video'), [toggleTransport]);
    const playPauseMusic = useCallback(() => toggleTransport('music'), [toggleTransport]);
    const stopVideo = useCallback(() => stopTransport('video'), [stopTransport]);
    const stopMusic = useCallback(() => stopTransport('music'), [stopTransport]);

    const loadMusicTrack = useCallback(async (url: string, name: string) => {
        if (debugNoAudio) {
            console.info('[VISUS] debug_no_audio=1 -> music load skipped');
            return;
        }
        if (audioElRef.current) {
            audioElRef.current.pause();
        }

        const audio = new Audio();
        audio.src = url;
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        audioElRef.current = audio;

        await ensureAudioContext();
        audioRef.current.connectMusic(audio);
        audioRef.current.setupFilters(syncParamsRef.current);

        audio.play().then(() => {
            setMixer(prev => ({
                ...prev,
                music: { ...prev.music, hasSource: true, active: true, name: name, playing: true }
            }));
        }).catch(e => console.log('Auto-play prevented', e));

        setShowCatalog(false);
    }, [debugNoAudio, ensureAudioContext]);

    const handleFile = useCallback(async (type: 'video' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const file = e.target.files[0];
                const url = URL.createObjectURL(file);

                if (type === 'video' && videoRef.current) {
                    try {
                        videoRef.current.srcObject = null;
                        const currentSrc = videoRef.current.src;
                        const currentInPlaylist = playlistRef.current.some(p => p.url === currentSrc);
                        if (currentSrc && currentSrc.startsWith('blob:') && !currentInPlaylist) URL.revokeObjectURL(currentSrc);
                        videoRef.current.src = url;
                        videoRef.current.muted = false;
                        videoRef.current.loop = false;
                        videoRef.current.play().catch(() => {});
                        if (!debugNoAudio) {
                            await ensureAudioContext();
                            audioRef.current.connectVideo(videoRef.current);
                            audioRef.current.setupFilters(syncParamsRef.current);
                        }
                        setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, playing: true, name: file.name } }));
                    } catch (err) {
                        console.error('Video load failed', err);
                    }
                } else if (type === 'audio') {
                    if (debugNoAudio) {
                        console.info('[VISUS] debug_no_audio=1 -> audio file load skipped');
                        return;
                    }
                    await loadMusicTrack(url, file.name);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }, [debugNoAudio, ensureAudioContext, loadMusicTrack]);

    const pickNextPlaylistIndex = (
        list: PlaylistItem[],
        mode: 'sequential' | 'random',
        avoidRepeat: boolean,
        currentIndex: number | null
    ): number | null => {
        if (!list.length) return null;
        if (list.length === 1) {
            return avoidRepeat ? null : 0;
        }

        if (mode === 'sequential') {
            if (currentIndex === null) return 0;
            let next = currentIndex + 1;
            if (next >= list.length) next = 0;
            if (avoidRepeat && next === currentIndex) return null;
            return next;
        }

        // mode === 'random'
        let tries = 10;
        let candidate = currentIndex;
        while (tries-- > 0) {
            const r = Math.floor(Math.random() * list.length);
            if (!avoidRepeat || r !== currentIndex) {
                candidate = r;
                break;
            }
        }
        return candidate === null ? 0 : candidate!;
    };

    const loadPlaylistClip = useCallback(async (index: number) => {
        const list = playlistRef.current;
        const item = list[index];
        if (!item || !videoRef.current) return;

        try {
            const currentSrc = videoRef.current.src;
            const currentInPlaylist = playlistRef.current.some(p => p.url === currentSrc);
            if (currentSrc && currentSrc.startsWith('blob:') && !currentInPlaylist) {
                try { URL.revokeObjectURL(videoRef.current.src); } catch {}
            }
            videoRef.current.srcObject = null;
            videoRef.current.src = item.url;
            videoRef.current.loop = false;
            videoRef.current.muted = false;
            videoRef.current.playsInline = true;

            if (!debugNoAudio) {
                await ensureAudioContext();
                audioRef.current.connectVideo(videoRef.current);
                audioRef.current.setupFilters(syncParamsRef.current);
            }

            await videoRef.current.play().catch(() => {});

            setMixer(prev => ({
                ...prev,
                video: {
                    ...prev.video,
                    hasSource: true,
                    playing: true,
                    name: item.name
                }
            }));

            setPlaylistCurrentIndex(index);

            const next = pickNextPlaylistIndex(
                list,
                playlistModeRef.current,
                playlistAvoidRepeatRef.current,
                index
            );
            setPlaylistNextIndex(next);
        } catch (err) {
            console.error('[VISUS] loadPlaylistClip error', err);
        }
    }, [debugNoAudio, ensureAudioContext, setMixer]);
const removePlaylistItem = useCallback((index: number) => {
    setPlaylist(prev => {
        if (index < 0 || index >= prev.length) return prev;

        const removed = prev[index];
        const next = prev.filter((_, i) => i !== index);

        // Adjust current/next indices
        const cur = playlistCurrentIndexRef.current;
        const nxt = playlistNextIndexRef.current;

        let newCur: number | null = cur;
        let newNxt: number | null = nxt;

        // If we removed before current/next, shift indices down
        if (typeof cur === 'number' && index < cur) newCur = cur - 1;
        if (typeof nxt === 'number' && index < nxt) newNxt = nxt - 1;

        const removedWasCurrent = (typeof cur === 'number' && index === cur);

        // If we removed the currently selected/playing item, pick a sensible fallback
        if (removedWasCurrent) {
            if (next.length === 0) {
                newCur = null;
                newNxt = null;

                // Stop video safely
                if (videoRef.current) {
                    try { videoRef.current.pause(); } catch {}
                    // If removed URL was blob and not referenced anywhere else, revoke after clearing src
                    const oldUrl = removed?.url;
                    videoRef.current.srcObject = null as any;
                    videoRef.current.src = '';
                    if (oldUrl && oldUrl.startsWith('blob:')) {
                        const stillUsed = next.some(p => p.url === oldUrl);
                        if (!stillUsed) {
                            try { URL.revokeObjectURL(oldUrl); } catch {}
                        }
                    }
                }
            } else {
                // Keep same index if possible (item that shifted into this slot), else previous
                const fallbackIndex = Math.min(index, next.length - 1);
                newCur = fallbackIndex;

                // Compute next index based on current playlist mode/avoid-repeat logic
                if (playlistModeRef.current === 'random') {
                    {
                    const n = next.length;
                    if (n <= 1) {
                        newNxt = 0;
                    } else {
                        let cand = Math.floor(Math.random() * n);
                        if (playlistAvoidRepeatRef.current && cand === fallbackIndex) {
                            cand = (cand + 1) % n;
                        }
                        newNxt = cand;
                    }
                }
                } else {
                    newNxt = (fallbackIndex + 1) % next.length;
                }

                // Load fallback clip async (do not block state update)
                queueMicrotask(() => { loadPlaylistClip(fallbackIndex); });
            }
        }

        // Apply state updates (only if they actually changed)
        setPlaylistCurrentIndex(newCur);
        setPlaylistNextIndex(newNxt);
        playlistCurrentIndexRef.current = newCur;
        playlistNextIndexRef.current = newNxt;

        // Revoke removed blob URL if it's no longer used and it's not the current <video> src
        const removedUrl = removed?.url;
        if (removedUrl && removedUrl.startsWith('blob:')) {
            const stillUsed = next.some(p => p.url === removedUrl);
            const isCurrentSrc = !!videoRef.current && videoRef.current.src === removedUrl;
            if (!stillUsed && !isCurrentSrc) {
                try { URL.revokeObjectURL(removedUrl); } catch {}
            }
        }

        return next;
    });
}, [setPlaylist, loadPlaylistClip, setPlaylistCurrentIndex, setPlaylistNextIndex]);


    const handleVideoEnded = useCallback(() => {
        const list = playlistRef.current;
        const next = playlistNextIndexRef.current;
        if (next == null || !list.length) return;
        loadPlaylistClip(next);
    }, [loadPlaylistClip]);

    const addFilesToPlaylist = useCallback(
        async (fileList: FileList | null) => {
            if (!fileList || fileList.length === 0) return;

            const files: File[] = Array.from(fileList);
            const newItems: PlaylistItem[] = files.map((file, idx) => ({
                id: `${Date.now()}_${idx}_${file.name}`,
                name: file.name,
                url: URL.createObjectURL(file)
            }));

            setPlaylist(prev => {
                const merged = [...prev, ...newItems];

                if (playlistCurrentIndexRef.current === null && newItems.length > 0) {
                    const startIndex = prev.length;
                    setTimeout(() => {
                        loadPlaylistClip(startIndex);
                    }, 0);
                }
                return merged;
            });
        },
        [loadPlaylistClip]
    );

    const skipPlaylistClip = useCallback(() => {
        const list = playlistRef.current;
        const current = playlistCurrentIndexRef.current;
        if (!list.length) return;

        const next = pickNextPlaylistIndex(
            list,
            playlistModeRef.current,
            playlistAvoidRepeatRef.current,
            current
        );
        if (next == null) return;
        loadPlaylistClip(next);
    }, [loadPlaylistClip]);

    const setPlaylistModeSafe = (mode: 'sequential' | 'random') => {
        setPlaylistMode(mode);
        const list = playlistRef.current;
        const current = playlistCurrentIndexRef.current;
        const next = pickNextPlaylistIndex(
            list,
            mode,
            playlistAvoidRepeatRef.current,
            current
        );
        setPlaylistNextIndex(next);
    };

    const setPlaylistAvoidRepeatSafe = (value: boolean) => {
        setPlaylistAvoidRepeat(value);
        const list = playlistRef.current;
        const current = playlistCurrentIndexRef.current;
        const next = pickNextPlaylistIndex(
            list,
            playlistModeRef.current,
            value,
            current
        );
        setPlaylistNextIndex(next);
    };

    const startCamera = async (deviceId?: string) => {
        if (!videoRef.current) return;
        try {
        const constraints: MediaStreamConstraints = {
            video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: cameraFacing } },
            audio: false
        };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            if (!debugNoAudio) {
                await ensureAudioContext();
                audioRef.current.connectVideo(videoRef.current);
            }
            setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, playing: true } }));
            setShowCameraSelector(false);
        } catch (err) {
            alert('Could not start camera: ' + err);
        }
    };

    const initCamera = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cams = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(cams);
            if (cams.length === 1) {
                startCamera(cams[0].deviceId);
            } else {
                setShowCameraSelector(true);
            }
        } catch (err) {
            alert('Camera access failed: ' + err);
        }
    };

    const encoderRef = useRef<VideoEncoder | null>(null);
    const readerRef = useRef<ReadableStreamDefaultReader<VideoFrame> | null>(null);
    const videoTrackRef = useRef<MediaStreamTrack | null>(null);
    const encodedChunksRef = useRef<Uint8Array[]>([]);

    const buildRecordingAudio = () => {
        const ae: any = audioRef.current;
        if (!ae) return { stream: null as MediaStream | null, cleanup: () => {} };
        if (typeof ae.createRecordingStream === 'function') {
            return ae.createRecordingStream();
        }
        const stream = typeof ae.getAudioStream === 'function' ? ae.getAudioStream() : null;
        return { stream, cleanup: () => {} };
    };

    const clampRecordingFps = (fps: number) => Math.max(15, Math.min(60, Math.round(fps)));
    const clampAudioBps = (bps: number) => Math.max(64_000, Math.min(510_000, bps));

    const ensureRecordingCanvas = (w: number, h: number) => {
        let canvas = recordingCanvasRef.current;
        if (!canvas) {
            canvas = document.createElement('canvas');
            recordingCanvasRef.current = canvas;
        }
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        let ctx = recordingCtxRef.current;
        if (!ctx) {
            ctx = canvas.getContext('2d');
            recordingCtxRef.current = ctx;
        }
        return { canvas, ctx };
    };

    const stopRecordingCopyLoop = () => {
        if (recordingCopyTimerRef.current !== null) {
            clearInterval(recordingCopyTimerRef.current);
            recordingCopyTimerRef.current = null;
        }
        if (recordingCopyRafRef.current !== null) {
            cancelAnimationFrame(recordingCopyRafRef.current);
            recordingCopyRafRef.current = null;
        }
    };

    const startRecordingCopyLoop = (fps: number, targetCanvas: HTMLCanvasElement) => {
        stopRecordingCopyLoop();
        const frameInterval = 1000 / Math.max(1, fps);
        let lastCopy = performance.now();
        const copy = () => {
            const now = performance.now();
            if (now - lastCopy >= frameInterval - 1) { // small tolerance
                if (canvasRef.current && recordingCtxRef.current) {
                    recordingCtxRef.current.drawImage(canvasRef.current, 0, 0, targetCanvas.width, targetCanvas.height);
                }
                lastCopy = now;
            }
            recordingCopyRafRef.current = requestAnimationFrame(copy);
        };
        recordingCopyRafRef.current = requestAnimationFrame(copy);
    };

    const enterRecordingMode = (preset: RecordingPreset) => {
        if (recordingLocksRef.current) return;
        recordingPresetRef.current = preset;
        recordingLocksRef.current = {
            autoScale,
            renderScale: renderScaleRef.current,
            frameCap: frameCapRef.current,
            frameCapMode: frameCapModeRef.current,
            performanceMode: performanceModeRef.current,
            uiFpsLimit: uiFpsLimitRef.current,
            lockResolution,
        };
        const lockedFps = clampRecordingFps(preset.fps);
        setAutoScale(false);
        autoScaleHighStreakRef.current = 0;
        autoScaleLowStreakRef.current = 0;
        if (frameCapModeRef.current !== 'manual') {
            setFrameCapMode('manual');
            frameCapModeRef.current = 'manual';
        }
        if (frameCapRef.current !== lockedFps) {
            frameCapRef.current = lockedFps;
            setFrameCap(lockedFps);
        }
        const targetScale = 1;
        if (renderScaleRef.current !== targetScale) {
            renderScaleRef.current = targetScale;
            setRenderScale(targetScale);
        }
        if (performanceModeRef.current !== 'high') {
            performanceModeRef.current = 'high';
            setPerformanceMode('high');
        }
        if (uiFpsLimitRef.current !== 15) {
            uiFpsLimitRef.current = 15;
            setUiFpsLimit(15);
        }
        if (lockResolution) {
            setLockResolution(false);
        }
        // NOTE: Do not call handleResize() when entering REC. It forces UI aspect/size to recording preset.
        
    };

    const exitRecordingMode = () => {
        const snapshot = recordingLocksRef.current;
        recordingPresetRef.current = null;
        recordingLocksRef.current = null;
        if (!snapshot) {
            handleResize();
            return;
        }
        setAutoScale(snapshot.autoScale);
        if (renderScaleRef.current !== snapshot.renderScale) {
            renderScaleRef.current = snapshot.renderScale;
            setRenderScale(snapshot.renderScale);
        }
        if (frameCapRef.current !== snapshot.frameCap) {
            frameCapRef.current = snapshot.frameCap;
            setFrameCap(snapshot.frameCap);
        }
        if (frameCapModeRef.current !== snapshot.frameCapMode) {
            frameCapModeRef.current = snapshot.frameCapMode;
            setFrameCapMode(snapshot.frameCapMode);
        }
        if (performanceModeRef.current !== snapshot.performanceMode) {
            performanceModeRef.current = snapshot.performanceMode;
            setPerformanceMode(snapshot.performanceMode);
        }
        if (uiFpsLimitRef.current !== snapshot.uiFpsLimit) {
            uiFpsLimitRef.current = snapshot.uiFpsLimit;
            setUiFpsLimit(snapshot.uiFpsLimit);
        }
        if (snapshot.lockResolution !== lockResolution) {
            setLockResolution(snapshot.lockResolution);
        }
        handleResize();
    };

    const stopWebCodecsRecording = async () => {
        try { await readerRef.current?.cancel(); } catch {}
        if (videoTrackRef.current) videoTrackRef.current.stop();
        if (encoderRef.current) {
            try { await encoderRef.current.flush(); } catch {}
            encoderRef.current.close();
        }
        readerRef.current = null;
        videoTrackRef.current = null;
        const blobParts: BlobPart[] = encodedChunksRef.current.map((u) => new Uint8Array(u));
        const blob = new Blob(blobParts, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        a.download = `VISUS_EXPERIMENTAL_${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        exitRecordingMode();
        setIsRecording(false);
    };

    
    const startMediaRecorderRecording = async (preset: RecordingPreset, preferWebCodecs = false): Promise<boolean> => {
        if (!canvasRef.current) {
            alert('Canvas not ready yet.');
            return false;
        }
        const captureFps = clampRecordingFps(preset.fps);
        const { canvas: recCanvas, ctx } = ensureRecordingCanvas(preset.width, preset.height);
        if (!ctx) {
            alert('Recording canvas unavailable.');
            return false;
        }
        ctx.drawImage(canvasRef.current, 0, 0, preset.width, preset.height);
        startRecordingCopyLoop(captureFps, recCanvas);
        const canvasStream = recCanvas.captureStream(captureFps);
        const videoTracks = canvasStream.getVideoTracks();
        if (!videoTracks.length) {
            alert('Recording aborted: no video track from canvas.');
            return false;
        }
        try {
            await videoTracks[0].applyConstraints({
                frameRate: { ideal: captureFps, max: captureFps },
                width: { ideal: preset.width },
                height: { ideal: preset.height },
            });
        } catch (e) {
            console.warn('Video track constraints apply failed', e);
        }

        let audioTracks: MediaStreamTrack[] = [];
        let recordingAudio: { stream: MediaStream | null; cleanup: () => void } = { stream: null, cleanup: () => {} };
        if (!debugNoAudio) {
            try {
                await ensureAudioContext();
            } catch (e) {
                console.warn('Audio context resume failed before recording', e);
            }
            const { stream, cleanup } = buildRecordingAudio();
            recordingAudio = { stream, cleanup };
            if (stream) {
                console.debug('[VISUS] rec stream tracks', stream.getAudioTracks().map((t: MediaStreamTrack) => ({
                    kind: t.kind,
                    readyState: t.readyState,
                    enabled: t.enabled,
                    label: t.label,
                })));
                audioTracks = stream.getAudioTracks().filter((t: MediaStreamTrack) => t.readyState === 'live');
                audioTracks.forEach((t: MediaStreamTrack) => { t.enabled = true; });
            }
        } else {
            console.info('[VISUS] debug_no_audio=1 -> recording video-only (no audio tracks)');
        }

        const channelActive = (audioRef.current as any)?.channelActive || {};
        const hasActiveAudioSource =
            (mixerRef.current.video.active && mixerRef.current.video.hasSource) ||
            (mixerRef.current.music.active && mixerRef.current.music.hasSource) ||
            (mixerRef.current.mic.active && mixerRef.current.mic.hasSource);
        console.info('[VISUS] record start', {
            channels: mixerRef.current,
            channelActive,
            mixTrackCount: audioTracks.length,
            videoTracks: videoTracks.length,
            videoSource: {
                hasSource: mixerRef.current.video.hasSource,
                playing: mixerRef.current.video.playing,
                attached: !!videoRef.current?.srcObject || !!videoRef.current?.src
            },
            debugNoAudio
        });

        if (!debugNoAudio && !hasActiveAudioSource) {
            console.warn('[VISUS] record aborted: no active VIDEO/MUSIC/MIC source armed for mix');
            recordingAudio.cleanup?.();
            alert('Brak aktywnego zrodla audio (VIDEO/MUSIC/MIC). Wlacz kanal i sprobuj ponownie.');
            return false;
        }

        if (!debugNoAudio && audioTracks.length === 0) {
            console.warn('[VISUS] record aborted: master mix has 0 audio tracks');
            const msg = preferWebCodecs
                ? 'WebCodecs: master mix has no audio tracks (VIDEO/MUSIC/MIC). Turn on a source and retry.'
                : 'Brak sciezki audio w master mixie (VIDEO/MUSIC/MIC). Wlacz zrodlo i sprobuj ponownie.';
            alert(msg);
            if (preferWebCodecs) setUseWebCodecsRecord(false);
            return false;
        }

        console.debug('[MIXTRACKS]', audioTracks.map((t) => ({
            kind: t.kind,
            readyState: t.readyState,
            enabled: t.enabled,
            label: t.label,
        })));

        const combinedStream = new MediaStream([...videoTracks, ...audioTracks]);
        const combinedAudioTracks = combinedStream.getAudioTracks();
        console.debug('[COMBINED AUDIO TRACKS]', combinedAudioTracks.map((t) => ({
            kind: t.kind,
            readyState: t.readyState,
            enabled: t.enabled,
            label: t.label,
        })));
        if (!debugNoAudio && combinedAudioTracks.length === 0) {
            recordingAudio.cleanup?.();
            alert('Nagrywanie przerwane: combinedStream nie zawiera ┼╝adnej ┼Ťcie┼╝ki audio.');
            return false;
        }
        console.log('[VISUS] REC TRACKS', { video: combinedStream.getVideoTracks().length, audio: combinedStream.getAudioTracks().length });
        try {
            const pickMimeType = () => {
                const candidates = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm',
                ];
                return candidates.find(mt => MediaRecorder.isTypeSupported(mt));
            };
            const mimeType = pickMimeType();
            if (!mimeType) {
                alert('MediaRecorder: brak obslugiwanych formatow (mp4/webm).');
                return false;
            }
            const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
            console.debug('[VISUS] MediaRecorder mime selected:', mimeType);
            if (!debugNoAudio && combinedStream.getAudioTracks().length === 0) {
                console.warn('[VISUS] combined stream missing audio track');
                alert('Nagrywanie przerwane: brak aktywnej sciezki audio w strumieniu.');
                return false;
            }
            const safeAudioBps = clampAudioBps(preset.audioBitrate);
            const recorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: preset.videoBitrate,
                audioBitsPerSecond: safeAudioBps,
            });
            recordedChunksRef.current = [];
            recordingStartTsRef.current = performance.now();
            recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
            recorder.onerror = (event) => {
                console.error('[VISUS] MediaRecorder runtime error', event);
            };
            const videoSettings = videoTracks[0]?.getSettings?.();
            console.debug('[REC] requested', {
                mimeType,
                videoBitsPerSecond: preset.videoBitrate,
                audioBitsPerSecond: safeAudioBps,
                tracks: {
                    v: combinedStream.getVideoTracks().map(t => t.getSettings?.()),
                    a: combinedStream.getAudioTracks().map(t => t.getSettings?.()),
                },
            });
            console.debug('[REC PRESET APPLY]', { preset, captureFps });
            console.info('[VISUS] recording start (MediaRecorder)', {
                preset: {
                    id: preset.id,
                    width: preset.width,
                    height: preset.height,
                    fps: preset.fps,
                    videoBitrate: preset.videoBitrate,
                    audioBitrate: safeAudioBps,
                    videoMbps: preset.videoBitrate / 1_000_000,
                    audioKbps: safeAudioBps / 1000,
                },
                mimeType,
                fileExt,
                captureFps,
                videoTrackSettings: videoSettings,
                recorderPath,
                tracks: combinedStream.getTracks().map((t) => ({
                    kind: t.kind,
                    readyState: t.readyState,
                    label: t.label,
                    id: t.id,
                })),
            });
            recorder.onstop = () => {
                    recordingAudio.cleanup?.();
                    stopRecordingCopyLoop();
                    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                    const endTs = performance.now();
                    const durationSec = recordingStartTsRef.current ? (endTs - recordingStartTsRef.current) / 1000 : 0;
                    const effectiveMbps = durationSec > 0 ? (blob.size * 8) / durationSec / 1_000_000 : 0;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const now = new Date();
                    a.download = `VISUS_EXPERIMENTAL_${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}.${fileExt}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                console.info('[VISUS] recording stop (MediaRecorder)', {
                    preset,
                    blobSize: blob.size,
                    durationSec,
                    effectiveMbps,
                    effectiveBps: durationSec > 0 ? (blob.size * 8) / durationSec : 0,
                    targetVideoMbps: preset.videoBitrate / 1_000_000,
                    targetAudioKbps: safeAudioBps / 1000,
                    recorderPath,
                    videoTrackSettings: videoTracks[0]?.getSettings?.(),
                    chunkCount: recordedChunksRef.current.length,
                    mimeType,
                });
                exitRecordingMode();
                    setIsRecording(false);
                    mediaRecorderRef.current = null;
                    recordingBusyRef.current = false;
                    recordingStartTsRef.current = null;
                    setLastRecordingStats({
                        presetId: preset.id,
                        mimeType,
                        fileExt,
                        blobSize: blob.size,
                        durationSec,
                        effectiveMbps,
                        targetVideoMbps: preset.videoBitrate / 1_000_000,
                        targetAudioKbps: safeAudioBps / 1000,
                        videoTrackSettings: videoTracks[0]?.getSettings?.(),
                        effectiveBps: durationSec > 0 ? (blob.size * 8) / durationSec : 0,
                    });
                };
            recorder.start(500);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            console.info('[VISUS] recording start (MediaRecorder)', {
                preset,
                canvas: { width: recCanvas.width, height: recCanvas.height },
                captureFps,
                mimeType,
                videoTrackSettings: videoTracks[0]?.getSettings?.(),
            });
            recordingBusyRef.current = false;
            return true;
        } catch (e) {
            console.error('[VISUS] MediaRecorder error', e);
            recordingAudio.cleanup?.();
            exitRecordingMode();
            recordingBusyRef.current = false;
            alert('Recording failed: ' + e);
            return false;
        }
    };
    const stopActiveRecording = async () => {
        if (recordingBusyRef.current) return;
        recordingBusyRef.current = true;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        } else {
            await stopWebCodecsRecording();
            recordingBusyRef.current = false;
        }
    };

    const toggleRecording = async () => {
        if (recordingBusyRef.current) return;
        if (isRecording) {
            await stopActiveRecording();
            return;
        }

        recordingBusyRef.current = true;
        const preset = recordingPresetRef.current ?? activeRecordingPreset;
        enterRecordingMode(preset);
        const preferWebCodecs = useWebCodecsRecord && webCodecsSupported;
        const useWebCodecsPath = false; // WebCodecs path not yet implemented for muxing; force MediaRecorder
        setRecorderPath(useWebCodecsPath ? 'WebCodecs' : 'MediaRecorder');
        const started = await startMediaRecorderRecording(preset, useWebCodecsPath ? true : false);
        if (!started) {
            exitRecordingMode();
            setIsRecording(false);
            recordingBusyRef.current = false;
        }
    };

    const updateSyncParams = useCallback((index: number, changes: Partial<SyncParam>) => {
        const newParams = [...syncParams];
        newParams[index] = { ...newParams[index], ...changes };
        setSyncParams(newParams);
        if (debugNoAudio) return;
        audioRef.current.updateFilters(newParams);
    }, [syncParams, debugNoAudio]);

    const handleUpdateFilters = useCallback((params: SyncParam[]) => {
        if (debugNoAudio) return;
        audioRef.current.updateFilters(params);
    }, [debugNoAudio]);

    const updateTransform = (key: keyof TransformConfig, value: number) => {
        setTransform(prev => ({ ...prev, [key]: value }));
    };

    const toggleEnvFollower = (enabled: boolean) => {
        setAdditiveEnvConfig(prev => {
            const nextDepth = enabled && prev.depth === 0 ? 0.3 : prev.depth;
            return { ...prev, enabled, depth: enabled ? nextDepth : prev.depth };
        });
    };

    const updateEnvFollower = (changes: Partial<AdditiveEnvConfig>) => {
        setAdditiveEnvConfig(prev => ({ ...prev, ...changes }));
    };

    const setAdditiveFromPointer = useCallback((clientX: number, applyOffset = false) => {
        const slider = additiveSliderRef.current;
        if (!slider) return;
        const rect = slider.getBoundingClientRect();
        if (rect.width <= 0) return;
        const pointerRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const ratio = applyOffset ? pointerRatio + additiveDragOffsetRef.current : pointerRatio;
        const clamped = Math.max(0, Math.min(1, ratio));
        setAdditiveGain(Math.round(clamped * 100));
    }, []);

    const handleAdditivePointerMove = useCallback((ev: PointerEvent) => {
        if (!additiveDraggingRef.current) return;
        ev.preventDefault();
        setAdditiveFromPointer(ev.clientX, true);
    }, [setAdditiveFromPointer]);

    const handleAdditivePointerUp = useCallback(() => {
        additiveDraggingRef.current = false;
        window.removeEventListener('pointermove', handleAdditivePointerMove);
        window.removeEventListener('pointerup', handleAdditivePointerUp);
        window.removeEventListener('pointercancel', handleAdditivePointerUp);
    }, [handleAdditivePointerMove]);

    const handleAdditivePointerDown = useCallback((ev: React.PointerEvent<HTMLDivElement>) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const slider = additiveSliderRef.current;
        if (!slider) return;
        const rect = slider.getBoundingClientRect();
        if (rect.width <= 0) return;
        const pointerRatio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const currentRatio = Math.max(0, Math.min(1, additiveGainRef.current / 100));
        additiveDragOffsetRef.current = currentRatio - pointerRatio;
        additiveDraggingRef.current = true;
        setAdditiveFromPointer(ev.clientX, true);
        window.addEventListener('pointermove', handleAdditivePointerMove);
        window.addEventListener('pointerup', handleAdditivePointerUp);
        window.addEventListener('pointercancel', handleAdditivePointerUp);
    }, [handleAdditivePointerMove, handleAdditivePointerUp, setAdditiveFromPointer]);

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handleAdditivePointerMove);
            window.removeEventListener('pointerup', handleAdditivePointerUp);
            window.removeEventListener('pointercancel', handleAdditivePointerUp);
        };
    }, [handleAdditivePointerMove, handleAdditivePointerUp]);

    const exitToLanding = () => {
        if (isRecording) toggleRecording();
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        onExit();
    };

    const baseNormalizedUi = Math.max(0, Math.min(1, additiveGain / 100));
    const appliedDepth = additiveEnvConfig.enabled ? additiveEnvConfig.depth : 0;

    // same formula as renderLoop:
    let effectiveAdditiveUi = baseNormalizedUi;
    if (appliedDepth > 0) {
        const modUi = (1 - appliedDepth) + appliedDepth * additiveEnvValue;
        effectiveAdditiveUi = baseNormalizedUi * modUi;
    }
    effectiveAdditiveUi = Math.max(0, Math.min(1, effectiveAdditiveUi));
    const basePercent = Math.round(baseNormalizedUi * 100);
    const envPercent = Math.round(additiveEnvValue * 100);
    const effectivePercent = Math.round(effectiveAdditiveUi * 100);
    const depthPercent = Math.round(additiveEnvConfig.depth * 100);
    const envActive = additiveEnvConfig.enabled && additiveEnvConfig.depth > 0;

    return (
        <div className="w-full h-screen overflow-hidden bg-[#010312] relative font-sans text-slate-300 selection:bg-accent selection:text-white">
            <canvas
                ref={canvasRef}
                className={`absolute origin-center ${isMobile && panelVisible ? 'z-50 pointer-events-none' : 'z-10'}`}
                style={{ boxShadow: '0 0 80px rgba(0,0,0,0.5)' }}
            />
            <video
                ref={videoRef}
                className="hidden"
                crossOrigin="anonymous"
                muted={false}
                playsInline
                autoPlay
                onEnded={handleVideoEnded}
            />

            {isBooting && (
                <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur flex items-center justify-center">
                    <div className="px-6 py-4 bg-black/80 border border-white/10 rounded-2xl text-center text-slate-200 shadow-2xl">
                        <div className="text-sm font-semibold mb-2">Loading shaders & audio</div>
                        <div className="text-[11px] text-slate-400">Initializing renderer and FX list</div>
                    </div>
                </div>
            )}

            <PerformanceHUD
                fps={fps}
                dt={lastDtRef.current}
                renderScale={renderScale}
                frameCap={frameCap}
                frameCapMode={frameCapMode}
                renderMode={renderMode}
                performanceMode={performanceMode}
                micActive={mixer.mic.active}
                isRecording={isRecording}
            />
            {devMode && (
                <div className="fixed top-4 left-4 z-50 font-mono text-[10px] text-slate-300 bg-black/70 p-3 rounded-xl border border-white/10 shadow-xl space-y-1">
                    <div>render: {renderMode} (pref: {renderPreference}, worker: {workerPreference ? 'on' : 'off'})</div>
                    <div>probe webgl2/webgl: {webglProbe.webgl2 ? 'Y' : 'N'} / {webglProbe.webgl ? 'Y' : 'N'}</div>
                    <div>fallback: {fallbackReason}</div>
                    <div>shader: {lastShaderError || 'none'}</div>
                </div>
            )}

            {showCatalog && (
                <MusicCatalog onSelect={loadMusicTrack} onClose={() => setShowCatalog(false)} />
            )}
            {showCameraSelector && (
                <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-white font-black tracking-widest text-lg">SELECT CAMERA</h3>
                            <button onClick={() => setShowCameraSelector(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white">x</button>
                        </div>
                        <div className="px-4 py-2 flex gap-2">
                            <button
                                onClick={() => setCameraFacing('environment')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${cameraFacing === 'environment' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setCameraFacing('user')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${cameraFacing === 'user' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                            >
                                Front
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            {availableCameras.map((cam, idx) => (
                                <button key={cam.deviceId} onClick={() => startCamera(cam.deviceId)} className="w-full p-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:bg-accent/20 hover:text-white text-left transition-all flex items-center gap-3 group">
                                    <div className="text-sm font-bold">{cam.label || `Camera ${idx + 1}`}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div ref={uiPanelRef} className={`fixed z-40 glass-panel flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:top-0 md:left-0 md:h-full md:w-[380px] md:border-r md:border-t-0 md:rounded-none ${panelVisible ? 'md:translate-x-0' : 'md:-translate-x-full'} bottom-0 left-0 w-full h-[60vh] rounded-t-3xl border-t border-white/10 ${panelVisible ? 'translate-y-0' : 'translate-y-[110%]'}`}>
                <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setPanelVisible(false)}>
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div className="px-6 py-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-white/10 shadow-lg bg-black flex items-center justify-center overflow-hidden"><img src={ICON_PNG} alt="Logo" className="w-full h-full object-cover" /></div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter leading-none">VISUS</h2>
                            <div className="text-[9px] text-accent font-mono tracking-[0.3em] opacity-80">EXPERIMENTAL ENGINE</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exitToLanding} className="px-3 py-2 text-[10px] rounded-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10">Exit</button>
                        <button onClick={() => setPanelVisible(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">x</button>
                    </div>
                </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-8 pb-24">

                    <section className="space-y-2 sticky top-0 z-50">
                        <div className="backdrop-blur bg-white/5 border border-white/10 rounded-2xl p-3 shadow-lg">
                            <button
                                onClick={toggleRecording}
                                className={`w-full py-3 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-3 tracking-widest ${isRecording ? 'bg-red-500/20 text-red-200 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:border-white/20'}`}
                            >
                                {isRecording ? <span className="animate-pulse flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> RECORDING (WEBM)</span> : <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> REC VIDEO (WEBM)</span>}
                            </button>
                            {(isRecording || recordingLocksRef.current) && (
                                <div className="mt-2 text-[10px] text-slate-200 bg-white/5 border border-white/10 rounded-md px-3 py-2 leading-relaxed">
                                    <div className="font-black tracking-[0.16em] text-[9px] text-accent">RECORDING MODE</div>
                                    {(() => {
                                        const p = recordingPresetRef.current ?? activeRecordingPreset;
                                        const mbps = (p.videoBitrate / 1_000_000).toFixed(1);
                                        const kbps = Math.round(p.audioBitrate / 1000);
                                        return (
                                            <div className="text-slate-200">
                                                {p.width}x{p.height} @ {p.fps} fps · {mbps} Mb/s · {kbps} kbps
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        {useWebCodecsRecord && webCodecsSupported && (
                            <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-md px-3 py-2">
                                WebCodecs can record video-only when no live audio track is present. Disable WebCodecs to force recording with audio.
                            </div>
                        )}
                        {lastRecordingStats && (
                            <div className="mt-2 text-[10px] text-slate-200 bg-white/5 border border-white/10 rounded-md px-3 py-2 leading-relaxed">
                                <div className="font-black tracking-[0.16em] text-[9px] text-slate-400">LAST RECORDING</div>
                                <div className="text-slate-200">Size: {(lastRecordingStats.blobSize / 1_000_000).toFixed(2)} MB</div>
                                <div className="text-slate-200">Dur: {lastRecordingStats.durationSec.toFixed(2)} s</div>
                        <div className="text-slate-200">Eff: {lastRecordingStats.effectiveMbps.toFixed(2)} Mb/s</div>
                        <div className="text-slate-200">Target: {lastRecordingStats.targetVideoMbps.toFixed(1)} Mb/s + {lastRecordingStats.targetAudioKbps} kbps</div>
                        <div className="text-slate-200">Mime: {lastRecordingStats.mimeType}</div>
                        <div className="text-slate-200">Chunks: {lastRecordingStats.chunkCount ?? 0}</div>
                        <div className="text-slate-400 text-[9px]">Windows Explorer może błędnie raportować bitrate WEBM/VPx. Efektywny bitrate powyżej odzwierciedla realne dane.</div>
                    </div>
                )}
                </div>
            </section>

                    <PanelSettings
                        quality={quality}
                        setQuality={setQuality}
                        lockResolution={lockResolution}
                        setLockResolution={setLockResolution}
                        frameCap={frameCap}
                        frameCapMode={frameCapMode}
                        setFrameCap={setFrameCap}
                        setFrameCapMode={setFrameCapMode}
                        performanceMode={performanceMode}
                        setPerformanceMode={setPerformanceMode}
                        uiFpsLimit={uiFpsLimit}
                        setUiFpsLimit={setUiFpsLimit}
                        recordFps={recordFps}
                        setRecordFps={setRecordFps}
                        recordBitrate={recordBitrate}
                        setRecordBitrate={setRecordBitrate}
                        recordResolution={recordResolution}
                        setRecordResolution={setRecordResolution}
                        recordingVideoPresetId={recordingVideoPresetId}
                        setRecordingVideoPresetId={setRecordingVideoPresetId}
                        recordingAudioPresetId={recordingAudioPresetId}
                        setRecordingAudioPresetId={setRecordingAudioPresetId}
                        recordAudioBitrate={recordAudioBitrate}
                        setRecordAudioBitrate={setRecordAudioBitrate}
                        webCodecsSupported={webCodecsSupported}
                        useWebCodecsRecord={useWebCodecsRecord}
                        setUseWebCodecsRecord={setUseWebCodecsRecord}
                        autoScale={autoScale}
                        setAutoScale={setAutoScale}
                        useWorkletFFT={useWorkletFFT}
                        setUseWorkletFFT={setUseWorkletFFT}
                        useVideoFrameCb={useVideoFrameCb}
                        setUseVideoFrameCb={setUseVideoFrameCb}
                    />

<section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                            Source Mixer
                        </div>

                        <div className="flex justify-between gap-2 p-2 bg-black/30 rounded-2xl border border-white/10">
                            <MixerChannel
                                label="VIDEO" icon={ICONS.Video}
                                isActive={mixer.video.active}
                                volume={mixer.video.volume}
                                vuLevel={vuLevels.video}
                                isPlaying={mixer.video.playing}
                                onToggle={handleVideoToggle}
                                onVolumeChange={handleVideoVolume}
                                onPlayPause={playPauseVideo}
                                onStop={stopVideo}
                            color="#38bdf8"
                        >
                            <div className="flex gap-1 w-full justify-between">
                                <label className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded cursor-pointer flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Open Video File(s)">
                                    {ICONS.Folder}
                                    <input
                                        type="file"
                                        accept="video/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            addFilesToPlaylist(e.target.files);
                                            // opcjonalnie: stary pojedynczy load, gdybyś chciał zachować kompatybilność
                                            // handleFile('video', e);
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                                <button onClick={initCamera} className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Select Camera">
                                    {ICONS.Camera}
                                </button>
                            </div>
                        </MixerChannel>

                            <MixerChannel
                                label="MUSIC" icon={ICONS.Music}
                                isActive={mixer.music.active}
                                volume={mixer.music.volume}
                                vuLevel={vuLevels.music}
                                isPlaying={mixer.music.playing}
                                onToggle={handleMusicToggle}
                                onVolumeChange={handleMusicVolume}
                                onPlayPause={playPauseMusic}
                                onStop={stopMusic}
                                color="#f472b6"
                            >
                                <div className="flex gap-1 w-full justify-between">
                                    <label className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded cursor-pointer flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Open Audio File">
                                        {ICONS.Folder}
                                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile('audio', e)} />
                                    </label>
                                    <button onClick={() => setShowCatalog(true)} className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Search iTunes">
                                        {ICONS.Globe}
                                    </button>
                                </div>
                            </MixerChannel>

                            <MixerChannel
                                label="MIC" icon={ICONS.Mic}
                                isActive={mixer.mic.active}
                                volume={mixer.mic.volume}
                                vuLevel={vuLevels.mic}
                                onToggle={toggleMic}
                                onVolumeChange={handleMicVolume}
                                color="#ef4444"
                            />
                        </div>

                        {mixer.music.name && (
                            <div className="mt-2 text-center text-[9px] text-accent truncate px-2 bg-accent/5 rounded py-1 border border-accent/20">
                                {`>> ${mixer.music.name}`}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                                Playlist
                            </div>
                            <div className="flex items-center gap-1 text-[9px]">
                                <button
                                    onClick={() => setPlaylistModeSafe('sequential')}
                                    className={`px-2 py-1 rounded border ${playlistMode === 'sequential' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                                >
                                    Seq
                                </button>
                                <button
                                    onClick={() => setPlaylistModeSafe('random')}
                                    className={`px-2 py-1 rounded border ${playlistMode === 'random' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                                >
                                    Rand
                                </button>
                                <label className="flex items-center gap-1 ml-2">
                                    <input
                                        type="checkbox"
                                        className="accent-accent"
                                        checked={playlistAvoidRepeat}
                                        onChange={(e) => setPlaylistAvoidRepeatSafe(e.target.checked)}
                                    />
                                    <span className="text-[9px] text-slate-400">No repeat</span>
                                </label>
                            </div>
                        </div>

                        <div className="bg-black/30 rounded-2xl border border-white/10 px-3 py-2 space-y-1 text-[10px]">
                            <div className="flex justify-between gap-2">
                                <div className="flex-1 truncate">
                                    <span className="text-slate-500 mr-1">Now:</span>
                                    <span className="text-accent">
                                        {playlistCurrentIndex != null && playlist[playlistCurrentIndex]
                                            ? playlist[playlistCurrentIndex].name
                                            : '–'}
                                    </span>
                                </div>
                                <div className="flex-1 truncate text-right">
                                    <span className="text-slate-500 mr-1">Next:</span>
                                    <span className="text-slate-300">
                                        {playlistNextIndex != null && playlist[playlistNextIndex]
                                            ? playlist[playlistNextIndex].name
                                            : '–'}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={skipPlaylistClip}
                                className="mt-1 w-full py-2 rounded-xl text-[10px] font-semibold border bg-white/5 hover:bg-white/10 text-slate-200 flex items-center justify-center gap-2"
                                disabled={!playlist.length}
                            >
                                <span className="text-xs">SKIP →</span>
                            </button>
                        </div>

                        {playlist.length > 0 && (
                            <div className="mt-2 max-h-24 overflow-y-auto custom-scrollbar text-[9px] bg-black/20 rounded-xl border border-white/5">
                                {playlist.map((item, idx) => (
                                    <div key={item.id} className="flex items-center gap-2 border-b border-white/5 last:border-b-0">
    <button
        onClick={() => loadPlaylistClip(idx)}
        className={`flex-1 text-left px-3 py-1.5 truncate ${
            idx === playlistCurrentIndex ? 'bg-white/10 text-accent' : 'bg-transparent text-slate-300 hover:bg-white/5'
        }`}
        title={item.name}
        type="button"
    >
        {idx === playlistCurrentIndex ? '▶ ' : ''}{item.name}
    </button>
    <button
        type="button"
        title="Usuń z playlisty"
        aria-label={`Usuń ${item.name}`}
        className="shrink-0 w-7 h-7 mr-2 rounded-lg text-slate-300 hover:text-red-300 hover:bg-white/5"
        onClick={(e) => { e.stopPropagation(); removePlaylistItem(idx); }}
    >
        ✕
    </button>
</div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            Output &amp; Framing
                        </div>
                        <div className="grid grid-cols-3 gap-1 mb-3">
                            {['native', '16:9', '9:16', '4:5', '1:1', 'fit'].map(r => (
                                <button key={r} onClick={() => setAspectRatio(r as AspectRatioMode)} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === r ? 'bg-accent text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>{r.toUpperCase()}</button>
                            ))}
                        </div>

                        <div className="bg-black/20 p-3 rounded-xl border border-white/5 mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[9px] text-slate-500 font-bold tracking-wider">GEOMETRY</div>
                                <button
                                    onClick={() => setIsMirrored(!isMirrored)}
                                    className={`flex items-center gap-2 px-2 py-1 rounded text-[9px] font-bold border ${isMirrored ? 'bg-accent/20 border-accent text-accent' : 'bg-white/5 border-white/5 text-slate-400'}`}
                                >
                                    {ICONS.Mirror} MIRROR
                                </button>
                            </div>
                            <div className="flex justify-around items-center">
                                <Knob
                                    label="Scale" value={transform.scale}
                                    min={0.1} max={3.0} step={0.05}
                                    onChange={(v) => updateTransform('scale', v)}
                                    format={(v) => v.toFixed(2)} color="#2dd4bf"
                                />
                                <Knob
                                    label="Pan X" value={transform.x}
                                    min={-1.0} max={1.0} step={0.05}
                                    onChange={(v) => updateTransform('x', v)}
                                    format={(v) => v.toFixed(1)} color="#2dd4bf"
                                />
                                <Knob
                                    label="Pan Y" value={transform.y}
                                    min={-1.0} max={1.0} step={0.05}
                                    onChange={(v) => updateTransform('y', v)}
                                    format={(v) => v.toFixed(1)} color="#2dd4bf"
                                />
                            </div>
                        </div>

                    </section>

                    <section>
                        <SpectrumVisualizer
                            audioServiceRef={audioRef}
                            syncParams={syncParams}
                            onParamChange={updateSyncParams}
                            enabled={mixer.video.active || mixer.music.active || mixer.mic.active}
                        />
                        <BandControls syncParams={syncParams} setSyncParams={setSyncParams} onUpdateFilters={handleUpdateFilters} />
                    </section>

                    <section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                                FX Chain
                            </div>
                            <div className="text-right leading-tight">
                                <div className="text-[9px] text-slate-500">Additive</div>
                                <div className="text-[11px] text-accent font-semibold">{effectivePercent}%</div>
                            </div>
                        </div>
                        <FxSlot category="main" slotName="main" fxState={fxState} setFxState={setFxState} activeLevel={visualLevels.main} vuLevel={fxVuLevels.main} />
                        <div className="space-y-2 mt-4">
                            {['fx1', 'fx2', 'fx3', 'fx4', 'fx5'].map((fxName, i) => (
                                <FxSlot
                                    key={fxName}
                                    category="additive"
                                    title={`Layer ${i + 1}`}
                                    slotName={fxName as keyof FxState}
                                    fxState={fxState}
                                    setFxState={setFxState}
                                    activeLevel={(visualLevels as any)[fxName]}
                                    vuLevel={(fxVuLevels as any)[fxName]}
                                />
                            ))}
                        </div>
                        <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-[0.25em]">Additive Master</div>
                                    <div className="text-sm font-semibold text-white">Effective {effectivePercent}%</div>
                                    <div className="text-[9px] text-slate-500">Env {envPercent}% | Base {basePercent}%</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={additiveEnvConfig.enabled}
                                        onChange={(e) => toggleEnvFollower(e.target.checked)}
                                    />
                                    <div className="w-10 h-5 bg-slate-800 rounded-full peer-focus:outline-none peer peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-white shadow-inner"></div>
                                    <span className="ml-2 text-[10px] text-slate-400 font-semibold">Env</span>
                                </label>
                            </div>

                            <div
                                className="relative h-8 cursor-pointer select-none"
                                ref={additiveSliderRef}
                                onPointerDown={handleAdditivePointerDown}
                            >
                                <div className="absolute inset-0 flex items-center">
                                    <div className="relative w-full h-1 bg-slate-800/80 rounded-full overflow-visible">
                                        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/30" style={{ width: `${basePercent}%` }}></div>
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5.5 h-5.5 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.55)] border border-slate-900/70 flex items-center justify-center"
                                            style={{ left: `${basePercent}%` }}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] pointer-events-none" />
                                        </div>
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-3 rounded-full bg-accent/70 shadow-[0_0_6px_rgba(167,139,250,0.5)]"
                                            style={{ left: `${effectivePercent}%`, opacity: envActive ? 0.8 : 0.3 }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[9px] text-slate-500 flex justify-between mb-1">
                                        <span>Depth</span>
                                        <span className="text-slate-400">{depthPercent}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={Math.round(additiveEnvConfig.depth * 100)}
                                        onChange={(e) => updateEnvFollower({ depth: parseInt(e.target.value, 10) / 100 })}
                                        className="w-full accent-accent"
                                        disabled={!additiveEnvConfig.enabled}
                                    />
                                </div>
                                <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between">
                                    <div className="text-[9px] text-slate-500">Source</div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => updateEnvFollower({ source: 'RMS' })}
                                            className={`px-2 py-1 rounded text-[10px] font-semibold border ${additiveEnvConfig.source === 'RMS' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                                            disabled={!additiveEnvConfig.enabled}
                                        >
                                            RMS
                                        </button>
                                        <button
                                            onClick={() => updateEnvFollower({ source: 'PEAK' })}
                                            className={`px-2 py-1 rounded text-[10px] font-semibold border ${additiveEnvConfig.source === 'PEAK' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                                            disabled={!additiveEnvConfig.enabled}
                                        >
                                            Peak
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <button
                                    onClick={() => setShowEnvAdvanced(!showEnvAdvanced)}
                                    className="px-3 py-2 rounded-lg text-[10px] font-semibold bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2"
                                >
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: envActive ? '#a855f7' : '#475569' }}></span>
                                    {showEnvAdvanced ? 'Hide Advanced' : 'Advanced'}
                                </button>
                                <div className={`text-[9px] ${envActive ? 'text-accent' : 'text-slate-500'}`}>
                                    {envActive ? 'Following envelope' : 'Static mix'}
                                </div>
                            </div>

                            {showEnvAdvanced && (
                                <div className={`space-y-3 ${!additiveEnvConfig.enabled ? 'opacity-60' : ''}`}>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Knob
                                            label="Attack"
                                            value={additiveEnvConfig.attackMs}
                                            min={0.5}
                                            max={200}
                                            step={0.5}
                                            onChange={(v) => updateEnvFollower({ attackMs: v })}
                                            format={(v) => `${v.toFixed(1)}ms`}
                                            color="#a855f7"
                                        />
                                        <Knob
                                            label="Release"
                                            value={additiveEnvConfig.releaseMs}
                                            min={10}
                                            max={2000}
                                            step={10}
                                            onChange={(v) => updateEnvFollower({ releaseMs: v })}
                                            format={(v) => `${Math.round(v)}ms`}
                                            color="#a855f7"
                                        />
                                        <Knob
                                            label="Delay"
                                            value={additiveEnvConfig.delayMs}
                                            min={0}
                                            max={200}
                                            step={1}
                                            onChange={(v) => updateEnvFollower({ delayMs: v })}
                                            format={(v) => `${Math.round(v)}ms`}
                                            color="#22d3ee"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <Knob
                                            label="Gain"
                                            value={additiveEnvConfig.gain}
                                            min={0}
                                            max={2}
                                            step={0.05}
                                            onChange={(v) => updateEnvFollower({ gain: v })}
                                            format={(v) => `${Math.round(v * 100)}%`}
                                            color="#22d3ee"
                                        />
                                        <Knob
                                            label="Offset"
                                            value={additiveEnvConfig.offset}
                                            min={-1}
                                            max={1}
                                            step={0.05}
                                            onChange={(v) => updateEnvFollower({ offset: v })}
                                            format={(v) => `${Math.round(v * 50)}%`}
                                            color="#38bdf8"
                                        />
                                        <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 flex flex-col justify-between">
                                            <div className="text-[9px] text-slate-500 mb-1">Mode</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => updateEnvFollower({ mode: 'normal' })}
                                                    className={`flex-1 py-1 rounded text-[10px] font-semibold border ${additiveEnvConfig.mode === 'normal' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                                                    disabled={!additiveEnvConfig.enabled}
                                                >
                                                    Normal
                                                </button>
                                                <button
                                                    onClick={() => updateEnvFollower({ mode: 'invert' })}
                                                    className={`flex-1 py-1 rounded text-[10px] font-semibold border ${additiveEnvConfig.mode === 'invert' ? 'bg-accent text-black border-transparent' : 'bg-white/5 text-slate-400 border-white/10'}`}
                                                    disabled={!additiveEnvConfig.enabled}
                                                >
                                                    Invert
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                                        <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                                            <span>Shape</span>
                                            <span className="text-slate-400">{additiveEnvConfig.shape >= 0 ? 'Sharp' : 'Smooth'}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={-1}
                                            max={1}
                                            step={0.05}
                                            value={additiveEnvConfig.shape}
                                            onChange={(e) => updateEnvFollower({ shape: parseFloat(e.target.value) })}
                                            className="w-full accent-accent"
                                            disabled={!additiveEnvConfig.enabled}
                                        />
                                        <div className="flex justify-between text-[8px] text-slate-500">
                                            <span>Smooth</span>
                                            <span>Sharp</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-2">
                                <div className="text-[9px] text-slate-500 mb-1">Envelope Preview (1s)</div>
                                <canvas ref={envCanvasRef} className="w-full h-16 rounded-lg border border-white/10 bg-black/40" />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {!panelVisible && (
                <button onClick={() => setPanelVisible(true)} className="fixed bottom-8 left-8 z-50 bg-slate-900/80 border border-white/10 hover:border-accent hover:text-accent text-white w-14 h-14 flex items-center justify-center rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur transition-all hover:scale-110 group">
                    <span className="text-white group-hover:text-accent group-hover:rotate-90 transition-all duration-500">{ICONS.Settings}</span>
                </button>
            )}
            <Credits />
        </div>
    );
};

class VisusErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(err: any) {
        console.error('[VISUS] Render error (boundary)', err);
        return { hasError: true };
    }
    componentDidCatch(err: any, info: any) {
        console.error('[VISUS] Render error info', err, info);
    }
    render() {
        if (this.state.hasError) {
            return <div className="w-full h-screen flex items-center justify-center bg-slate-900 text-slate-100">VISUS Render Error</div>;
        }
        return this.props.children;
    }
}

const ExperimentalApp: React.FC<ExperimentalProps> = (props) => {
    const debugInitMode = getDebugInitMode();
    if (debugInitMode === 'mock') return <ExperimentalAppMock {...props} />;
    if (debugInitMode === 'layout') return <ExperimentalAppLayout {...props} />;

    const [bootRequested, setBootRequested] = useState<boolean>(props.bootRequested ?? false);
    useEffect(() => {
        if (props.bootRequested) setBootRequested(true);
    }, [props.bootRequested]);

    const handleExit = useCallback(() => {
        setBootRequested(false);
        props.onExit();
    }, [props.onExit]);

    if (!bootRequested) {
        return <InitOverlay onInitialize={() => setBootRequested(true)} />;
    }

    return (
        <VisusErrorBoundary>
            <ExperimentalAppFull onExit={handleExit} bootRequested={bootRequested} />
        </VisusErrorBoundary>
    );
};

export default ExperimentalApp;
