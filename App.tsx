
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GLService } from './services/glService';
import { AudioEngine } from './services/audioService';
import { FxState, SyncParam, AspectRatioMode, TransformConfig, SHADER_LIST } from './constants';
import FxSlot from './components/FxSlot';
import BandControls from './components/BandControls';
import SpectrumVisualizer from './components/SpectrumVisualizer';
import MusicCatalog from './components/MusicCatalog';
import Knob from './components/Knob';
import MixerChannel from './components/MixerChannel';

const App: React.FC = () => {
    // --- REFS ---
    const glService = useRef<GLService>(new GLService());
    const audioService = useRef<AudioEngine>(new AudioEngine());
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentAudioElRef = useRef<HTMLAudioElement | null>(null); 
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiPanelRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // --- STATE ---
    const [isSystemActive, setIsSystemActive] = useState(false);
    const [fps, setFps] = useState(0);
    const [panelVisible, setPanelVisible] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    
    // Modal States
    const [showCatalog, setShowCatalog] = useState(false);
    const [showCameraSelector, setShowCameraSelector] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    
    // MIXER STATE
    const [mixer, setMixer] = useState({
        video: { active: true, volume: 1.0, hasSource: false, playing: false },
        music: { active: true, volume: 0.8, hasSource: false, playing: false, name: '' },
        mic: { active: false, volume: 1.5, hasSource: false }
    });
    // For VU Meters (updated via ref/animation frame to avoid react render thrashing)
    const [vuLevels, setVuLevels] = useState({ video: 0, music: 0, mic: 0 });

    // Resolution & Framing
    const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('native');
    const [isMirrored, setIsMirrored] = useState(false);
    const [transform, setTransform] = useState<TransformConfig>({ x: 0, y: 0, scale: 1.0 });

    const [visualLevels, setVisualLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });
    const [additiveGain, setAdditiveGain] = useState(80); 

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

    const fxStateRef = useRef(fxState);
    const syncParamsRef = useRef(syncParams);
    const isSystemActiveRef = useRef(isSystemActive);
    const additiveGainRef = useRef(additiveGain);
    const transformRef = useRef(transform);
    const isMirroredRef = useRef(isMirrored);
    const mixerRef = useRef(mixer); 

    useEffect(() => { fxStateRef.current = fxState; }, [fxState]);
    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { isSystemActiveRef.current = isSystemActive; }, [isSystemActive]);
    useEffect(() => { additiveGainRef.current = additiveGain; }, [additiveGain]);
    useEffect(() => { transformRef.current = transform; }, [transform]);
    useEffect(() => { isMirroredRef.current = isMirrored; }, [isMirrored]);
    useEffect(() => { mixerRef.current = mixer; }, [mixer]);

    // Apply Mixer Volume Changes
    useEffect(() => {
        const ae = audioService.current;
        ae.setVolume('video', mixer.video.active ? mixer.video.volume : 0);
        ae.setVolume('music', mixer.music.active ? mixer.music.volume : 0);
        ae.setVolume('mic', mixer.mic.active ? mixer.mic.volume : 0);
        // Note: Mic connection logic moved to handler to satisfy browser policies
    }, [mixer.video.volume, mixer.video.active, mixer.music.volume, mixer.music.active, mixer.mic.volume, mixer.mic.active]);

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
        let availableH = hWindow;
        let topOffset = 0;

        if (isMobile && panelVisible) {
            availableH = hWindow * 0.40;
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

        const canvas = canvasRef.current;
        if (canvas.width !== finalW || canvas.height !== finalH) {
             canvas.width = finalW;
             canvas.height = finalH;
        }

        const scale = Math.min(wWindow / finalW, availableH / finalH);
        const displayW = finalW * scale;
        const displayH = finalH * scale;

        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        canvas.style.left = `${(wWindow - displayW) / 2}px`;
        canvas.style.top = `${topOffset + (availableH - displayH) / 2}px`;

        if (glService.current && typeof glService.current.resize === 'function') {
            glService.current.resize(finalW, finalH);
        }
    }, [aspectRatio, panelVisible]);

    useEffect(() => {
        handleResize();
        const t = setTimeout(handleResize, 300); 
        return () => clearTimeout(t);
    }, [panelVisible, handleResize]);

    useEffect(() => {
        if (!isSystemActive) return;

        if (canvasRef.current) {
            const success = glService.current.init(canvasRef.current);
            if (success) {
                const currentShaderKey = fxStateRef.current.main.shader;
                const shaderDef = SHADER_LIST[currentShaderKey] || SHADER_LIST['00_NONE'];
                glService.current.loadShader(shaderDef.src);
            }
        }

        // Init Audio Context early to allow setup
        audioService.current.initContext().then(() => {
             // Initial Filter Setup
             audioService.current.setupFilters(syncParamsRef.current);
        });

        handleResize();
        window.addEventListener('resize', handleResize);
        const v = videoRef.current;
        if (v) v.addEventListener('loadedmetadata', handleResize);

        const loop = (t: number) => {
            if (!isSystemActiveRef.current) return;

            const ae = audioService.current;
            ae.update(); 
            
            // Read VU Meters
            const levels = ae.getLevels();
            // throttle VU updates slightly to 30fps effectively if needed, but doing every frame is fine
            setVuLevels(levels);

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
                return sourceLevel * gainMult; 
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
                main_id: SHADER_LIST[currentFxState.main.shader]?.id || 0,
                mix: currentFxState.main.mix,
                additiveMasterGain: additiveGainRef.current / 100,
                transform: currentTransform,
                isMirrored: isMirroredRef.current,
                fx1: lvls.fx1, fx2: lvls.fx2, fx3: lvls.fx3, fx4: lvls.fx4, fx5: lvls.fx5,
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
                 setVisualLevels(lvls);
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

    // --- HANDLERS ---

    const toggleMic = async (isActive: boolean) => {
        setMixer(prev => ({ ...prev, mic: { ...prev.mic, active: isActive } }));
        
        if (isActive) {
            try {
                // IMPORTANT: connectMic must be called here, in response to the click
                await audioService.current.initContext(); // ensure resumed
                await audioService.current.connectMic();
                setMixer(prev => ({ ...prev, mic: { ...prev.mic, hasSource: true } }));
                audioService.current.setupFilters(syncParamsRef.current);
            } catch (e) {
                console.error(e);
                alert("Could not access microphone. Please check permissions.");
                setMixer(prev => ({ ...prev, mic: { ...prev.mic, active: false } }));
            }
        } else {
            // Optional: disconnectMic() if you want to release the hardware, 
            // or just mute via Gain which is handled by useEffect volume sync.
            // audioService.current.disconnectMic(); 
        }
    };

    const updateMixer = (channel: 'video' | 'music' | 'mic', changes: any) => {
        setMixer(prev => ({
            ...prev,
            [channel]: { ...prev[channel], ...changes }
        }));
    };

    const toggleTransport = (channel: 'video' | 'music') => {
        if (channel === 'video' && videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                updateMixer('video', { playing: true });
            } else {
                videoRef.current.pause();
                updateMixer('video', { playing: false });
            }
        } else if (channel === 'music' && currentAudioElRef.current) {
             if (currentAudioElRef.current.paused) {
                currentAudioElRef.current.play();
                updateMixer('music', { playing: true });
            } else {
                currentAudioElRef.current.pause();
                updateMixer('music', { playing: false });
            }
        }
    };

    const stopTransport = (channel: 'video' | 'music') => {
        if (channel === 'video' && videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            updateMixer('video', { playing: false });
        } else if (channel === 'music' && currentAudioElRef.current) {
            currentAudioElRef.current.pause();
            currentAudioElRef.current.currentTime = 0;
            updateMixer('music', { playing: false });
        }
    };

    const loadMusicTrack = (url: string, name: string) => {
        if (currentAudioElRef.current) {
            currentAudioElRef.current.pause();
        }
        
        const audio = new Audio();
        audio.src = url;
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        currentAudioElRef.current = audio;
        
        // Connect to Mixer
        audioService.current.connectMusic(audio);
        audioService.current.setupFilters(syncParamsRef.current);
        
        audio.play().then(() => {
             setMixer(prev => ({
                ...prev,
                music: { ...prev.music, hasSource: true, active: true, name: name, playing: true }
            }));
        }).catch(e => console.log("Auto-play prevented", e));
        
        setShowCatalog(false);
    };

    const handleFile = (type: 'video' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            
            if (type === 'video' && videoRef.current) {
                // Video Source Logic
                videoRef.current.srcObject = null;
                if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) URL.revokeObjectURL(videoRef.current.src);
                videoRef.current.src = url;
                videoRef.current.volume = 1.0; 
                
                audioService.current.connectVideo(videoRef.current);
                audioService.current.setupFilters(syncParamsRef.current);

                videoRef.current.play().then(() => {
                    setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, active: true, playing: true } }));
                }).catch(e => console.log("Auto-play prevented", e));
                
                setTimeout(handleResize, 500);

            } else if (type === 'audio') {
                loadMusicTrack(url, file.name.replace(/\.[^/.]+$/, ""));
            }
        }
    };

    const initCamera = async () => {
         if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            alert("Camera API not supported");
            return;
        }
        try {
            await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoInputs);
            if (videoInputs.length > 0) setShowCameraSelector(true);
            else alert("No cameras found");
        } catch(e) { alert("Camera error or permission denied"); }
    };

    const startCamera = async (deviceId?: string) => {
        if (!videoRef.current) return;
        try {
            const constraints = { video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } } };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); }
            videoRef.current.src = "";
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            
            // Connect Video Audio (even if silent, keeps pipeline valid)
            audioService.current.connectVideo(videoRef.current);
            setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, playing: true } }));
            
            setShowCameraSelector(false);
            setTimeout(handleResize, 500);
        } catch (e) { alert("Failed to start camera"); }
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
            // Record at 60fps for smoothness
            const videoStream = (canvas as any).captureStream(60);
            const audioStream = audioService.current.getAudioStream();
            
            const combinedTracks = [...videoStream.getVideoTracks()];
            if (audioStream) {
                audioStream.getAudioTracks().forEach(track => { 
                    if (track.enabled) combinedTracks.push(track); 
                });
            }
            
            const combinedStream = new MediaStream(combinedTracks);
            try {
                // Switch to WebM/VP9/Opus for better browser compatibility
                let mimeType = 'video/webm;codecs=vp9,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
                
                const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 12000000 });
                recordedChunksRef.current = [];
                recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
                recorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const now = new Date();
                    a.download = `VISUS_${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };
                recorder.start();
                mediaRecorderRef.current = recorder;
                setIsRecording(true);
            } catch (e) { alert("Recording failed: " + e); }
        }
    };

    const updateSyncParams = (index: number, changes: Partial<SyncParam>) => {
        const newParams = [...syncParams];
        newParams[index] = { ...newParams[index], ...changes };
        setSyncParams(newParams);
        audioService.current.updateFilters(newParams);
    };

    // --- LANDING SCREEN ---
    if (!isSystemActive) {
        return (
            <div className="flex items-center justify-center h-screen w-screen bg-slate-950 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black"></div>
                <div className="text-center p-12 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl max-w-lg relative z-10 animate-in fade-in duration-700 mx-4 flex flex-col items-center">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"></div>
                    <div className="mb-8 relative group w-32 h-32 flex items-center justify-center bg-black rounded-full border-4 border-white/10 shadow-[0_0_50px_rgba(167,139,250,0.3)] hover:scale-105 transition-transform duration-500">
                         <div className="absolute inset-0 bg-accent rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>
                         <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 select-none">V</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 tracking-tighter">VISUS</h1>
                    <button className="group relative px-16 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300 tracking-widest text-sm overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.15)]" onClick={() => setIsSystemActive(true)}>
                        <span className="relative z-10">INITIALIZE</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden bg-[#020617] relative font-sans text-slate-300 selection:bg-accent selection:text-white">
            <canvas ref={canvasRef} className="absolute z-10 origin-center" style={{boxShadow: '0 0 100px rgba(0,0,0,0.5)'}} />
            <video ref={videoRef} className="hidden" crossOrigin="anonymous" loop muted={false} playsInline />

            {/* Status Bar */}
            <div className="fixed top-4 right-4 z-50 font-mono text-[10px] text-slate-400 flex gap-4 bg-black/40 p-2 rounded-full backdrop-blur-xl border border-white/5 px-5 shadow-2xl pointer-events-none">
                <span className={fps < 55 ? 'text-red-400' : 'text-accent'}>FPS: {fps}</span>
                <span className="hidden md:inline">RES: {canvasRef.current?.width}x{canvasRef.current?.height}</span>
                {mixer.mic.active && <span className="text-red-500 animate-pulse font-black tracking-widest">● MIC</span>}
                {isRecording && <span className="text-red-500 animate-pulse font-black tracking-widest">● REC</span>}
            </div>

            {/* MODALS */}
            {showCatalog && (
                <MusicCatalog onSelect={loadMusicTrack} onClose={() => setShowCatalog(false)} />
            )}
            {showCameraSelector && (
                 <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-white font-black tracking-widest text-lg">SELECT CAMERA</h3>
                            <button onClick={() => setShowCameraSelector(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white">✕</button>
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

            {/* MAIN UI PANEL */}
            <div ref={uiPanelRef} className={`fixed z-40 glass-panel flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:top-0 md:left-0 md:h-full md:w-[380px] md:border-r md:border-t-0 md:rounded-none ${panelVisible ? 'md:translate-x-0' : 'md:-translate-x-full'} bottom-0 left-0 w-full h-[60vh] rounded-t-3xl border-t border-white/10 ${panelVisible ? 'translate-y-0' : 'translate-y-[110%]'}`}>
                <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setPanelVisible(false)}>
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div className="px-6 py-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full border border-white/10 shadow-lg bg-gradient-to-br from-amber-400 via-pink-500 to-indigo-600 flex items-center justify-center"><span className="font-black text-white text-xs">V</span></div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter leading-none">VISUS</h2>
                            <div className="text-[9px] text-accent font-mono tracking-[0.3em] opacity-80">MIXER CONSOLE</div>
                        </div>
                    </div>
                    <button onClick={() => setPanelVisible(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar space-y-8 pb-24">
                    
                    {/* MIXER SECTION */}
                    <section>
                         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span> 
                            Source Mixer
                        </div>
                        
                        <div className="flex justify-between gap-2 p-2 bg-black/30 rounded-2xl border border-white/10">
                            
                            {/* VIDEO CHANNEL */}
                            <MixerChannel 
                                label="VIDEO" icon="🎞️" 
                                isActive={mixer.video.active} 
                                volume={mixer.video.volume}
                                vuLevel={vuLevels.video}
                                isPlaying={mixer.video.playing}
                                onToggle={(val) => updateMixer('video', { active: val })}
                                onVolumeChange={(val) => updateMixer('video', { volume: val })}
                                onPlayPause={() => toggleTransport('video')}
                                onStop={() => stopTransport('video')}
                                color="#38bdf8"
                            >
                                <div className="flex gap-1 w-full justify-between">
                                    <label className="w-8 h-6 bg-white/5 hover:bg-white/10 rounded cursor-pointer flex items-center justify-center text-[10px] border border-white/5">
                                        📁
                                        <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile('video', e)} />
                                    </label>
                                    <button onClick={initCamera} className="w-8 h-6 bg-white/5 hover:bg-white/10 rounded flex items-center justify-center text-[10px] border border-white/5">📷</button>
                                </div>
                            </MixerChannel>

                            {/* MUSIC CHANNEL */}
                            <MixerChannel 
                                label="MUSIC" icon="♫" 
                                isActive={mixer.music.active} 
                                volume={mixer.music.volume}
                                vuLevel={vuLevels.music}
                                isPlaying={mixer.music.playing}
                                onToggle={(val) => updateMixer('music', { active: val })}
                                onVolumeChange={(val) => updateMixer('music', { volume: val })}
                                onPlayPause={() => toggleTransport('music')}
                                onStop={() => stopTransport('music')}
                                color="#f472b6"
                            >
                                <div className="flex gap-1 w-full justify-between">
                                     <label className="w-8 h-6 bg-white/5 hover:bg-white/10 rounded cursor-pointer flex items-center justify-center text-[10px] border border-white/5">
                                        📁
                                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile('audio', e)} />
                                    </label>
                                    <button onClick={() => setShowCatalog(true)} className="w-8 h-6 bg-white/5 hover:bg-white/10 rounded flex items-center justify-center text-[8px] font-bold border border-white/5">WEB</button>
                                </div>
                            </MixerChannel>

                            {/* MIC CHANNEL */}
                            <MixerChannel 
                                label="MIC" icon="🎙️" 
                                isActive={mixer.mic.active} 
                                volume={mixer.mic.volume}
                                vuLevel={vuLevels.mic}
                                onToggle={toggleMic}
                                onVolumeChange={(val) => updateMixer('mic', { volume: val })}
                                color="#ef4444"
                            />
                        </div>
                        
                        {mixer.music.name && (
                            <div className="mt-2 text-center text-[9px] text-accent truncate px-2 bg-accent/5 rounded py-1 border border-accent/20">
                                ♫ {mixer.music.name}
                            </div>
                        )}
                    </section>

                    {/* FORMAT SECTION */}
                    <section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                             Output & Framing
                        </div>
                        <div className="grid grid-cols-3 gap-1 mb-3">
                            {['native', '16:9', '9:16', '4:5', '1:1', 'fit'].map(r => (
                                <button key={r} onClick={() => setAspectRatio(r as AspectRatioMode)} className={`p-2 text-[9px] font-bold rounded border ${aspectRatio === r ? 'bg-accent text-black border-transparent' : 'bg-white/5 border-white/5 text-slate-400'}`}>{r.toUpperCase()}</button>
                            ))}
                        </div>
                         <button 
                            onClick={toggleRecording}
                            className={`w-full py-3 mt-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-3 tracking-widest ${isRecording ? 'bg-red-500/20 text-red-200 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:border-white/20'}`}
                        >
                            {isRecording ? <span className="animate-pulse flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> RECORDING (WEBM)</span> : <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> REC VIDEO (WEBM)</span>}
                        </button>
                    </section>

                    {/* FREQ ANALYSIS */}
                    <section>
                        <SpectrumVisualizer audioServiceRef={audioService} syncParams={syncParams} onParamChange={updateSyncParams} />
                         <BandControls syncParams={syncParams} setSyncParams={setSyncParams} onUpdateFilters={(p) => audioService.current.updateFilters(p)} />
                    </section>

                    {/* FX STACK */}
                    <section>
                         <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span> 
                                FX Chain
                            </div>
                        </div>
                        <FxSlot category="main" slotName="main" fxState={fxState} setFxState={setFxState} activeLevel={visualLevels.main} />
                        <div className="space-y-2 mt-4">
                            {['fx1', 'fx2', 'fx3', 'fx4', 'fx5'].map((fxName, i) => (
                                <FxSlot key={fxName} category="additive" title={`Layer ${i+1}`} slotName={fxName as keyof FxState} fxState={fxState} setFxState={setFxState} activeLevel={(visualLevels as any)[fxName]} />
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {!panelVisible && (
                <button onClick={() => setPanelVisible(true)} className="fixed bottom-8 left-8 z-50 bg-slate-900/80 border border-white/10 hover:border-accent hover:text-accent text-white w-14 h-14 flex items-center justify-center rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur transition-all hover:scale-110 group">
                    <span className="text-2xl block group-hover:rotate-90 transition-transform duration-500">⚙</span>
                </button>
            )}
        </div>
    );
};

export default App;
