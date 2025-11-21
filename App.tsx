
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GLService } from './services/glService';
import { AudioEngine } from './services/audioService';
import { FxState, SyncParam, AspectRatioMode } from './types';
import { SHADER_LIST } from './constants';
import FxSlot from './components/FxSlot';
import BandControls from './components/BandControls';
import SpectrumVisualizer from './components/SpectrumVisualizer';

const App: React.FC = () => {
    // --- REFS ---
    const glService = useRef<GLService>(new GLService());
    const audioService = useRef<AudioEngine>(new AudioEngine());
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiPanelRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    
    // --- STATE ---
    const [isSystemActive, setIsSystemActive] = useState(false);
    const [fps, setFps] = useState(0);
    const [panelVisible, setPanelVisible] = useState(true);
    
    // FR-105: Manual Resolution
    const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('fit');
    const [manualRes, setManualRes] = useState({ w: 1920, h: 1080 });

    const [visualLevels, setVisualLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });

    const [syncParams, setSyncParams] = useState<SyncParam[]>([
        { bpm: 128.0, offset: 0, freq: 60, width: 30 },
        { bpm: 128.0, offset: 0, freq: 800, width: 40 }, 
        { bpm: 128.0, offset: 0, freq: 6000, width: 40 },
    ]);

    // Default preset to show off new features
    const [fxState, setFxState] = useState<FxState>({
        main: { shader: '16_STEAM_ENGINE', routing: 'off', gain: 80, mix: 100 }, // New Steampunk main
        fx1: { shader: '7_VHS_RETRO', routing: 'off', gain: 50 }, // Always on VHS look
        fx2: { shader: '9_SCANLINES', routing: 'sync1', gain: 100 }, // Bass kicks scanlines
        fx3: { shader: '8_STEAM_COLOR', routing: 'off', gain: 60 }, // Sepia tint
        fx4: { shader: '5_BRIGHT_FLASH', routing: 'sync2', gain: 120 }, // Snare flashes
        fx5: { shader: '3_GLITCH_LINES', routing: 'sync3', gain: 150 }, // Hats glitch
    });

    // --- LOGIC ---

    const getActivationLevel = (routing: string, phase: number) => {
        if (routing === 'off') return 1.0; // Manual Mode is controlled via Gain Slider directly
        if (routing === 'bpm') return (phase < 0.15) ? 1.0 : 0.0;
        
        const ae = audioService.current;
        if (routing === 'sync1') return ae.bands.sync1;
        if (routing === 'sync2') return ae.bands.sync2;
        if (routing === 'sync3') return ae.bands.sync3;
        return 0;
    };

    const handleResize = useCallback(() => {
        if (!canvasRef.current) return;
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        let finalW = w;
        let finalH = h;

        if (aspectRatio === '16:9') {
            if (w / h > 16 / 9) finalW = h * (16 / 9);
            else finalH = w * (9 / 16);
        } else if (aspectRatio === '9:16') {
            if (w / h > 9 / 16) finalW = h * (9 / 16);
            else finalH = w * (16 / 9);
        } else if (aspectRatio === 'manual') {
            // FR-105: Use manual values
            finalW = manualRes.w;
            finalH = manualRes.h;
        }

        // Limit minimum size to avoid WebGL errors
        if (finalW < 1) finalW = 10;
        if (finalH < 1) finalH = 10;

        // Center the canvas (Visually)
        // If manual is larger than screen, it will scale down via CSS object-fit typically, 
        // but here we are setting physical pixels. CSS transform scales it to fit.
        const canvas = canvasRef.current;
        canvas.width = finalW;
        canvas.height = finalH;

        // CSS for centering
        const scale = Math.min(w / finalW, h / finalH);
        // If manual mode is huge, we scale it down visually to fit screen
        const displayW = aspectRatio === 'manual' ? finalW * scale : finalW;
        const displayH = aspectRatio === 'manual' ? finalH * scale : finalH;

        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        canvas.style.position = 'absolute';
        canvas.style.left = `${(w - displayW) / 2}px`;
        canvas.style.top = `${(h - displayH) / 2}px`;

        glService.current.resize(finalW, finalH);
    }, [aspectRatio, manualRes]);

    const loop = useCallback((t: number) => {
        if (!isSystemActive) return;

        // 1. Update Audio
        const ae = audioService.current;
        ae.update(); 

        // 2. Calculate Timings
        const bpm = syncParams[0].bpm;
        const offset = syncParams[0].offset;
        const beatMs = 60000 / bpm;
        const adjustedTime = t - offset;
        const phase = (adjustedTime % beatMs) / beatMs;

        // 3. Compute FX Values
        const computeFxVal = (config: any) => {
            const sourceLevel = getActivationLevel(config.routing, phase);
            const gainMult = config.gain / 100;
            // Allow overdrive up to 2.0 for intense effects
            return sourceLevel * gainMult * 2.0; 
        };

        const lvls = {
            main: computeFxVal(fxState.main),
            fx1: computeFxVal(fxState.fx1),
            fx2: computeFxVal(fxState.fx2),
            fx3: computeFxVal(fxState.fx3),
            fx4: computeFxVal(fxState.fx4),
            fx5: computeFxVal(fxState.fx5),
        };

        const computedFx = {
            mainFXGain: lvls.main,
            mix: fxState.main.mix,
            fx1: lvls.fx1,
            fx2: lvls.fx2,
            fx3: lvls.fx3,
            fx4: lvls.fx4,
            fx5: lvls.fx5,
            fx1_id: SHADER_LIST[fxState.fx1.shader]?.id || 0,
            fx2_id: SHADER_LIST[fxState.fx2.shader]?.id || 0,
            fx3_id: SHADER_LIST[fxState.fx3.shader]?.id || 0,
            fx4_id: SHADER_LIST[fxState.fx4.shader]?.id || 0,
            fx5_id: SHADER_LIST[fxState.fx5.shader]?.id || 0,
        };

        // 4. Draw
        if (videoRef.current) {
            glService.current.updateTexture(videoRef.current);
            glService.current.draw(t, videoRef.current, computedFx);
        }

        // 5. UI & FPS Update
        if (t - lastTimeRef.current > 100) {
             setFps(Math.round(1000 / ((t - lastTimeRef.current) / ((t - lastTimeRef.current) > 200 ? 1 : 1))));
             setVisualLevels({
                 main: lvls.main,
                 fx1: lvls.fx1, fx2: lvls.fx2, fx3: lvls.fx3, fx4: lvls.fx4, fx5: lvls.fx5
             });
             lastTimeRef.current = t;
        }

        animationFrameRef.current = requestAnimationFrame(loop);
    }, [isSystemActive, syncParams, fxState]);

    // --- EFFECTS ---

    // Init System
    useEffect(() => {
        if (isSystemActive && canvasRef.current) {
            const success = glService.current.init(canvasRef.current);
            if (success) {
                const shaderDef = SHADER_LIST[fxState.main.shader];
                const src = shaderDef ? shaderDef.src : SHADER_LIST['00_NONE'].src;
                glService.current.loadShader(src);
                window.addEventListener('resize', handleResize);
                handleResize();
                animationFrameRef.current = requestAnimationFrame(loop);
                return () => {
                    window.removeEventListener('resize', handleResize);
                    cancelAnimationFrame(animationFrameRef.current);
                };
            }
        }
    }, [isSystemActive]); // removed handleResize to prevent loop

    useEffect(() => {
        if(isSystemActive) handleResize();
    }, [aspectRatio, manualRes, isSystemActive, handleResize]);

    useEffect(() => {
        if (isSystemActive) {
            const shaderDef = SHADER_LIST[fxState.main.shader];
            if (shaderDef) {
                glService.current.loadShader(shaderDef.src);
            } else {
                // Fallback if shader key is invalid/missing
                glService.current.loadShader(SHADER_LIST['00_NONE'].src);
            }
        }
    }, [fxState.main.shader, isSystemActive]);

    // --- HANDLERS ---

    const handleFile = (type: 'video' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            if (type === 'video' && videoRef.current) {
                videoRef.current.src = url;
                videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
            } else if (type === 'audio') {
                const audio = new Audio();
                audio.src = url;
                audio.loop = true;
                audio.crossOrigin = 'anonymous';
                // FR-102: Create new instance
                audioService.current.init(audio).then(() => {
                    audioService.current.setupFilters();
                    audio.play().catch(e => console.log("Auto-play prevented", e));
                });
            }
        }
    };

    // FR-103: Transport Controls
    const handleTransport = (action: 'play' | 'stop' | 'reset') => {
        const vid = videoRef.current;
        const aud = audioService.current.src?.mediaElement;

        if (action === 'play') {
            if (vid) vid.play();
            if (aud) aud.play();
        } else if (action === 'stop') {
            if (vid) vid.pause();
            if (aud) aud.pause();
        } else if (action === 'reset') {
            if (vid) vid.currentTime = 0;
            if (aud) aud.currentTime = 0;
        }
    };

    if (!isSystemActive) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-black">
                <div className="text-center p-10 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-accent/5 pointer-events-none"></div>
                    <h1 className="text-5xl font-black mb-2 text-white tracking-tighter">VJ REACTOR</h1>
                    <div className="text-accent font-mono text-xs tracking-[0.3em] mb-8">VISUAL ENGINE V24</div>
                    <button 
                        className="px-10 py-4 bg-white text-black font-bold rounded hover:bg-accent hover:scale-105 transition-all duration-200 tracking-widest text-sm"
                        onClick={() => setIsSystemActive(true)}
                    >
                        INITIALIZE SYSTEM
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden bg-[#050505] relative">
            {/* Canvas */}
            <canvas ref={canvasRef} className="absolute z-10 origin-center" style={{boxShadow: '0 0 50px rgba(0,0,0,0.8)'}} />
            
            <video ref={videoRef} className="hidden" crossOrigin="anonymous" loop muted playsInline />

            <div className="fixed top-4 right-4 z-50 font-mono text-[10px] text-gray-500 flex gap-4 bg-black/50 p-1 rounded backdrop-blur">
                <span className={fps < 55 ? 'text-red-500' : 'text-accent'}>FPS: {fps}</span>
                <span>RES: {canvasRef.current?.width}x{canvasRef.current?.height}</span>
            </div>

            {/* Main UI Panel */}
            <div 
                ref={uiPanelRef}
                className={`fixed top-0 left-0 h-full w-[380px] bg-[#08080a]/95 backdrop-blur-md border-r border-zinc-800 z-40 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${panelVisible ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="p-4 border-b border-zinc-800 bg-black/40 flex justify-between items-center">
                    <div>
                        <h2 className="text-sm font-black text-white tracking-widest">VJ REACTOR</h2>
                        <div className="text-[9px] text-gray-500 font-mono">AUDIO REACTIVE PIPELINE</div>
                    </div>
                    <button onClick={() => setPanelVisible(false)} className="text-gray-500 hover:text-white px-2">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    
                    {/* 1. Source & Transport */}
                    <div className="mb-6 border border-zinc-800 rounded p-3 bg-zinc-900/20">
                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-accent rounded-full"></span> Sources & Transport
                        </div>
                        
                        {/* FR-103: Transport Controls */}
                        <div className="flex gap-1 mb-3">
                             <button onClick={() => handleTransport('play')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-accent font-bold py-2 rounded text-xs">▶ PLAY</button>
                             <button onClick={() => handleTransport('stop')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded text-xs">■ STOP</button>
                             <button onClick={() => handleTransport('reset')} className="w-10 bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold py-2 rounded text-xs">↺</button>
                        </div>

                        <div className="flex gap-2 mb-3">
                             <label className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-center py-3 rounded text-[10px] font-bold cursor-pointer border border-zinc-700 hover:border-accent text-gray-300 transition-all">
                                🎬 VIDEO
                                <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile('video', e)} />
                            </label>
                            <label className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-center py-3 rounded text-[10px] font-bold cursor-pointer border border-zinc-700 hover:border-sync2 text-gray-300 transition-all">
                                🎵 AUDIO
                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile('audio', e)} />
                            </label>
                        </div>

                        {/* FR-105: Aspect Ratio Controls */}
                        <div className="flex flex-col gap-2 bg-black p-2 rounded border border-zinc-800">
                            <div className="flex gap-1">
                                {(['fit', '16:9', '9:16', 'manual'] as AspectRatioMode[]).map((ratio) => (
                                    <button 
                                        key={ratio}
                                        onClick={() => setAspectRatio(ratio)}
                                        className={`flex-1 py-1 text-[9px] font-bold uppercase rounded ${aspectRatio === ratio ? 'bg-zinc-700 text-white ring-1 ring-accent' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                            {aspectRatio === 'manual' && (
                                <div className="flex gap-2 mt-1">
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[8px] text-gray-500">WIDTH</label>
                                        <input 
                                            type="number" 
                                            value={manualRes.w} 
                                            onChange={(e) => setManualRes(p => ({...p, w: parseInt(e.target.value) || 100}))}
                                            className="bg-zinc-900 text-white text-[10px] p-1 rounded border border-zinc-700"
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-[8px] text-gray-500">HEIGHT</label>
                                        <input 
                                            type="number" 
                                            value={manualRes.h} 
                                            onChange={(e) => setManualRes(p => ({...p, h: parseInt(e.target.value) || 100}))}
                                            className="bg-zinc-900 text-white text-[10px] p-1 rounded border border-zinc-700"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Analysis */}
                    <BandControls 
                        syncParams={syncParams} 
                        setSyncParams={setSyncParams} 
                        onUpdateFilters={(p) => audioService.current.updateFilters(p)}
                    />
                    <SpectrumVisualizer audioServiceRef={audioService} syncParams={syncParams} />

                    {/* 3. Main FX */}
                    <div className="mb-6 mt-6">
                        <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 pl-1 flex justify-between">
                            <span>3. Main Scene (Complex)</span>
                            {visualLevels.main > 0.1 && <span className="text-[8px] animate-pulse text-accent">ACTIVE</span>}
                        </div>
                        <FxSlot category="main" slotName="main" fxState={fxState} setFxState={setFxState} activeLevel={visualLevels.main} />
                    </div>

                    {/* 4. Additive FX */}
                    <div className="mb-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1 border-t border-zinc-800 pt-4">
                            4. Additive Stack (5 Slots)
                        </div>
                        {['fx1', 'fx2', 'fx3', 'fx4', 'fx5'].map((fxName, i) => (
                            <FxSlot 
                                key={fxName}
                                category="additive" 
                                title={`Slot ${i+1}`} 
                                slotName={fxName as keyof FxState} 
                                fxState={fxState} 
                                setFxState={setFxState} 
                                activeLevel={(visualLevels as any)[fxName]} 
                            />
                        ))}
                    </div>

                    <div className="h-16"></div>
                </div>
            </div>

            {!panelVisible && (
                <button 
                    onClick={() => setPanelVisible(true)}
                    className="fixed bottom-6 left-6 z-50 bg-black border border-zinc-700 hover:border-accent text-white p-3 rounded-full shadow-2xl transition-all group"
                >
                    <span className="text-xl">☰</span>
                </button>
            )}
        </div>
    );
};

export default App;
