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
import ExperimentalApp from './ExperimentalApp';
const ICON_PNG = '/visus/icon.png';

// --- ICONS (SVG) ---
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
    const lastVuUpdateRef = useRef<number>(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // --- STATE ---
    const [isSystemActive, setIsSystemActive] = useState(false);
    const [fps, setFps] = useState(0);
    const [panelVisible, setPanelVisible] = useState(true);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [isRecording, setIsRecording] = useState(false);
    const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
    
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
    const [fxVuLevels, setFxVuLevels] = useState({ main: 0, fx1: 0, fx2: 0, fx3: 0, fx4: 0, fx5: 0 });
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
    const fxVuLevelsRef = useRef(fxVuLevels);

    useEffect(() => { fxStateRef.current = fxState; }, [fxState]);
    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { isSystemActiveRef.current = isSystemActive; }, [isSystemActive]);
    useEffect(() => { additiveGainRef.current = additiveGain; }, [additiveGain]);
    useEffect(() => { transformRef.current = transform; }, [transform]);
    useEffect(() => { isMirroredRef.current = isMirrored; }, [isMirrored]);
    useEffect(() => { mixerRef.current = mixer; }, [mixer]);
    useEffect(() => { fxVuLevelsRef.current = fxVuLevels; }, [fxVuLevels]);

    // Apply Mixer Volume Changes
    useEffect(() => {
        const ae = audioService.current;
        ae.setVolume('video', mixer.video.active ? mixer.video.volume : 0);
        ae.setVolume('music', mixer.music.active ? mixer.music.volume : 0);
        ae.setVolume('mic', mixer.mic.active ? mixer.mic.volume : 0);
        // Note: Mic connection logic moved to handler to satisfy browser policies
    }, [mixer.video.volume, mixer.video.active, mixer.music.volume, mixer.music.active, mixer.mic.volume, mixer.mic.active]);

    useEffect(() => {
        const tick = () => {
            const v = videoRef.current;
            if (v) {
                v.muted = true;
                if (v.paused) { v.play().catch(() => {}); }
            }
        };
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    // Auto-load sample video for diagnostics if nothing is loaded
    useEffect(() => {
        if (videoRef.current && !videoRef.current.src && !videoRef.current.srcObject) {
            try {
                videoRef.current.srcObject = null;
                const sampleUrl = (((import.meta as any).env?.BASE_URL) || '/') + 'sample.mp4';
                videoRef.current.src = sampleUrl;
                videoRef.current.autoplay = true;
                videoRef.current.playsInline = true;
                videoRef.current.muted = true;
                videoRef.current.loop = true;
                videoRef.current.play().catch(() => {});
                audioService.current.connectVideo(videoRef.current);
                setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, active: true, playing: true } }));
            } catch {}
        }
    }, []);

    const getActivationLevel = (routing: string, phase: number) => {
        if (routing === 'off') return 1.0;
        if (routing === 'bpm') return (phase < 0.15) ? 1.0 : 0.0;
        const ae = audioService.current;
        const bandsGain = syncParamsRef.current;
        if (routing === 'sync1') return ae.bands.sync1 * (bandsGain[0]?.gain ?? 1);
        if (routing === 'sync2') return ae.bands.sync2 * (bandsGain[1]?.gain ?? 1);
        if (routing === 'sync3') return ae.bands.sync3 * (bandsGain[2]?.gain ?? 1);
        return 0;
    };

    const handleResize = useCallback(() => {
        if (!canvasRef.current) return;
        
        const wWindow = window.innerWidth;
        const hWindow = window.innerHeight;
        const isMobileNow = wWindow < 768;
        setIsMobile(isMobileNow);
        const panelWidth = (panelVisible && uiPanelRef.current) ? uiPanelRef.current.getBoundingClientRect().width : 0;
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

        const canvas = canvasRef.current;
        if (canvas.width !== finalW || canvas.height !== finalH) {
             canvas.width = finalW;
             canvas.height = finalH;
        }

        const scale = Math.min(availableW / finalW, availableH / finalH);
        const displayW = finalW * scale;
        const displayH = finalH * scale;

        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        canvas.style.left = `${(isMobileNow ? (wWindow - displayW) / 2 : panelWidth + sideGap + (availableW - displayW) / 2)}px`;
        canvas.style.top = `${topOffset + (availableH - displayH) / 2}px`;
        canvas.style.position = 'absolute';
        canvas.style.zIndex = '10';
        canvas.style.backgroundColor = 'transparent';
        canvas.style.pointerEvents = 'none';
        canvas.style.border = '2px solid red'; // debug visibility
        canvas.style.opacity = '1';

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

        const schedule = (fn: () => void) => {
            const ric = (window as any).requestIdleCallback;
            if (typeof ric === 'function') ric(fn);
            else setTimeout(fn, 0);
        };

        schedule(() => {
            if (canvasRef.current) {
                const success = glService.current.init(canvasRef.current);
                if (success) {
                    const currentShaderKey = fxStateRef.current.main.shader;
                    const shaderDef = SHADER_LIST[currentShaderKey] || SHADER_LIST['00_NONE'];
                    glService.current.loadShader(shaderDef.src, currentShaderKey);
                    const fragments = Object.entries(SHADER_LIST).map(([k,v]) => ({ label: k, src: v.src }));
                    glService.current.warmAllShadersAsync(fragments);
                }
            }

            audioService.current.initContext().then(() => {
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
                
                if ((t - lastVuUpdateRef.current) > 40) {
                    const levels = ae.getLevels();
                    setVuLevels(levels);
                    lastVuUpdateRef.current = t;
                }

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
                    const gainMult = (config.gain ?? 100) / 100;
                    const boosted = (Math.pow(sourceLevel, 0.4) * gainMult * 14.0) + (config.routing === 'off' ? 0 : 0.4);
                    return Math.min(18.0, boosted);
                };

                const computeFxVu = (config: any) => {
                    const sourceLevel = getActivationLevel(config.routing, phase);
                    const gainMult = (config.gain ?? 100) / 100;
                    return Math.min(1.5, Math.pow(sourceLevel, 0.5) * gainMult);
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
                    mainMix: (currentFxState.main.mix ?? 100) / 100,
                    mix: currentFxState.main.mix,
                    additiveMasterGain: additiveGainRef.current / 100,
                    transform: currentTransform,
                    isMirrored: isMirroredRef.current,
                    fx1: lvls.fx1, fx2: lvls.fx2, fx3: lvls.fx3, fx4: lvls.fx4, fx5: lvls.fx5,
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

                if (videoRef.current) {
                    glService.current.updateTexture(videoRef.current);
                    glService.current.draw(t, videoRef.current, computedFx);
                }

                if (t - lastTimeRef.current > 100) {
                    const dt = t - lastTimeRef.current;
                    const instFps = dt > 0 ? 1000 / dt : 0;
                    const smooth = (fps * 0.7) + (instFps * 0.3);
                    setFps(Math.round(smooth));
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
        });
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
            } catch (e: any) {
                console.error("Mic Error:", e);
                let msg = "Could not access microphone.";
                if (e.name === 'NotAllowedError') msg += " Permission denied. Please click the Lock icon in your address bar and Allow Microphone.";
                else if (e.name === 'NotFoundError') msg += " No microphone found.";
                else msg += " " + e.message;
                
                alert(msg);
                setMixer(prev => ({ ...prev, mic: { ...prev.mic, active: false } }));
                audioService.current.disconnectMic();
            }
        } else {
            audioService.current.disconnectMic(); 
        }
    };

    const updateMixer = (channel: 'video' | 'music' | 'mic', changes: any) => {
        setMixer(prev => ({
            ...prev,
            [channel]: { ...prev[channel], ...changes }
        }));
    };

    const toggleTransport = async (channel: 'video' | 'music') => {
        // Ensure context is running whenever user clicks Play
        if (audioService.current.ctx?.state === 'suspended') {
            await audioService.current.ctx.resume();
        }

        if (channel === 'video' && videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(e => console.error("Video play fail", e));
                updateMixer('video', { playing: true });
            } else {
                videoRef.current.pause();
                updateMixer('video', { playing: false });
            }
        } else if (channel === 'music' && currentAudioElRef.current) {
             if (currentAudioElRef.current.paused) {
                currentAudioElRef.current.play().catch(e => console.error("Audio play fail", e));
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
            try {
                const file = e.target.files[0];
                const url = URL.createObjectURL(file);
                
                if (type === 'video' && videoRef.current) {
                    // Video Source Logic - WITH REUSE CHECK
                    try {
                        videoRef.current.srcObject = null;
                        if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) URL.revokeObjectURL(videoRef.current.src);
                        videoRef.current.src = url;
                        videoRef.current.volume = 1.0; 
                        videoRef.current.muted = true; // allow autoplay
                        
                        // Safe connect
                        audioService.current.connectVideo(videoRef.current);
                        audioService.current.setupFilters(syncParamsRef.current);

                        const tryPlay = async () => {
                            try {
                                await videoRef.current!.play();
                            } catch (e) {
                                videoRef.current!.muted = true;
                                try { await videoRef.current!.play(); } catch {}
                                console.log("Auto-play prevented", e);
                            }
                        };
                        tryPlay();
                        videoRef.current.onloadedmetadata = () => {
                            setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, active: true, playing: !videoRef.current?.paused } }));
                            setTimeout(handleResize, 50);
                        };
                        setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, active: true, playing: true } }));
                        
                        setTimeout(handleResize, 500);
                    } catch(err) {
                        console.error("Error setting video source", err);
                    }

                } else if (type === 'audio') {
                    loadMusicTrack(url, file.name.replace(/\.[^/.]+$/, ""));
                }
            } catch (err) {
                console.error("File loading error", err);
                alert("Could not load file. Please try another.");
            }
        }
    };

    const initCamera = async () => {
         if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            alert("Camera API not supported in this browser.");
            return;
        }
        try {
            // Requesting basic video permission first.
            await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } }); 
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            setAvailableCameras(videoInputs);
            
            if (videoInputs.length > 0) setShowCameraSelector(true);
            else alert("Permission granted, but no cameras found.");
            
        } catch(e: any) {
            console.error(e);
            let msg = "Camera Error: ";
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                 msg += "Permission denied. Please allow camera access in your browser settings (Lock icon).";
            } else {
                 msg += e.message || "Unknown error.";
            }
            alert(msg);
        }
    };

    const startCamera = async (deviceId?: string) => {
        if (!videoRef.current) return;
        try {
            const constraints: MediaStreamConstraints = { 
                video: { 
                    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: cameraFacing } }),
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                } 
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (videoRef.current.srcObject) { 
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); 
            }
            
            videoRef.current.src = "";
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            
            audioService.current.connectVideo(videoRef.current);
            setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, playing: true } }));
            
            setShowCameraSelector(false);
            setTimeout(handleResize, 500);
        } catch (e: any) { 
            alert("Failed to start camera: " + e.message); 
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            // Ensure audio context is running before we try to capture its destination
            await audioService.current.initContext();
            if (audioService.current.ctx?.state === 'suspended') {
                try { await audioService.current.ctx.resume(); } catch {}
            }

            const canvas = canvasRef.current;
            if (!canvas) return;
            const videoStream = (canvas as any).captureStream(30);
            const videoTracks = videoStream.getVideoTracks();
            const recordingAudio = audioService.current.createRecordingStream();

            const pickFirstLiveTrack = (streams: Array<{ stream: MediaStream | null, label: string }>) => {
                for (const entry of streams) {
                    if (!entry.stream) continue;
                    const t = entry.stream.getAudioTracks().find(track => track.readyState === 'live');
                    if (t) {
                        t.enabled = true;
                        console.debug('Using audio track from', entry.label, t.label);
                        return t;
                    }
                }
                return null;
            };

            const candidateStreams = [
                { stream: currentAudioElRef.current && (currentAudioElRef.current as any).captureStream ? (currentAudioElRef.current as any).captureStream() : null, label: 'audio element captureStream' },
                { stream: recordingAudio.stream, label: 'recording stream' },
                { stream: videoRef.current && (videoRef.current as any).captureStream ? (videoRef.current as any).captureStream() : null, label: 'video element captureStream' },
            ];

            const audioTrack = pickFirstLiveTrack(candidateStreams);

            if (!audioTrack) {
                alert('Brak ścieżki audio w nagraniu (0 tracków). Upewnij się, że źródło audio jest włączone.');
                return;
            }

            const combinedStream = new MediaStream([...videoTracks, audioTrack]);
            try {
                const pickMimeType = () => {
                    // Prefer WebM/Opus (best supported for mixed Web Audio); mp4 only as Safari fallback
                    const candidates = [
                        'video/webm;codecs=vp9,opus',
                        'video/webm;codecs=vp8,opus',
                        'video/webm',
                        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
                        'video/mp4'
                    ];
                    return candidates.find(mt => MediaRecorder.isTypeSupported(mt));
                };
                const mimeType = pickMimeType();
                if (!mimeType) {
                    alert('MediaRecorder: brak obsługiwanego formatu (mp4/webm).');
                    return;
                }
                const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
                
                const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 12000000, audioBitsPerSecond: 192000 });
                recordedChunksRef.current = [];
                recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
                recorder.onstop = () => {
                    recordingAudio.cleanup();
                    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const now = new Date();
                    a.download = `VISUS_${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}.${fileExt}`;
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

    const updateTransform = (key: keyof TransformConfig, value: number) => {
        setTransform(prev => ({ ...prev, [key]: value }));
    };

    if (isSystemActive) {
        return <ExperimentalApp onExit={() => setIsSystemActive(false)} />;
    }

    // --- LANDING SCREEN ---
    if (!isSystemActive) {
        return (
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
                        <button className="group relative px-16 py-5 bg-white text-black font-bold rounded-full hover:scale-105 transition-all duration-300 tracking-widest text-sm overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.15)]" onClick={() => { setIsSystemActive(true); }}>
                            <span className="relative z-10">INITIALIZE</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden bg-[#020617] relative font-sans text-slate-300 selection:bg-accent selection:text-white">
            <canvas
                ref={canvasRef}
                className={`absolute origin-center ${isMobile && panelVisible ? 'z-50 pointer-events-none' : 'z-10'}`}
                style={{boxShadow: '0 0 100px rgba(0,0,0,0.5)'}}
            />
            <video
                ref={videoRef}
                className="fixed top-2 right-2 w-48 h-32 z-[200] opacity-70 pointer-events-none border border-accent"
                crossOrigin="anonymous"
                loop
                muted
                playsInline
                autoPlay
            />

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

            {/* MAIN UI PANEL */}
            <div ref={uiPanelRef} className={`fixed z-40 glass-panel flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:top-0 md:left-0 md:h-full md:w-[380px] md:border-r md:border-t-0 md:rounded-none ${panelVisible ? 'md:translate-x-0' : 'md:-translate-x-full'} bottom-0 left-0 w-full h-[60vh] rounded-t-3xl border-t border-white/10 ${panelVisible ? 'translate-y-0' : 'translate-y-[110%]'}`}>
                <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setPanelVisible(false)}>
                    <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div className="px-6 py-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-white/5 to-transparent">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full border border-white/10 shadow-lg bg-black flex items-center justify-center overflow-hidden"><img src={ICON_PNG} alt="Logo" className="w-full h-full object-cover" /></div>
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
                                label="VIDEO" icon={ICONS.Video} 
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
                                    <label className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded cursor-pointer flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Open Video File">
                                        {ICONS.Folder}
                                        <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile('video', e)} />
                                    </label>
                                    <button onClick={initCamera} className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Select Camera">
                                        {ICONS.Camera}
                                    </button>
                                </div>
                            </MixerChannel>

                            {/* MUSIC CHANNEL */}
                            <MixerChannel 
                                label="MUSIC" icon={ICONS.Music} 
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
                                     <label className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded cursor-pointer flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Open Audio File">
                                        {ICONS.Folder}
                                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFile('audio', e)} />
                                    </label>
                                    <button onClick={() => setShowCatalog(true)} className="flex-1 h-7 bg-white/5 hover:bg-white/10 hover:text-white rounded flex items-center justify-center text-slate-400 border border-white/5 transition-all" title="Search iTunes">
                                        {ICONS.Globe}
                                    </button>
                                </div>
                            </MixerChannel>

                            {/* MIC CHANNEL */}
                            <MixerChannel 
                                label="MIC" icon={ICONS.Mic} 
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
                        
                        {/* GEOMETRY CONTROLS */}
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

                         <button 
                            onClick={toggleRecording}
                            className={`w-full py-3 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-3 tracking-widest ${isRecording ? 'bg-red-500/20 text-red-200 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:border-white/20'}`}
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
                    <span className="text-white group-hover:text-accent group-hover:rotate-90 transition-all duration-500">{ICONS.Settings}</span>
                </button>
            )}
        </div>
    );
};

export default App;
