
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GLService } from './services/glService';
import { AudioEngine } from './services/audioService';
import { FxState, SyncParam, AspectRatioMode } from './types';
import { SHADER_LIST } from './constants';
import FxSlot from './components/FxSlot';
import BandControls from './components/BandControls';
import SpectrumVisualizer from './components/SpectrumVisualizer';
import MusicCatalog from './components/MusicCatalog';

const App: React.FC = () => {
    // --- REFS ---
    const glService = useRef<GLService>(new GLService());
    const audioService = useRef<AudioEngine>(new AudioEngine());
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentAudioElRef = useRef<HTMLAudioElement | null>(null); // Track active audio
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiPanelRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    
    // Recording Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // --- STATE ---
    const [isSystemActive, setIsSystemActive] = useState(false);
    const [fps, setFps] = useState(0);
    const [panelVisible, setPanelVisible] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const [currentTrackName, setCurrentTrackName] = useState<string | null>(null);
    
    // FR-105: Manual Resolution
    const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('fit');
    const [manualRes, setManualRes] = useState({ w: 1920, h: 1080 });

    const [visualLevels, setVisualLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });

    const [syncParams, setSyncParams] = useState<SyncParam[]>([
        { bpm: 128.0, offset: 0, freq: 60, width: 30, gain: 1.0 },
        { bpm: 128.0, offset: 0, freq: 800, width: 40, gain: 1.0 }, 
        { bpm: 128.0, offset: 0, freq: 6000, width: 40, gain: 1.0 },
    ]);

    // Reset to NONE by default for a clean slate
    const [fxState, setFxState] = useState<FxState>({
        main: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
        fx1: { shader: '00_NONE', routing: 'off', gain: 100 }, 
        fx2: { shader: '00_NONE', routing: 'off', gain: 100 }, 
        fx3: { shader: '00_NONE', routing: 'off', gain: 100 }, 
        fx4: { shader: '00_NONE', routing: 'off', gain: 100 }, 
        fx5: { shader: '00_NONE', routing: 'off', gain: 100 }, 
    });

    const fxStateRef = useRef(fxState);
    const syncParamsRef = useRef(syncParams);
    const isSystemActiveRef = useRef(isSystemActive);

    useEffect(() => { fxStateRef.current = fxState; }, [fxState]);
    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { isSystemActiveRef.current = isSystemActive; }, [isSystemActive]);

    const getActivationLevel = (routing: string, phase: number) => {
        if (routing === 'off') return 1.0;
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
            finalW = manualRes.w;
            finalH = manualRes.h;
        }

        if (finalW < 1) finalW = 10;
        if (finalH < 1) finalH = 10;

        const canvas = canvasRef.current;
        canvas.width = finalW;
        canvas.height = finalH;

        const scale = Math.min(w / finalW, h / finalH);
        const displayW = aspectRatio === 'manual' ? finalW * scale : finalW;
        const displayH = aspectRatio === 'manual' ? finalH * scale : finalH;

        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        canvas.style.position = 'absolute';
        canvas.style.left = `${(w - displayW) / 2}px`;
        canvas.style.top = `${(h - displayH) / 2}px`;

        glService.current.resize(finalW, finalH);
    }, [aspectRatio, manualRes]);

    useEffect(() => {
        if (!isSystemActive) return;

        if (canvasRef.current) {
            const success = glService.current.init(canvasRef.current);
            if (!success) return;
            const currentShaderKey = fxStateRef.current.main.shader;
            const shaderDef = SHADER_LIST[currentShaderKey] || SHADER_LIST['00_NONE'];
            glService.current.loadShader(shaderDef.src);
        }

        handleResize();
        window.addEventListener('resize', handleResize);

        const loop = (t: number) => {
            if (!isSystemActiveRef.current) return;

            const ae = audioService.current;
            ae.update(); 

            const currentSyncParams = syncParamsRef.current;
            const currentFxState = fxStateRef.current;

            const bpm = currentSyncParams[0].bpm;
            const offset = currentSyncParams[0].offset;
            const beatMs = 60000 / bpm;
            const adjustedTime = t - offset;
            const phase = (adjustedTime % beatMs) / beatMs;

            const computeFxVal = (config: any) => {
                const sourceLevel = getActivationLevel(config.routing, phase);
                const gainMult = config.gain / 100;
                return sourceLevel * gainMult * 2.0; 
            };

            const lvls = {
                main: computeFxVal(currentFxState.main),
                fx1: computeFxVal(currentFxState.fx1),
                fx2: computeFxVal(currentFxState.fx2),
                fx3: computeFxVal(currentFxState.fx3),
                fx4: computeFxVal(currentFxState.fx4),
                fx5: computeFxVal(currentFxState.fx5),
            };

            const computedFx = {
                mainFXGain: lvls.main,
                mix: currentFxState.main.mix,
                fx1: lvls.fx1,
                fx2: lvls.fx2,
                fx3: lvls.fx3,
                fx4: lvls.fx4,
                fx5: lvls.fx5,
                fx1_id: SHADER_LIST[currentFxState.fx1.shader]?.id || 0,
                fx2_id: SHADER_LIST[currentFxState.fx2.shader]?.id || 0,
                fx3_id: SHADER_LIST[currentFxState.fx3.shader]?.id || 0,
                fx4_id: SHADER_LIST[currentFxState.fx4.shader]?.id || 0,
                fx5_id: SHADER_LIST[currentFxState.fx5.shader]?.id || 0,
            };

            if (videoRef.current) {
                glService.current.updateTexture(videoRef.current);
                glService.current.draw(t, videoRef.current, computedFx);
            }

            if (t - lastTimeRef.current > 100) {
                 setFps(Math.round(1000 / ((t - lastTimeRef.current) / ((t - lastTimeRef.current) > 200 ? 1 : 1))));
                 setVisualLevels({
                     main: lvls.main,
                     fx1: lvls.fx1, fx2: lvls.fx2, fx3: lvls.fx3, fx4: lvls.fx4, fx5: lvls.fx5
                 });
                 lastTimeRef.current = t;
            }

            animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isSystemActive, handleResize]);

    useEffect(() => {
        if (isSystemActive) {
            const shaderDef = SHADER_LIST[fxState.main.shader] || SHADER_LIST['00_NONE'];
            glService.current.loadShader(shaderDef.src);
        }
    }, [fxState.main.shader, isSystemActive]);

    // --- HANDLERS ---

    const loadAudioUrl = (url: string) => {
        // 1. Cleanup old audio
        if (currentAudioElRef.current) {
            currentAudioElRef.current.pause();
            currentAudioElRef.current.src = "";
            currentAudioElRef.current.load(); // Ensure buffer clear
            currentAudioElRef.current = null;
        }

        // 2. Create New
        const audio = new Audio();
        audio.src = url;
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        currentAudioElRef.current = audio;
        
        // 3. Init Engine & Apply Filters immediately
        audioService.current.init(audio).then(() => {
            audioService.current.setupFilters();
            audioService.current.updateFilters(syncParamsRef.current); // Apply current params
            audio.play().catch(e => console.log("Auto-play prevented", e));
        });
    };

    const handleFile = (type: 'video' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            
            if (type === 'video' && videoRef.current) {
                // Cleanup previous video object URL if it exists (optional but good practice)
                if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
                    URL.revokeObjectURL(videoRef.current.src);
                }
                
                videoRef.current.src = url;
                videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
            } else if (type === 'audio') {
                setCurrentTrackName(file.name);
                loadAudioUrl(url);
            }
        }
    };

    const handleCatalogSelect = (url: string, name: string) => {
        setCurrentTrackName(name);
        setShowCatalog(false);
        loadAudioUrl(url);
    };

    const handleTransport = (action: 'play' | 'stop' | 'reset') => {
        const vid = videoRef.current;
        const aud = currentAudioElRef.current;

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

    const toggleRecording = () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const videoStream = (canvas as any).captureStream(60);
            const audioStream = audioService.current.getAudioStream();
            
            const combinedTracks = [...videoStream.getVideoTracks()];
            if (audioStream) {
                combinedTracks.push(...audioStream.getAudioTracks());
            }
            const combinedStream = new MediaStream(combinedTracks);

            try {
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
                    ? 'video/webm;codecs=vp9' 
                    : 'video/webm';
                
                const recorder = new MediaRecorder(combinedStream, { 
                    mimeType, 
                    videoBitsPerSecond: 8000000 // High bitrate
                });

                recordedChunksRef.current = [];
                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) recordedChunksRef.current.push(event.data);
                };
                recorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `visus-render-${new Date().toISOString()}.webm`;
                    a.click();
                    URL.revokeObjectURL(url);
                };
                recorder.start();
                mediaRecorderRef.current = recorder;
                setIsRecording(true);
            } catch (e) {
                console.error("Failed to start recording", e);
            }
        }
    };

    const updateSyncParams = (index: number, changes: Partial<SyncParam>) => {
        const newParams = [...syncParams];
        newParams[index] = { ...newParams[index], ...changes };
        setSyncParams(newParams);
        audioService.current.updateFilters(newParams);
    };

    if (!isSystemActive) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-black overflow-hidden relative">
                {/* Modern Gradient Background */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-[#050505] to-black"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                
                <div className="text-center p-12 bg-black/30 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl max-w-lg relative z-10 animate-in fade-in zoom-in duration-700">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"></div>
                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-20"></div>
                    
                    <h1 className="text-8xl font-black mb-4 text-white tracking-tighter mix-blend-difference" style={{textShadow: '0 0 80px rgba(51, 255, 153, 0.3)'}}>VISUS</h1>
                    <div className="text-zinc-500 font-mono text-xs tracking-[0.6em] mb-12">ADVANCED VISUAL ENGINE</div>
                    
                    <button 
                        className="group relative px-16 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300 tracking-widest text-sm overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                        onClick={() => setIsSystemActive(true)}
                    >
                        <div className="absolute inset-0 bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl mix-blend-multiply"></div>
                        <span className="relative z-10 group-hover:text-black transition-colors">INITIALIZE</span>
                    </button>
                    
                    <div className="mt-12 flex justify-center gap-6 text-[9px] text-zinc-700 font-mono uppercase tracking-wider">
                        <span>v2.6.0</span>
                        <span>•</span>
                        <span>WebGL 2.0</span>
                        <span>•</span>
                        <span>HIFI AUDIO</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden bg-[#050505] relative font-sans text-zinc-300 selection:bg-accent selection:text-black">
            <canvas ref={canvasRef} className="absolute z-10 origin-center" style={{boxShadow: '0 0 150px rgba(0,0,0,0.8)'}} />
            <video ref={videoRef} className="hidden" crossOrigin="anonymous" loop muted playsInline />

            {/* Status Bar */}
            <div className="fixed top-6 right-6 z-50 font-mono text-[10px] text-zinc-500 flex gap-4 bg-black/40 p-2 rounded-full backdrop-blur-xl border border-white/5 px-5 shadow-2xl">
                <span className={fps < 55 ? 'text-red-500' : 'text-accent'}>FPS: {fps}</span>
                <span>RES: {canvasRef.current?.width}x{canvasRef.current?.height}</span>
                {isRecording && <span className="text-red-500 animate-pulse font-bold flex items-center gap-2">● REC</span>}
            </div>

            {showCatalog && (
                <MusicCatalog 
                    onSelect={handleCatalogSelect} 
                    onClose={() => setShowCatalog(false)} 
                />
            )}

            {/* Main UI Panel */}
            <div 
                ref={uiPanelRef}
                className={`fixed top-0 left-0 h-full w-[380px] bg-black/70 backdrop-blur-xl border-r border-white/10 z-40 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.5)] ${panelVisible ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter">VISUS</h2>
                        <div className="text-[9px] text-accent font-mono tracking-[0.3em] opacity-80">CONTROLLER</div>
                    </div>
                    <button onClick={() => setPanelVisible(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-8">
                    
                    {/* SECTION 1: SOURCE */}
                    <section>
                         <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1 h-1 bg-accent rounded-full shadow-[0_0_10px_rgba(51,255,153,0.8)]"></span> 
                            Source
                        </div>

                        <div className="space-y-3">
                            {/* Track Info */}
                            <div className="flex items-center gap-3 bg-zinc-900/50 p-3 rounded-xl border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-black border border-white/5 flex items-center justify-center text-accent shadow-inner">♪</div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Now Playing</div>
                                    <div className="text-xs text-white font-bold truncate">{currentTrackName || "No Audio Loaded"}</div>
                                </div>
                            </div>

                            {/* Transport */}
                            <div className="grid grid-cols-4 gap-2">
                                <button onClick={() => handleTransport('play')} className="col-span-2 bg-white text-black hover:bg-accent font-bold py-2.5 rounded-lg text-[10px] tracking-wider transition-all shadow-lg hover:shadow-accent/20">PLAY</button>
                                <button onClick={() => handleTransport('stop')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 rounded-lg text-[10px] transition-all">STOP</button>
                                <button onClick={() => handleTransport('reset')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 rounded-lg text-[10px] transition-all">↺</button>
                            </div>

                            {/* File Inputs */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                 <label className="bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white py-3 rounded-lg text-[9px] font-bold cursor-pointer text-center transition-all tracking-wide">
                                    LOAD VIDEO
                                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile('video', e)} />
                                </label>
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => setShowCatalog(true)}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/5 font-bold py-2 rounded-lg text-[9px] tracking-wide transition-all"
                                    >
                                        BROWSE CATALOG
                                    </button>
                                    <label className="bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white py-2 rounded-lg text-[9px] font-bold cursor-pointer text-center transition-all tracking-wide">
                                        LOCAL MP3
                                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile('audio', e)} />
                                    </label>
                                </div>
                            </div>

                            {/* Render Button */}
                             <button 
                                onClick={toggleRecording}
                                className={`w-full py-3 mt-2 rounded-xl text-[10px] font-bold border transition-all flex items-center justify-center gap-2 tracking-widest ${isRecording ? 'bg-red-500/10 text-red-500 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:border-zinc-600'}`}
                            >
                                {isRecording ? <span className="animate-pulse">● RECORDING...</span> : <span>START RENDER</span>}
                            </button>

                             {/* Aspect Ratio */}
                             <div className="pt-2 border-t border-white/5 mt-2">
                                <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
                                    {(['fit', '16:9', '9:16', 'manual'] as AspectRatioMode[]).map((ratio) => (
                                        <button 
                                            key={ratio}
                                            onClick={() => setAspectRatio(ratio)}
                                            className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-md transition-all ${aspectRatio === ratio ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                            {ratio}
                                        </button>
                                    ))}
                                </div>
                                {aspectRatio === 'manual' && (
                                    <div className="flex gap-2 mt-2">
                                        <input type="number" value={manualRes.w} onChange={(e) => setManualRes(p => ({...p, w: parseInt(e.target.value)||100}))} className="w-full bg-black border border-zinc-800 rounded p-1.5 text-[10px] text-white text-center outline-none focus:border-accent" placeholder="W" />
                                        <input type="number" value={manualRes.h} onChange={(e) => setManualRes(p => ({...p, h: parseInt(e.target.value)||100}))} className="w-full bg-black border border-zinc-800 rounded p-1.5 text-[10px] text-white text-center outline-none focus:border-accent" placeholder="H" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: ANALYSIS */}
                    <section>
                         <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1 h-1 bg-sync2 rounded-full shadow-[0_0_10px_rgba(0,238,255,0.8)]"></span> 
                            Frequency Analysis
                        </div>
                        
                        <SpectrumVisualizer 
                            audioServiceRef={audioService} 
                            syncParams={syncParams} 
                            onParamChange={updateSyncParams}
                        />
                         <BandControls 
                            syncParams={syncParams} 
                            setSyncParams={setSyncParams} 
                            onUpdateFilters={(p) => audioService.current.updateFilters(p)}
                        />
                    </section>

                    {/* SECTION 3: FX */}
                    <section>
                         <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-1 h-1 bg-sync3 rounded-full shadow-[0_0_10px_rgba(252,227,3,0.8)]"></span> 
                                Main Scene
                            </div>
                            {visualLevels.main > 0.1 && <span className="text-[8px] text-accent animate-pulse font-bold tracking-widest">ACTIVE</span>}
                        </div>
                        <FxSlot category="main" slotName="main" fxState={fxState} setFxState={setFxState} activeLevel={visualLevels.main} />
                    </section>

                    {/* SECTION 4: STACK */}
                    <section>
                         <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 pt-6 border-t border-white/5">
                            Post FX Chain
                        </div>
                        <div className="space-y-2">
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
                    </section>

                    <div className="h-24 text-center text-[9px] text-zinc-700 font-mono pt-10">
                        VISUS ENGINE v2.6
                    </div>
                </div>
            </div>

            {!panelVisible && (
                <button 
                    onClick={() => setPanelVisible(true)}
                    className="fixed bottom-8 left-8 z-50 bg-black/80 border border-white/10 hover:border-accent hover:text-accent text-white w-14 h-14 flex items-center justify-center rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur transition-all hover:scale-110 group"
                >
                    <span className="text-2xl block group-hover:rotate-90 transition-transform duration-500">⚙</span>
                </button>
            )}
        </div>
    );
};

export default App;
