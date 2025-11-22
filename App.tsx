
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GLService } from './services/glService';
import { AudioEngine } from './services/audioService';
import { FxState, SyncParam, AspectRatioMode, TransformConfig, SHADER_LIST } from './constants';
import FxSlot from './components/FxSlot';
import BandControls from './components/BandControls';
import SpectrumVisualizer from './components/SpectrumVisualizer';
import MusicCatalog from './components/MusicCatalog';
import Knob from './components/Knob';

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
    const [micActive, setMicActive] = useState(false);
    const [micGain, setMicGain] = useState(2.0);
    
    // Resolution & Framing
    const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('native');
    const [manualRes, setManualRes] = useState({ w: 1920, h: 1080 });
    // Transform: x/y are offset from center, scale is zoom level
    const [transform, setTransform] = useState<TransformConfig>({ x: 0, y: 0, scale: 1.0 });

    const [visualLevels, setVisualLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });

    // New: Additive Chain Master Gain (0-100)
    const [additiveGain, setAdditiveGain] = useState(80); 

    const [syncParams, setSyncParams] = useState<SyncParam[]>([
        { bpm: 128.0, offset: 0, freq: 60, width: 30, gain: 1.0 },
        { bpm: 128.0, offset: 0, freq: 800, width: 40, gain: 1.0 }, 
        { bpm: 128.0, offset: 0, freq: 6000, width: 40, gain: 1.0 },
    ]);

    // Reset to NONE by default for a clean slate
    const [fxState, setFxState] = useState<FxState>({
        main: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
        fx1: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
        fx2: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
        fx3: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
        fx4: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
        fx5: { shader: '00_NONE', routing: 'off', gain: 100, mix: 100 }, 
    });

    const fxStateRef = useRef(fxState);
    const syncParamsRef = useRef(syncParams);
    const isSystemActiveRef = useRef(isSystemActive);
    const additiveGainRef = useRef(additiveGain);
    const transformRef = useRef(transform);

    useEffect(() => { fxStateRef.current = fxState; }, [fxState]);
    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { isSystemActiveRef.current = isSystemActive; }, [isSystemActive]);
    useEffect(() => { additiveGainRef.current = additiveGain; }, [additiveGain]);
    useEffect(() => { transformRef.current = transform; }, [transform]);

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
        
        const wWindow = window.innerWidth;
        const hWindow = window.innerHeight;
        const isMobile = wWindow < 768;

        // --- SPLIT SCREEN LOGIC ---
        // If on mobile and panel is open, we restrict the "viewable" area to the top 40%
        // This ensures the video fits in the space above the controls
        let availableH = hWindow;
        let topOffset = 0;

        if (isMobile && panelVisible) {
            availableH = hWindow * 0.40; // 40% height for video
            // Controls take remaining 60%
        }
        
        let finalW = wWindow;
        let finalH = hWindow;

        // LOGIC FOR RESOLUTION (Internal Canvas Size)
        if (aspectRatio === 'native') {
             if (videoRef.current && videoRef.current.videoWidth > 0) {
                 finalW = videoRef.current.videoWidth;
                 finalH = videoRef.current.videoHeight;
             } else {
                 finalW = wWindow;
                 finalH = hWindow;
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
        } else if (aspectRatio === 'manual') {
            finalW = manualRes.w;
            finalH = manualRes.h;
        }

        if (finalW < 2) finalW = 2;
        if (finalH < 2) finalH = 2;

        const canvas = canvasRef.current;
        
        // 1. Set Internal Resolution (High Quality for Recording)
        canvas.width = finalW;
        canvas.height = finalH;

        // 2. Set Visual Display Size (CSS) to fit in Available Area
        // We scale the visual representation to fit 'availableH' (screen or top split)
        const scale = Math.min(wWindow / finalW, availableH / finalH);
        const displayW = finalW * scale;
        const displayH = finalH * scale;

        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        
        // 3. Center Logic
        // If mobile split, center within the top area
        canvas.style.position = 'absolute';
        canvas.style.left = `${(wWindow - displayW) / 2}px`;
        canvas.style.top = `${topOffset + (availableH - displayH) / 2}px`;

        glService.current.resize(finalW, finalH);
    }, [aspectRatio, manualRes, panelVisible]);

    // Trigger resize when panel visibility changes to adjust split screen
    useEffect(() => {
        handleResize();
        // Adding a small delay because CSS transitions might affect layout calculation (though we use fixed VH here)
        const t = setTimeout(handleResize, 300); 
        return () => clearTimeout(t);
    }, [panelVisible, handleResize]);

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
        const v = videoRef.current;
        if (v) {
            v.addEventListener('loadedmetadata', handleResize);
        }

        const loop = (t: number) => {
            if (!isSystemActiveRef.current) return;

            const ae = audioService.current;
            ae.update(); 

            const currentSyncParams = syncParamsRef.current;
            const currentFxState = fxStateRef.current;
            const currentTransform = transformRef.current;

            const bpm = currentSyncParams[0].bpm;
            const offset = currentSyncParams[0].offset;
            const beatMs = 60000 / bpm;
            const adjustedTime = t - offset;
            const phase = (adjustedTime % beatMs) / beatMs;

            const computeFxVal = (config: any) => {
                const sourceLevel = getActivationLevel(config.routing, phase);
                const gainMult = config.gain / 100;
                const mixMult = (config.mix ?? 100) / 100; 
                return sourceLevel * gainMult * mixMult * 2.0; 
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
                additiveMasterGain: additiveGainRef.current / 100,
                transform: currentTransform,
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
            if (v) v.removeEventListener('loadedmetadata', handleResize);
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
        if (currentAudioElRef.current) {
            currentAudioElRef.current.pause();
            currentAudioElRef.current.src = "";
            currentAudioElRef.current.load(); 
            currentAudioElRef.current = null;
        }
        setMicActive(false);
        const audio = new Audio();
        audio.src = url;
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        currentAudioElRef.current = audio;
        audioService.current.init(audio).then(() => {
            audioService.current.setupFilters();
            audioService.current.updateFilters(syncParamsRef.current); 
            audio.play().catch(e => console.log("Auto-play prevented", e));
        });
    };

    const handleFile = (type: 'video' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            if (type === 'video' && videoRef.current) {
                videoRef.current.srcObject = null;
                if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) URL.revokeObjectURL(videoRef.current.src);
                videoRef.current.src = url;
                videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
                setTimeout(handleResize, 500);
            } else if (type === 'audio') {
                setCurrentTrackName(file.name.replace(/\.[^/.]+$/, ""));
                loadAudioUrl(url);
            }
        }
    };

    const handleCamera = async () => {
        if (!videoRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1920 }, height: { ideal: 1080 } } 
            });
            videoRef.current.src = "";
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setTimeout(handleResize, 500);
        } catch (e) {
            console.error("Camera access denied", e);
            alert("Could not access camera. Please check permissions.");
        }
    };

    const handleMicrophone = async () => {
        if (micActive) {
            audioService.current.stopMicrophone();
            setMicActive(false);
            setCurrentTrackName(null);
            return;
        }
        if (currentAudioElRef.current) {
            currentAudioElRef.current.pause();
        }
        try {
            await audioService.current.enableMicrophone(micGain);
            audioService.current.setupFilters();
            audioService.current.updateFilters(syncParamsRef.current);
            setMicActive(true);
            setCurrentTrackName("Microphone Input");
        } catch (e) {
            alert("Microphone access failed.");
        }
    };

    const handleMicGainChange = (val: number) => {
        setMicGain(val);
        audioService.current.setMicrophoneGain(val);
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
            if (audioStream) combinedTracks.push(...audioStream.getAudioTracks());
            const combinedStream = new MediaStream(combinedTracks);

            try {
                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
                const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 12000000 });
                recordedChunksRef.current = [];
                recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
                recorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `visus-rec-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.webm`;
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

    const updateTransform = (key: keyof TransformConfig, val: number) => {
        setTransform(prev => ({ ...prev, [key]: val }));
    };

    if (!isSystemActive) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-slate-950 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black"></div>
                
                <div className="text-center p-12 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl max-w-lg relative z-10 animate-in fade-in duration-700 mx-4 flex flex-col items-center">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"></div>
                    
                    {/* LOGO REPLACEMENT - CSS ONLY */}
                    <div className="mb-8 relative group w-32 h-32 flex items-center justify-center bg-black rounded-full border-4 border-white/10 shadow-[0_0_50px_rgba(167,139,250,0.3)] hover:scale-105 transition-transform duration-500">
                         <div className="absolute inset-0 bg-accent rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>
                         <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 select-none">V</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tighter">VISUS</h1>
                    <div className="text-accent font-mono text-xs tracking-[0.6em] mb-12 uppercase">Advanced Visual Engine</div>
                    
                    <button 
                        className="group relative px-16 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300 tracking-widest text-sm overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                        onClick={() => setIsSystemActive(true)}
                    >
                        <div className="absolute inset-0 bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl mix-blend-screen"></div>
                        <span className="relative z-10 group-hover:text-white transition-colors">INITIALIZE</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden bg-[#020617] relative font-sans text-slate-300 selection:bg-accent selection:text-white">
            <canvas ref={canvasRef} className="absolute z-10 origin-center" style={{boxShadow: '0 0 100px rgba(0,0,0,0.5)'}} />
            <video ref={videoRef} className="hidden" crossOrigin="anonymous" loop muted playsInline />

            {/* Status Bar */}
            <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 font-mono text-[10px] text-slate-400 flex gap-4 bg-black/40 p-2 rounded-full backdrop-blur-xl border border-white/5 px-5 shadow-2xl pointer-events-none">
                <span className={fps < 55 ? 'text-red-400' : 'text-accent'}>FPS: {fps}</span>
                <span className="hidden md:inline">RES: {canvasRef.current?.width}x{canvasRef.current?.height}</span>
                {micActive && <span className="text-red-500 animate-pulse font-black tracking-widest">● MIC ACTIVE</span>}
            </div>

            {showCatalog && (
                <MusicCatalog 
                    onSelect={handleCatalogSelect} 
                    onClose={() => setShowCatalog(false)} 
                />
            )}

            {/* Main UI Panel - RESPONSIVE LAYOUT */}
            <div 
                ref={uiPanelRef}
                className={`
                    fixed z-40 glass-panel flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                    
                    /* Desktop Styling */
                    md:top-0 md:left-0 md:h-full md:w-[380px] md:border-r md:border-t-0 md:rounded-none
                    ${panelVisible ? 'md:translate-x-0' : 'md:-translate-x-full'}

                    /* Mobile Styling */
                    bottom-0 left-0 w-full h-[60vh] rounded-t-3xl border-t border-white/10
                    ${panelVisible ? 'translate-y-0' : 'translate-y-[110%]'}
                `}
            >
                {/* Mobile Drag Handle Visual */}
                <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setPanelVisible(false)}>
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div className="px-6 py-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
                    <div className="flex items-center gap-3">
                         {/* LOGO IN SIDEBAR - CSS ONLY */}
                         <div className="w-10 h-10 rounded-full border border-white/10 shadow-lg bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 flex items-center justify-center">
                            <span className="font-black text-white text-xs">V</span>
                         </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter leading-none">VISUS</h2>
                            <div className="text-[9px] text-accent font-mono tracking-[0.3em] opacity-80">CONTROLLER</div>
                        </div>
                    </div>
                    <button onClick={() => setPanelVisible(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-8 pb-24">
                    
                    {/* SECTION 1: SOURCE & RESOLUTION */}
                    <section>
                         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span> 
                            Source & Format
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-black border border-white/5 flex items-center justify-center text-accent shadow-inner">♪</div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Now Playing</div>
                                    <div className="text-xs text-white font-bold truncate">{currentTrackName || "No Audio Loaded"}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                <button onClick={() => handleTransport('play')} className="col-span-2 bg-slate-200 hover:bg-white text-slate-900 font-bold py-2.5 rounded-lg text-[10px] tracking-wider transition-all shadow-lg">PLAY</button>
                                <button onClick={() => handleTransport('stop')} className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 rounded-lg text-[10px] transition-all">STOP</button>
                                <button onClick={() => handleTransport('reset')} className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 rounded-lg text-[10px] transition-all">↺</button>
                            </div>

                            {/* Source Inputs */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button 
                                    onClick={handleCamera}
                                    className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white py-3 rounded-lg text-[9px] font-bold transition-all tracking-wide flex flex-col items-center justify-center gap-1 border border-white/5"
                                >
                                    <span>◉ USE CAMERA</span>
                                </button>
                                <button 
                                    onClick={handleMicrophone}
                                    className={`bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white py-3 rounded-lg text-[9px] font-bold transition-all tracking-wide flex flex-col items-center justify-center gap-1 border border-white/5 ${micActive ? 'border-red-500/50 text-red-200 bg-red-900/20' : ''}`}
                                >
                                    <span>{micActive ? '🎙 STOP MIC' : '🎙 USE MIC'}</span>
                                </button>
                            </div>
                            
                            {micActive && (
                                <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-3 animate-in fade-in">
                                    <div className="flex justify-between text-[9px] text-red-300 font-bold uppercase tracking-wider mb-2">
                                        <span>Mic Input Gain</span>
                                        <span className="font-mono">{micGain.toFixed(1)}x</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0.5" max="5.0" step="0.1"
                                        value={micGain}
                                        onChange={(e) => handleMicGainChange(parseFloat(e.target.value))}
                                        className="w-full accent-red-400"
                                    />
                                </div>
                            )}

                             <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setShowCatalog(true)}
                                        className="bg-white/5 hover:bg-white/10 text-white border border-white/5 font-bold py-3 rounded-lg text-[9px] tracking-wide transition-all"
                                    >
                                        CATALOG
                                    </button>
                                    <label className="bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white py-3 rounded-lg text-[9px] font-bold cursor-pointer text-center transition-all tracking-wide flex flex-col items-center justify-center">
                                        LOCAL MP3
                                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile('audio', e)} />
                                    </label>
                                    
                                     <label className="col-span-2 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white py-3 rounded-lg text-[9px] font-bold cursor-pointer text-center transition-all tracking-wide flex items-center justify-center">
                                        LOAD VIDEO FILE
                                        <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile('video', e)} />
                                    </label>
                            </div>

                            {/* Format & Framing Control */}
                            <div className="pt-4 border-t border-white/5">
                                <div className="text-[9px] text-slate-500 font-bold uppercase mb-2 tracking-wider">Output Format</div>
                                <div className="grid grid-cols-3 gap-1 mb-3">
                                    <button onClick={() => setAspectRatio('native')} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === 'native' ? 'bg-accent text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>NATIVE</button>
                                    <button onClick={() => setAspectRatio('9:16')} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === '9:16' ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>9:16 (TikTok)</button>
                                    <button onClick={() => setAspectRatio('4:5')} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === '4:5' ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>4:5 (IG)</button>
                                    <button onClick={() => setAspectRatio('1:1')} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === '1:1' ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>1:1 (Square)</button>
                                    <button onClick={() => setAspectRatio('16:9')} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === '16:9' ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>16:9 (YT)</button>
                                    <button onClick={() => setAspectRatio('fit')} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === 'fit' ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>FIT</button>
                                </div>

                                <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                                     <div className="text-[9px] text-slate-500 font-bold uppercase mb-2 text-center tracking-wider">Framing / Crop</div>
                                     <div className="flex justify-around items-center">
                                         <Knob label="Pan X" min={-0.5} max={0.5} step={0.01} value={transform.x} onChange={(v) => updateTransform('x', v)} format={(v) => v.toFixed(2)} color="#ffffff" />
                                         <Knob label="Pan Y" min={-0.5} max={0.5} step={0.01} value={transform.y} onChange={(v) => updateTransform('y', v)} format={(v) => v.toFixed(2)} color="#ffffff" />
                                         <Knob label="Zoom" min={0.1} max={3.0} step={0.05} value={transform.scale} onChange={(v) => updateTransform('scale', v)} format={(v) => v.toFixed(2) + 'x'} color="#2dd4bf" />
                                     </div>
                                </div>
                            </div>

                             <button 
                                onClick={toggleRecording}
                                className={`w-full py-3 mt-4 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-3 tracking-widest ${isRecording ? 'bg-red-500/20 text-red-200 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:border-white/20'}`}
                            >
                                {isRecording ? <span className="animate-pulse flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> RECORDING...</span> : <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> REC (WYSIWYG)</span>}
                            </button>
                        </div>
                    </section>

                    {/* SECTION 2: ANALYSIS */}
                    <section>
                         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-accent2 rounded-full shadow-[0_0_8px_rgba(45,212,191,0.8)]"></span> 
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
                         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span> 
                                Main Scene
                            </div>
                            {visualLevels.main > 0.1 && <span className="text-[8px] text-accent animate-pulse font-bold tracking-widest">ACTIVE</span>}
                        </div>
                        <FxSlot category="main" slotName="main" fxState={fxState} setFxState={setFxState} activeLevel={visualLevels.main} />
                    </section>

                    {/* SECTION 4: STACK */}
                    <section>
                        <div className="flex justify-between items-center pt-6 border-t border-white/5 mb-4">
                             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Post FX Chain
                            </div>
                        </div>
                        
                        {/* Chain Intensity Control */}
                        <div className="bg-white/5 border border-white/5 rounded-xl p-3 mb-4">
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                                <span>Chain Intensity</span>
                                <span className="text-accent2">{additiveGain}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="100" 
                                value={additiveGain}
                                onChange={(e) => setAdditiveGain(parseInt(e.target.value))}
                                className="w-full accent-accent2"
                            />
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

                     <div className="h-auto text-center text-[9px] text-slate-600 font-mono pt-10 pb-12 space-y-1">
                        <div className="font-bold opacity-50 mb-2">VISUS ENGINE v2.8</div>
                        <div className="opacity-40 hover:opacity-100 transition-opacity">
                            &copy; Studio Popłoch 2025
                        </div>
                        <div className="text-accent/30 hover:text-accent/80 transition-colors font-bold tracking-wider">
                            Pan Grzyb
                        </div>
                    </div>
                </div>
            </div>

            {!panelVisible && (
                <button 
                    onClick={() => setPanelVisible(true)}
                    className="fixed bottom-8 left-8 z-50 bg-slate-900/80 border border-white/10 hover:border-accent hover:text-accent text-white w-14 h-14 flex items-center justify-center rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur transition-all hover:scale-110 group"
                >
                    <span className="text-2xl block group-hover:rotate-90 transition-transform duration-500">⚙</span>
                </button>
            )}
        </div>
    );
};

export default App;
