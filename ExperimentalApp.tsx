import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FastGLService, ExperimentalFxPacket } from './services/fastGlService';
import { ExperimentalAudioEngine } from './services/experimentalAudioService';
import { FxState, SyncParam, AspectRatioMode, TransformConfig, SHADER_LIST, QualityMode, QUALITY_SCALE, FallbackReason } from './constants';
import RenderWorker from './services/renderWorker?worker';
import FxSlot from './components/FxSlot';
import BandControls from './components/BandControls';
import SpectrumVisualizer from './components/SpectrumVisualizer';
import MusicCatalog from './components/MusicCatalog';
import Knob from './components/Knob';
import MixerChannel from './components/MixerChannel';

const ICON_PNG = '/visus/icon.png';

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
        result.webgl2 = !!probeCanvas.getContext('webgl2');
        result.webgl = !!probeCanvas.getContext('webgl');
    } catch (err) {
        console.error('[VISUS] WebGL probe exception:', err);
    }
    console.info('[VISUS] WebGL probe webgl2:', result.webgl2, 'webgl:', result.webgl);
    return result;
};

type RenderMode = 'webgl-worker' | 'webgl-fastgl' | 'canvas2d';

interface ExperimentalProps {
    onExit: () => void;
}

const Credits: React.FC = () => (
    <div className="fixed bottom-3 left-4 z-[120] text-[10px] text-slate-200 bg-black/70 border border-white/10 px-4 py-2 rounded-full backdrop-blur pointer-events-none flex items-center gap-2">
        <span className="opacity-90">Studio Popłoch © 2025 • Pan Grzyb •</span>
        <a className="underline pointer-events-auto" href="mailto:ptr@o2.pl">ptr@o2.pl</a>
        <span className="opacity-90">• v0.2.4</span>
    </div>
);

const ExperimentalApp: React.FC<ExperimentalProps> = ({ onExit }) => {
    const rendererRef = useRef<FastGLService>(new FastGLService());
    const workerRef = useRef<Worker | null>(null);
    const workerReadyRef = useRef(false);
    const bitmapInFlightRef = useRef(false);
    const useWorkerRenderRef = useRef(false);
    const canvas2dRef = useRef<CanvasRenderingContext2D | null>(null);
    const webCodecsSupported = typeof (window as any).VideoEncoder !== 'undefined' && typeof (window as any).MediaStreamTrackProcessor !== 'undefined';
    const audioRef = useRef<ExperimentalAudioEngine>(new ExperimentalAudioEngine());
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const uiPanelRef = useRef<HTMLDivElement>(null);

    const rafRef = useRef<number>(0);
    const lastFrameRef = useRef<number>(0);
    const lastUiUpdateRef = useRef<number>(0);
    const lastFpsTickRef = useRef<number>(0);
    const fpsSmoothRef = useRef<number>(60);
    const frameIndexRef = useRef<number>(0);
    const slowFrameStreakRef = useRef<number>(0);
    const lastBandLevelsRef = useRef<{ sync1: number; sync2: number; sync3: number }>({ sync1: 0, sync2: 0, sync3: 0 });
    const lastFftDataRef = useRef<Uint8Array | null>(null);
    const lastDtRef = useRef<number>(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

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
    const [recordFps, setRecordFps] = useState(45);
    const [recordBitrate, setRecordBitrate] = useState(8000000);
    const [useWebCodecsRecord, setUseWebCodecsRecord] = useState(webCodecsSupported);
    const [autoScale, setAutoScale] = useState(true);
    const [renderScale, setRenderScale] = useState(QUALITY_SCALE.high);
    const [quality, setQuality] = useState<QualityMode>('high');
    const [performanceMode, setPerformanceMode] = useState<PerformanceMode>(getPerformanceMode());
    const [uiFpsLimit, setUiFpsLimit] = useState<number>(getUiFpsLimit());
    const [lockResolution, setLockResolution] = useState<boolean>(getLockResolution());
    const frameCapRef = useRef<number>(frameCap);
    const uiFpsLimitRef = useRef<number>(uiFpsLimit);
    const performanceModeRef = useRef<PerformanceMode>(performanceMode);
    const frameCapModeRef = useRef<'dynamic' | 'manual'>(frameCapMode);
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

    const [mixer, setMixer] = useState({
        video: { active: true, volume: 1.0, hasSource: false, playing: false },
        music: { active: true, volume: 0.8, hasSource: false, playing: false, name: '' },
        mic: { active: false, volume: 1.5, hasSource: false }
    });

    const fxStateRef = useRef(fxState);
    const syncParamsRef = useRef(syncParams);
    const additiveGainRef = useRef(additiveGain);
    const transformRef = useRef(transform);
    const isMirroredRef = useRef(isMirrored);
    const renderScaleRef = useRef(renderScale);
    const renderModeRef = useRef<RenderMode>(renderMode);
    const fxPreferenceRef = useRef(fxPreference);
    const fallbackReasonRef = useRef<FallbackReason>('NONE');
    const fxVuLevelsRef = useRef(fxVuLevels);
    const visualLevelsRef = useRef(visualLevels);
    const mixerRef = useRef(mixer);

    useEffect(() => { fxStateRef.current = fxState; }, [fxState]);
    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { additiveGainRef.current = additiveGain; }, [additiveGain]);
    useEffect(() => { transformRef.current = transform; }, [transform]);
    useEffect(() => { isMirroredRef.current = isMirrored; }, [isMirrored]);
    useEffect(() => { renderScaleRef.current = renderScale; }, [renderScale]);
    useEffect(() => { renderModeRef.current = renderMode; }, [renderMode]);
    useEffect(() => { fxPreferenceRef.current = fxPreference; }, [fxPreference]);
    useEffect(() => { fallbackReasonRef.current = fallbackReason; }, [fallbackReason]);
    useEffect(() => { fxVuLevelsRef.current = fxVuLevels; }, [fxVuLevels]);
    useEffect(() => { mixerRef.current = mixer; }, [mixer]);
    useEffect(() => { visualLevelsRef.current = visualLevels; }, [visualLevels]);
    useEffect(() => { performanceModeRef.current = performanceMode; localStorage.setItem('visus_perf_mode', performanceMode); }, [performanceMode]);
    useEffect(() => { uiFpsLimitRef.current = uiFpsLimit; localStorage.setItem('visus_ui_fps', String(uiFpsLimit)); }, [uiFpsLimit]);
    useEffect(() => { frameCapRef.current = frameCap; localStorage.setItem('visus_framecap', String(frameCap)); }, [frameCap]);
    useEffect(() => { frameCapModeRef.current = frameCapMode; localStorage.setItem('visus_framecap_mode', frameCapMode); }, [frameCapMode]);
    useEffect(() => { localStorage.setItem('visus_lock_res', lockResolution ? '1' : '0'); }, [lockResolution]);
    useEffect(() => { setFxPreference(getFxPreference()); }, []);
    useEffect(() => {
        setRenderPreference(getRenderPreference());
        setWorkerPreference(getWorkerPreference());
    }, []);

    useEffect(() => {
        const ae = audioRef.current;
        ae.setVolume('video', mixer.video.active ? mixer.video.volume : 0);
        ae.setVolume('music', mixer.music.active ? mixer.music.volume : 0);
        ae.setVolume('mic', mixer.mic.active ? mixer.mic.volume : 0);
        if ((ae as any).setChannelActive) {
            (ae as any).setChannelActive('video', mixer.video.active);
            (ae as any).setChannelActive('music', mixer.music.active);
            (ae as any).setChannelActive('mic', mixer.mic.active);
        }
    }, [mixer.video.volume, mixer.video.active, mixer.music.volume, mixer.music.active, mixer.mic.volume, mixer.mic.active]);

    const getActivationLevel = (routing: string, phase: number) => {
        if (routing === 'off') return 1.0;
        if (routing === 'bpm') return (phase < 0.15) ? 1.0 : 0.0;
        const ae = audioRef.current;
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
        const scale = Math.min(availableW / finalW, availableH / finalH);
        const displayW = finalW * scale;
        const displayH = finalH * scale;

        const renderW = Math.max(4, Math.round(finalW * renderScaleRef.current));
        const renderH = Math.max(4, Math.round(finalH * renderScaleRef.current));

        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        canvas.style.left = `${(isMobileNow ? (wWindow - displayW) / 2 : panelWidth + sideGap + (availableW - displayW) / 2)}px`;
        canvas.style.top = `${topOffset + (availableH - displayH) / 2}px`;

        if (useWorkerRenderRef.current && workerRef.current) {
            workerRef.current.postMessage({ type: 'resize', width: renderW, height: renderH });
        } else {
            rendererRef.current.resize(renderW, renderH);
        }
    }, [aspectRatio, panelVisible]);

    useEffect(() => {
        handleResize();
        const t = setTimeout(handleResize, 300);
        window.addEventListener('resize', handleResize);
        const v = videoRef.current;
        if (v) v.addEventListener('loadedmetadata', handleResize);
        return () => {
            clearTimeout(t);
            window.removeEventListener('resize', handleResize);
            if (v) v.removeEventListener('loadedmetadata', handleResize);
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
                        const webglReady = rendererRef.current.init(canvas);
                        if (webglReady) {
                            const shaderDef = SHADER_LIST[fxStateRef.current.main.shader] || SHADER_LIST['00_NONE'];
                            const ok = rendererRef.current.loadShader(shaderDef.src);
                            if (!ok) {
                                setRenderMode('canvas2d');
                                setFallbackReason('SHADER_FAIL');
                                setLastShaderError(rendererRef.current.lastShaderError || 'shader init failed');
                                ensureCanvas2D();
                                console.warn('[VISUS] fallback Canvas2D (shader init failed)');
                            } else {
                                setRenderMode('webgl-fastgl');
                                setFallbackReason('NONE');
                                setLastShaderError('');
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

            audioRef.current.initContext().then(() => {
                audioRef.current.setupFilters(syncParamsRef.current);
                setIsBooting(false);
            });
            handleResize();
        };

        const schedule = (cb: () => void) => {
            if (typeof (window as any).requestIdleCallback === 'function') {
                (window as any).requestIdleCallback(cb);
            } else {
                setTimeout(cb, 0);
            }
        };

        schedule(initWork);

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
        if (renderMode === 'canvas2d') return;
        const shaderDef = SHADER_LIST[fxState.main.shader] || SHADER_LIST['00_NONE'];
        if (renderMode === 'webgl-worker' && workerReadyRef.current && workerRef.current) {
            workerRef.current.postMessage({ type: 'loadShader', fragSrc: shaderDef.src });
            setFallbackReason('NONE');
            setLastShaderError('');
            console.info('[VISUS] start FX (worker):', fxState.main.shader);
        } else if (renderMode === 'webgl-fastgl') {
            const ok = rendererRef.current.loadShader(shaderDef.src);
            if (!ok) {
                setRenderMode('canvas2d');
                setFallbackReason('SHADER_FAIL');
                setLastShaderError(rendererRef.current.lastShaderError || 'shader init failed');
                const ctx = canvasRef.current?.getContext('2d') || null;
                if (ctx) canvas2dRef.current = ctx;
                console.warn('[VISUS] fallback Canvas2D (shader compile failure)');
            } else {
                setFallbackReason('NONE');
                setLastShaderError('');
                console.info('[VISUS] start FX (fastgl):', fxState.main.shader);
            }
        }
    }, [fxState.main.shader, renderMode]);

    useEffect(() => {
        let mounted = true;

        const loop = (t: number) => {
            if (!mounted) return;

            const capTarget = frameCapRef.current;
            const frameBudget = capTarget > 0 ? (1000 / capTarget) : 0;
            if (frameBudget && (t - lastFrameRef.current) < frameBudget) {
                rafRef.current = requestAnimationFrame(loop);
                return;
            }

            const now = t;
            const dt = now - lastFrameRef.current;
            lastFrameRef.current = now;
            lastDtRef.current = dt;
            frameIndexRef.current += 1;

            const ae = audioRef.current;
            const isSlowFrame = dt > 40;
            if (isSlowFrame) {
                slowFrameStreakRef.current += 1;
            } else {
                slowFrameStreakRef.current = 0;
            }
            const skipHeavy = slowFrameStreakRef.current >= 2 && (frameIndexRef.current % 2 === 1);

            if (!skipHeavy) {
                ae.update();
            }
            const vu = ae.getLevelsFast(0.08); // channel RMS (video, music, mic)
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
                bandLevels.sync1 = Math.max(0, ae.bands.sync1 * (currentSyncParams[0]?.gain ?? 1));
                bandLevels.sync2 = Math.max(0, ae.bands.sync2 * (currentSyncParams[1]?.gain ?? 1));
                bandLevels.sync3 = Math.max(0, ae.bands.sync3 * (currentSyncParams[2]?.gain ?? 1));

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

                    const fftBands = {
                        sync1: sampleBand(currentSyncParams[0].freq, currentSyncParams[0].width, currentSyncParams[0]?.gain ?? 1),
                        sync2: sampleBand(currentSyncParams[1].freq, currentSyncParams[1].width, currentSyncParams[1]?.gain ?? 1),
                        sync3: sampleBand(currentSyncParams[2].freq, currentSyncParams[2].width, currentSyncParams[2]?.gain ?? 1),
                    };

                    const anyBand = bandLevels.sync1 + bandLevels.sync2 + bandLevels.sync3;
                    if (anyBand < 0.001) {
                        bandLevels.sync1 = fftBands.sync1;
                        bandLevels.sync2 = fftBands.sync2;
                        bandLevels.sync3 = fftBands.sync3;
                    } else {
                        bandLevels.sync1 = Math.max(bandLevels.sync1, fftBands.sync1);
                        bandLevels.sync2 = Math.max(bandLevels.sync2, fftBands.sync2);
                        bandLevels.sync3 = Math.max(bandLevels.sync3, fftBands.sync3);
                    }
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
            const fxCeiling = 24.0;
            const vuCeiling = 10.0;
            const fxAlpha = 0.30; // slightly snappier to avoid UI lag
            const vuAlpha = 0.35; // keep VU responsive without jitter

            const computeFxVal = (config: any, prev: number) => {
                const sourceLevel = Math.max(0, getLevel(config.routing));
                const gainMult = (config.gain ?? 100) / 100; // Depth knob as max
                const shaped = Math.pow(sourceLevel, 0.7);
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
                additiveMasterGain: additiveGainRef.current / 100,
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
            } else if (canUseWebGL && renderModeRef.current === 'webgl-fastgl' && videoRef.current && rendererRef.current.isReady()) {
                rendererRef.current.updateTexture(videoRef.current);
                rendererRef.current.draw(now, videoRef.current, computedFx);
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
                    const targetFps = capTarget || 60;
                    if (fpsSmoothRef.current < targetFps - 8 && currentIdx < targets.length - 1) {
                        const next = targets[currentIdx + 1];
                        setQuality(next.label);
                        setRenderScale(next.scale);
                        renderScaleRef.current = next.scale;
                        handleResize();
                    } else if (fpsSmoothRef.current > targetFps + 5 && currentIdx > 0) {
                        const next = targets[currentIdx - 1];
                        setQuality(next.label);
                        setRenderScale(next.scale);
                        renderScaleRef.current = next.scale;
                        handleResize();
                    }
                }

                lastFpsTickRef.current = now;
            }

            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            mounted = false;
            cancelAnimationFrame(rafRef.current);
        };
    }, [autoScale, handleResize, lockResolution]);

    const toggleMic = async (isActive: boolean) => {
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
                audioRef.current.disconnectMic();
            }
        } else {
            audioRef.current.disconnectMic();
        }
    };

    const updateMixer = (channel: 'video' | 'music' | 'mic', changes: any) => {
        setMixer(prev => ({
            ...prev,
            [channel]: { ...prev[channel], ...changes }
        }));
    };

    const toggleTransport = async (channel: 'video' | 'music') => {
        if (audioRef.current.ctx?.state === 'suspended') {
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
    };

    const stopTransport = (channel: 'video' | 'music') => {
        if (channel === 'video' && videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            updateMixer('video', { playing: false });
        } else if (channel === 'music' && audioElRef.current) {
            audioElRef.current.pause();
            audioElRef.current.currentTime = 0;
            updateMixer('music', { playing: false });
        }
    };

    const loadMusicTrack = (url: string, name: string) => {
        if (audioElRef.current) {
            audioElRef.current.pause();
        }

        const audio = new Audio();
        audio.src = url;
        audio.loop = true;
        audio.crossOrigin = 'anonymous';
        audioElRef.current = audio;

        audioRef.current.connectMusic(audio);
        audioRef.current.setupFilters(syncParamsRef.current);

        audio.play().then(() => {
            setMixer(prev => ({
                ...prev,
                music: { ...prev.music, hasSource: true, active: true, name: name, playing: true }
            }));
        }).catch(e => console.log('Auto-play prevented', e));

        setShowCatalog(false);
    };

    const handleFile = (type: 'video' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const file = e.target.files[0];
                const url = URL.createObjectURL(file);

                if (type === 'video' && videoRef.current) {
                    try {
                        videoRef.current.srcObject = null;
                        if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) URL.revokeObjectURL(videoRef.current.src);
                        videoRef.current.src = url;
                        videoRef.current.muted = false;
                        videoRef.current.loop = true;
                        videoRef.current.play().catch(() => {});
                        audioRef.current.connectVideo(videoRef.current);
                        audioRef.current.setupFilters(syncParamsRef.current);
                        setMixer(prev => ({ ...prev, video: { ...prev.video, hasSource: true, playing: true } }));
                    } catch (err) {
                        console.error('Video load failed', err);
                    }
                } else if (type === 'audio') {
                    loadMusicTrack(url, file.name);
                }
            } catch (err) {
                console.error(err);
            }
        }
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
            audioRef.current.connectVideo(videoRef.current);
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
    };

    
    const startMediaRecorderRecording = async (preferWebCodecs = false): Promise<boolean> => {
        if (!canvasRef.current) {
            alert('Canvas not ready yet.');
            return false;
        }
        try {
            await audioRef.current.initContext();
            if (audioRef.current.ctx?.state === 'suspended') {
                await audioRef.current.ctx.resume();
            }
        } catch (e) {
            console.warn('Audio context resume failed before recording', e);
        }

        const canvasStream = canvasRef.current.captureStream(Math.min(recordFps, 30));
        const videoTracks = canvasStream.getVideoTracks();

        const buildRecordingAudio = () => {
            const streamFactory = (audioRef.current as any).createRecordingStream;
            if (typeof streamFactory === 'function') {
                return streamFactory.call(audioRef.current);
            }
            const stream = audioRef.current.getAudioStream();
            return { stream, cleanup: () => {} };
        };
        const recordingAudio = buildRecordingAudio();
        const mixTracks: MediaStreamTrack[] = (recordingAudio.stream?.getAudioTracks() || [])
            .filter((t: MediaStreamTrack): t is MediaStreamTrack => t.readyState === 'live');
        mixTracks.forEach((t: MediaStreamTrack) => { t.enabled = true; });

        const channelActive = (audioRef.current as any).channelActive || {};
        const hasActiveAudioSource =
            (mixerRef.current.video.active && mixerRef.current.video.hasSource) ||
            (mixerRef.current.music.active && mixerRef.current.music.hasSource) ||
            (mixerRef.current.mic.active && mixerRef.current.mic.hasSource);
        console.info('[VISUS] record start', {
            channels: mixerRef.current,
            channelActive,
            mixTrackCount: mixTracks.length,
            videoTracks: videoTracks.length,
            videoSource: {
                hasSource: mixerRef.current.video.hasSource,
                playing: mixerRef.current.video.playing,
                attached: !!videoRef.current?.srcObject || !!videoRef.current?.src
            }
        });

        if (!hasActiveAudioSource) {
            console.warn('[VISUS] record aborted: no active VIDEO/MUSIC/MIC source armed for mix');
            recordingAudio.cleanup?.();
            alert('Brak aktywnego zrodla audio (VIDEO/MUSIC/MIC). Wlacz kanal i sprobuj ponownie.');
            return false;
        }

        if (mixTracks.length === 0) {
            console.warn('[VISUS] record aborted: master mix has 0 audio tracks');
            recordingAudio.cleanup?.();
            const msg = preferWebCodecs
                ? 'WebCodecs: master mix has no audio tracks (VIDEO/MUSIC/MIC). Turn on a source and retry.'
                : 'Brak sciezki audio w master mixie (VIDEO/MUSIC/MIC). Wlacz zrodlo i sprobuj ponownie.';
            alert(msg);
            if (preferWebCodecs) setUseWebCodecsRecord(false);
            return false;
        }

        const combinedStream = new MediaStream([...videoTracks, ...mixTracks]);
        console.debug('[VISUS] combinedStream audio tracks:', combinedStream.getAudioTracks().length);
        try {
            const pickMimeType = () => {
                const candidates = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm',
                    'video/mp4;codecs=h264,aac',
                    'video/mp4'
                ];
                return candidates.find(mt => MediaRecorder.isTypeSupported(mt));
            };
            const mimeType = pickMimeType();
            if (!mimeType) {
                recordingAudio.cleanup?.();
                alert('MediaRecorder: brak obslugiwanych formatow (mp4/webm).');
                return false;
            }
            const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
            console.debug('[VISUS] MediaRecorder mime selected:', mimeType);
            if (combinedStream.getAudioTracks().length === 0) {
                console.warn('[VISUS] combined stream missing audio track');
                recordingAudio.cleanup?.();
                alert('Nagrywanie przerwane: brak aktywnej sciezki audio w strumieniu.');
                return false;
            }
            const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: recordBitrate, audioBitsPerSecond: 192000 });
            recordedChunksRef.current = [];
            recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
            recorder.onerror = (event) => {
                console.error('[VISUS] MediaRecorder runtime error', event);
                recordingAudio.cleanup?.();
            };
            recorder.onstop = () => {
                recordingAudio.cleanup?.();
                const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const now = new Date();
                a.download = `VISUS_EXPERIMENTAL_${now.toISOString().replace(/[:.]/g, '-').slice(0, -5)}.${fileExt}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
            recorder.start(500);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            return true;
        } catch (e) {
            console.error('[VISUS] MediaRecorder error', e);
            recordingAudio.cleanup?.();
            alert('Recording failed: ' + e);
            return false;
        }
    };
const toggleRecording = async () => {
        if (isRecording) {
            if (useWebCodecsRecord && encoderRef.current) {
                await stopWebCodecsRecording();
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        if (useWebCodecsRecord && webCodecsSupported) {
            encodedChunksRef.current = [];
            const ok = await startMediaRecorderRecording(true);
            if (!ok) return;
            return;
        }

        await startMediaRecorderRecording(false);
    };

    const updateSyncParams = (index: number, changes: Partial<SyncParam>) => {
        const newParams = [...syncParams];
        newParams[index] = { ...newParams[index], ...changes };
        setSyncParams(newParams);
        audioRef.current.updateFilters(newParams);
    };

    const updateTransform = (key: keyof TransformConfig, value: number) => {
        setTransform(prev => ({ ...prev, [key]: value }));
    };

    const exitToLanding = () => {
        if (isRecording) toggleRecording();
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        onExit();
    };

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
                loop
                muted={false}
                playsInline
                autoPlay
            />

            {isBooting && (
                <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur flex items-center justify-center">
                    <div className="px-6 py-4 bg-black/80 border border-white/10 rounded-2xl text-center text-slate-200 shadow-2xl">
                        <div className="text-sm font-semibold mb-2">Loading shaders & audio</div>
                        <div className="text-[11px] text-slate-400">Initializing renderer and FX list</div>
                    </div>
                </div>
            )}

            <div className="fixed top-4 right-4 z-50 font-mono text-[10px] text-slate-200 flex gap-3 bg-black/70 p-2 rounded-full backdrop-blur-xl border border-white/5 px-5 shadow-2xl pointer-events-none">
                <span className={fps < 55 ? 'text-red-400' : 'text-accent'}>FPS: {fps}</span>
                <span className="hidden md:inline">dt: {lastDtRef.current.toFixed(1)}ms</span>
                <span className="hidden md:inline">Scale: {Math.round(renderScale * 100)}%</span>
                <span className="hidden md:inline">Cap: {frameCapMode === 'dynamic' ? `${frameCap} auto` : frameCap}</span>
                <span className="hidden md:inline">Mode: {renderMode}</span>
                <span className="hidden md:inline">Perf: {performanceMode}</span>
                {mixer.mic.active && <span className="text-red-400 font-black tracking-widest">MIC</span>}
                {isRecording && <span className="text-red-400 font-black tracking-widest">REC</span>}
            </div>
            {devMode && (
                <div className="fixed top-4 left-4 z-50 font-mono text-[10px] text-slate-300 bg-black/70 p-3 rounded-xl border border-white/10 shadow-xl space-y-1">
                    <div>render: {renderMode} (pref: {renderPreference}, worker: {workerPreference ? 'on' : 'off'})</div>
                    <div>probe webgl2/webgl: {webglProbe.webgl2 ? '✓' : '×'} / {webglProbe.webgl ? '✓' : '×'}</div>
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

                    <section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                            Performance Lab
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="text-[10px] text-slate-400 mb-1">Quality</div>
                                <select value={quality} onChange={(e) => setQuality(e.target.value as QualityMode)} className="w-full bg-black/60 border border-white/10 text-[11px] p-2 rounded-lg focus:border-accent outline-none">
                                    <option value="high">High (100%)</option>
                                    <option value="medium">Medium (75%)</option>
                                    <option value="low">Low (50%)</option>
                                    <option value="ultraLow">Ultra Low (35%)</option>
                                </select>
                                <label className="flex items-center gap-2 text-[11px] text-slate-300 mt-2">
                                    <input type="checkbox" checked={lockResolution} onChange={(e) => setLockResolution(e.target.checked)} />
                                    Lock resolution 0.5x (no auto up-scale)
                                </label>
                                <p className="text-[10px] text-slate-500 mt-1">Low/Medium/High/Ultra-Low render scale for GPU headroom.</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[10px] text-slate-400">Frame Cap</div>
                                    <label className="flex items-center gap-1 text-[10px] text-slate-300">
                                        <input type="checkbox" checked={frameCapMode === 'dynamic'} onChange={(e) => setFrameCapMode(e.target.checked ? 'dynamic' : 'manual')} />
                                        Auto
                                    </label>
                                </div>
                                <select value={frameCap} disabled={frameCapMode === 'dynamic'} onChange={(e) => setFrameCap(parseInt(e.target.value, 10))} className="w-full bg-black/60 border border-white/10 text-[11px] p-2 rounded-lg focus:border-accent outline-none disabled:opacity-50">
                                    <option value={75}>75</option>
                                    <option value={60}>60</option>
                                    <option value={45}>45</option>
                                    <option value={30}>30</option>
                                    <option value={24}>24</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">{frameCapMode === 'dynamic' ? 'Dynamic cap auto-drops to 30/24 FPS on slow frames.' : 'Skips draws when frame budget is exceeded.'}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="text-[10px] text-slate-400 mb-1">Performance Mode</div>
                                <select value={performanceMode} onChange={(e) => setPerformanceMode(e.target.value as PerformanceMode)} className="w-full bg-black/60 border border-white/10 text-[11px] p-2 rounded-lg focus:border-accent outline-none">
                                    <option value="high">High (FFT every frame)</option>
                                    <option value="medium">Medium (FFT every 2nd frame)</option>
                                    <option value="low">Low (FFT every 3rd frame)</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Throttle FFT/FX analysis on slower CPUs.</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="text-[10px] text-slate-400 mb-1">UI Update Limit</div>
                                <select value={uiFpsLimit} onChange={(e) => setUiFpsLimit(parseInt(e.target.value, 10))} className="w-full bg-black/60 border border-white/10 text-[11px] p-2 rounded-lg focus:border-accent outline-none">
                                    <option value={30}>30 FPS</option>
                                    <option value={20}>20 FPS</option>
                                    <option value={15}>15 FPS</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Throttles UI/VU state updates to reduce GC.</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="text-[10px] text-slate-400 mb-1">Recording FPS</div>
                                <select value={recordFps} onChange={(e) => setRecordFps(parseInt(e.target.value, 10))} className="w-full bg-black/60 border border-white/10 text-[11px] p-2 rounded-lg focus:border-accent outline-none">
                                    <option value={60}>60</option>
                                    <option value={50}>50</option>
                                    <option value={45}>45</option>
                                    <option value={30}>30</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Lower FPS reduces recorder overhead.</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="text-[10px] text-slate-400 mb-1">Recorder Bitrate</div>
                                <select value={recordBitrate} onChange={(e) => setRecordBitrate(parseInt(e.target.value, 10))} className="w-full bg-black/60 border border-white/10 text-[11px] p-2 rounded-lg focus:border-accent outline-none">
                                    <option value={12000000}>12 Mbps</option>
                                    <option value={9000000}>9 Mbps</option>
                                    <option value={8000000}>8 Mbps</option>
                                    <option value={6000000}>6 Mbps</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Tune for speed vs quality when exporting.</p>
                            </div>
                            {webCodecsSupported && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <div className="text-[10px] text-slate-400 mb-1">WebCodecs (video)</div>
                                    <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                        <input type="checkbox" checked={useWebCodecsRecord} onChange={(e) => setUseWebCodecsRecord(e.target.checked)} />
                                        Prefer WebCodecs encoder (video-only if audio unsupported)
                                    </label>
                                </div>
                            )}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                <div className="text-[10px] text-slate-400 mb-1">Auto Scale (LOD)</div>
                                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                                    <input type="checkbox" checked={autoScale} onChange={(e) => setAutoScale(e.target.checked)} />
                                    Adjust render scale based on FPS (disabled when locked)
                                </label>
                            </div>
                        </div>
                    </section>

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
                                {`>> ${mixer.music.name}`}
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

                        <button
                            onClick={toggleRecording}
                            className={`w-full py-3 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-3 tracking-widest ${isRecording ? 'bg-red-500/20 text-red-200 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:border-white/20'}`}
                        >
                            {isRecording ? <span className="animate-pulse flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> RECORDING (WEBM)</span> : <span className="flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> REC VIDEO (WEBM)</span>}
                        </button>
                        {useWebCodecsRecord && webCodecsSupported && (
                            <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-md px-3 py-2">
                                WebCodecs może nagrywać tylko wideo jeśli brak żywej ścieżki audio. Wyłącz WebCodecs, aby wymusić nagranie z dźwiękiem.
                            </div>
                        )}
                    </section>

                    <section>
                        <SpectrumVisualizer
                            audioServiceRef={audioRef}
                            syncParams={syncParams}
                            onParamChange={updateSyncParams}
                            enabled={mixer.video.active || mixer.music.active || mixer.mic.active}
                        />
                        <BandControls syncParams={syncParams} setSyncParams={setSyncParams} onUpdateFilters={(p) => audioRef.current.updateFilters(p)} />
                    </section>

                    <section>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                                FX Chain
                            </div>
                            <div className="text-[9px] text-slate-500">Additive Gain: <span className="text-accent font-semibold">{additiveGain}%</span></div>
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
                        <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
                            <div className="text-[10px] text-slate-400 mb-1">Additive Master</div>
                            <input type="range" min={0} max={200} step={1} value={additiveGain} onChange={(e) => setAdditiveGain(parseInt(e.target.value, 10))} className="w-full" />
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

export default ExperimentalApp;
