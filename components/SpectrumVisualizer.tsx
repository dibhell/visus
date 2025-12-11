

import React, { useEffect, useRef, useState, memo } from 'react';
import { AudioEngine } from '../services/audioService';
import { SyncParam } from '../constants';

interface Props {
    audioServiceRef: React.MutableRefObject<AudioEngine>;
    syncParams: SyncParam[];
    onParamChange: (index: number, changes: Partial<SyncParam>) => void;
    enabled?: boolean;
}

const SpectrumVisualizer: React.FC<Props> = ({ audioServiceRef, syncParams, onParamChange, enabled = true }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const syncParamsRef = useRef<SyncParam[]>(syncParams);
    const hoveredBandRef = useRef<number | null>(null);
    const smoothBandsRef = useRef({ sync1: 0, sync2: 0, sync3: 0 });

    const [hoveredBand, setHoveredBand] = useState<number | null>(null);
    const isDragging = useRef<number | null>(null);
    const [spectrumDebug, setSpectrumDebug] = useState({
        targetPeak: 0.98,
        minPeak: 0.04,
        maxGain: 12.0,
        boostExp: 0.45,
        boostMult: 2.5,
        minHeightFrac: 0.06,
        maxHeightFrac: 0.98,
    });
    const spectrumDebugRef = useRef(spectrumDebug);

    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { hoveredBandRef.current = hoveredBand; }, [hoveredBand]);
    useEffect(() => { spectrumDebugRef.current = spectrumDebug; }, [spectrumDebug]);

    // --- MATH HELPERS ---
    const getLogX = (freq: number, width: number) => {
        const minLog = Math.log10(20);
        const maxLog = Math.log10(20000);
        const valLog = Math.log10(Math.max(20, Math.min(20000, freq)));
        return ((valLog - minLog) / (maxLog - minLog)) * width;
    };

    const getFreqFromX = (x: number, width: number) => {
        const minLog = Math.log10(20);
        const maxLog = Math.log10(20000);
        const t = x / width;
        return Math.pow(10, minLog + t * (maxLog - minLog));
    };

    // --- DRAW LOOP ---
    useEffect(() => {
        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const ae = audioServiceRef.current;
            const W = rect.width;
            const H = rect.height;
            let debugSource = 'none';

            // 1. Background
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'; // Slate dark
            ctx.fillRect(0, 0, W, H);

            // 2. Grid
            ctx.lineWidth = 1;
            const drawGridLine = (freq: number, label: string) => {
                const x = getLogX(freq, W);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillText(label, x + 4, H - 6);
            };

            drawGridLine(100, '100');
            drawGridLine(1000, '1k');
            drawGridLine(10000, '10k');

            // 3. Spectrum Fill – high-res Ableton style
            const aeAny: any = ae;

            // 3.1 – pobierz FFT z AudioEngine (wysokiej rozdzielczości)
            let usedFFT: Uint8Array | null = null;

            if (aeAny?.getSpectrum) {
                try {
                    usedFFT = aeAny.getSpectrum();
                    debugSource = 'getSpectrum';
                } catch {
                    usedFFT = null;
                }
            }

            // awaryjnie: spróbuj innych źródeł FFT, jeśli getSpectrum nie istnieje
            if ((!usedFFT || usedFFT.length === 0) && aeAny?.getVizFFTBuffer) {
                try {
                    usedFFT = aeAny.getVizFFTBuffer();
                    debugSource = 'getVizFFTBuffer';
                } catch {
                    usedFFT = null;
                }
            }
            if ((!usedFFT || usedFFT.length === 0) && aeAny?.getFFTData) {
                try {
                    usedFFT = aeAny.getFFTData();
                    debugSource = 'getFFTData';
                } catch {
                    usedFFT = null;
                }
            }
            if (!usedFFT && aeAny?.vizAnalyser) {
                const analyser = aeAny.vizAnalyser as AnalyserNode;
                const buf = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(buf);
                usedFFT = buf;
                debugSource = 'vizAnalyser';
            }

            // 3.2 – bandy jako pewny fallback
            let rawBands = { sync1: 0, sync2: 0, sync3: 0 };
            if (aeAny?.getBandLevels) {
                rawBands = aeAny.getBandLevels() || rawBands;
            } else if (aeAny?.vuWorkletBands && aeAny.vuWorkletBands.video) {
                const vb = aeAny.vuWorkletBands.video;
                rawBands = {
                    sync1: vb[0] || 0,
                    sync2: vb[1] || 0,
                    sync3: vb[2] || 0,
                };
            }

            // 3.3 – wygładzenie bandów (tylko dla fallbacku)
            const smooth = smoothBandsRef.current;
            const alpha = 0.6;
            smooth.sync1 = smooth.sync1 * (1 - alpha) + rawBands.sync1 * alpha;
            smooth.sync2 = smooth.sync2 * (1 - alpha) + rawBands.sync2 * alpha;
            smooth.sync3 = smooth.sync3 * (1 - alpha) + rawBands.sync3 * alpha;

            // 3.4 – helper rysowania krzywej (używany przez FFT i fallback)
            const drawSpectrum = (sampler: (i: number, bars: number) => number) => {
                const dbg = spectrumDebugRef.current;

                ctx.beginPath();

                // liczba punktów zależna od szerokości – wysoka rozdzielczość
                const bars = Math.min(1024, Math.max(256, Math.floor(W * 2.5)));
                // więcej próbek niż pikseli – gęstsza, bardziej „analogowa” krzywa

                const minHeight = H * dbg.minHeightFrac;
                const maxHeight = H * dbg.maxHeightFrac;

                ctx.moveTo(0, H - 2);

                for (let i = 0; i < bars; i++) {
                    const energy = sampler(i, bars); // 0..1
                    const boosted = Math.pow(
                        Math.max(0, energy),
                        dbg.boostExp
                    ) * dbg.boostMult;

                    const barH = Math.max(
                        minHeight,
                        Math.min(maxHeight, boosted * H)
                    );

                    const x = (i / (bars - 1)) * W;
                    const y = (H - 2) - barH;
                    ctx.lineTo(x, y);
                }

                ctx.lineTo(W, H - 2);
                ctx.strokeStyle = '#2dd4bf';
                ctx.lineWidth = 1;
                ctx.stroke();
            };

            // 3.5 – FFT branch: log-freq mapping + auto-gain
            let fftUsed = false;
            if (enabled && usedFFT && usedFFT.length > 0) {
                // peak FFT
                let peak = 0;
                for (let i = 0; i < usedFFT.length; i++) {
                    if (usedFFT[i] > peak) peak = usedFFT[i];
                }

                // jeśli FFT jest praktycznie martwe – przeskocz na fallback
                if (peak > 3) {
                    const dbg = spectrumDebugRef.current;
                    const normPeak = peak / 255;

                    const gain = Math.min(
                        dbg.maxGain,
                        dbg.targetPeak / Math.max(normPeak, dbg.minPeak)
                    );

                    const sampleRate = aeAny?.ctx?.sampleRate || 48000;
                    const nyquist = sampleRate / 2;
                    const len = usedFFT.length;

                    drawSpectrum((i, bars) => {
                        // logarytmiczna pozycja na osi częstotliwości
                        const t = i / Math.max(1, bars - 1);
                        const minLog = Math.log10(40);
                        const maxLog = Math.log10(20000);
                        const logF = minLog + t * (maxLog - minLog);
                        const freq = Math.pow(10, logF);

                        const binFloat = (freq / nyquist) * len;
                        const binIndex = Math.min(len - 1, Math.max(0, Math.round(binFloat)));

                        const val = usedFFT![binIndex] || 0;

                        let energy = (val / 255) * gain;
                        if (energy < 0) energy = 0;
                        if (energy > 1) energy = 1;

                        return energy;
                    });

                    fftUsed = true;
                }
            }

            // 3.6 – fallback na bandy (BASS/MID/HIGH), gdy FFT nie działa
            if (!fftUsed) {
                const dbg = spectrumDebugRef.current;
                const bands = smoothBandsRef.current;

                const tri = (t: number, c: number, w: number) => {
                    const d = Math.abs(t - c) / w;
                    return d >= 1 ? 0 : 1 - d;
                };

                const peakBand = Math.max(bands.sync1 || 0, bands.sync2 || 0, bands.sync3 || 0);
                const gain = Math.min(
                    dbg.maxGain,
                    dbg.targetPeak / Math.max(peakBand, dbg.minPeak)
                );

                drawSpectrum((i, bars) => {
                    const t = i / Math.max(1, bars - 1);
                    const bass = bands.sync1 || 0;
                    const mid  = bands.sync2 || 0;
                    const high = bands.sync3 || 0;

                    const energy =
                        bass * tri(t, 0.15, 0.30) +
                        mid  * tri(t, 0.50, 0.35) +
                        high * tri(t, 0.85, 0.30);

                    return Math.min(1, energy * gain);
                });
            }

            // 3.6 – mały overlay diagnostyczny
            try {
                let info = '';

                if (fftUsed && usedFFT && usedFFT.length) {
                    info = `FFT: ${debugSource} len=${usedFFT.length}`;
                } else {
                    const bands = smoothBandsRef.current;
                    const pk = Math.max(bands.sync1 || 0, bands.sync2 || 0, bands.sync3 || 0).toFixed(2);
                    info = `BANDS fallback pk=${pk}`;
                }

                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.fillRect(6, 6, 180, 18);
                ctx.fillStyle = '#a5b4fc';
                ctx.font = '10px JetBrains Mono, monospace';
                ctx.textBaseline = 'middle';
                ctx.fillText(info, 10, 15);
                ctx.restore();
            } catch {
                // overlay nie jest krytyczny
            }
// 4. Interactive Points
            const colors = ['#f472b6', '#38bdf8', '#fbbf24']; // Matching new palette
            
            const bands = syncParamsRef.current;
            if (bands && bands.length >= 3) {
                bands.slice(0, 3).forEach((param, i) => {
                    const x = getLogX(param.freq, W);
                    // Normalize gain for visualization Y pos
                    const gainYFactor = Math.min(3.0, Math.max(0.1, param.gain)) / 3.0; 
                    const anchorY = H - (gainYFactor * H * 0.8); // Keep within 80% of height
                    
                    // Connection Line
                    ctx.strokeStyle = colors[i] + '66';
                    ctx.setLineDash([2, 2]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, H);
                    ctx.lineTo(x, anchorY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Handle Interaction State
                    const isHovered = hoveredBandRef.current === i;
                    const isDraggingThis = isDragging.current === i;
                    
                    // Width (Q) Visualizer (Halo)
                    ctx.beginPath();
                    // Scale circle by width
                    ctx.arc(x, anchorY, 5 + (param.width / 2), 0, Math.PI * 2);
                    ctx.fillStyle = colors[i] + '11';
                    ctx.fill();
                    if (isHovered || isDraggingThis) {
                        ctx.strokeStyle = colors[i] + '44';
                        ctx.stroke();
                    }

                    // The Dot Handle
                    ctx.beginPath();
                    ctx.arc(x, anchorY, isDraggingThis ? 6 : 4, 0, Math.PI * 2);
                    ctx.fillStyle = isDraggingThis ? '#fff' : colors[i];
                    ctx.shadowBlur = isDraggingThis ? 10 : 0;
                    ctx.shadowColor = colors[i];
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    
                    // Label Number
                    if (!isDraggingThis && !isHovered) {
                        ctx.fillStyle = '#fff';
                        ctx.font = 'bold 9px Inter, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText((i+1).toString(), x, anchorY);
                    }
                    
                    // Info Tooltip
                    if (isHovered || isDraggingThis) {
                        const tooltipY = anchorY - 20;
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                        ctx.fillRect(x - 30, tooltipY - 22, 60, 24);
                        ctx.fillStyle = colors[i];
                        ctx.font = '10px JetBrains Mono, monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${Math.round(param.freq)}Hz`, x, tooltipY - 12);
                        ctx.fillStyle = '#fff';
                        ctx.fillText(`G:${param.gain.toFixed(1)}`, x, tooltipY - 2);
                    }
                });
            }

            frameRef.current = requestAnimationFrame(draw);
        };

        frameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frameRef.current);
    }, [audioServiceRef]);


    // --- INTERACTION HANDLERS ---
    
    const getMousePos = (e: React.MouseEvent | MouseEvent | React.TouchEvent) => {
        if (!containerRef.current) return { x: 0, y: 0, w: 0, h: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in e) {
             clientX = e.touches[0].clientX;
             clientY = e.touches[0].clientY;
        } else {
             clientX = (e as React.MouseEvent).clientX;
             clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
            w: rect.width,
            h: rect.height
        };
    };

    // --- MOUSE ---

    const handleMouseDown = (e: React.MouseEvent) => {
        const { x, w } = getMousePos(e);
        checkHit(x, w);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y, w, h } = getMousePos(e);
        processMove(x, y, w, h);
    };

    const handleMouseUp = () => {
        isDragging.current = null;
    };

    // --- TOUCH ---
    
    const handleTouchStart = (e: React.TouchEvent) => {
        // e.preventDefault(); // Often needed to prevent scroll
        const { x, w } = getMousePos(e);
        checkHit(x, w);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const { x, y, w, h } = getMousePos(e);
        processMove(x, y, w, h);
    };

    const handleTouchEnd = () => {
        isDragging.current = null;
    };

    // --- SHARED LOGIC ---

    const checkHit = (x: number, w: number) => {
        let closest = -1;
        let minDist = 30; // Hit radius

        syncParams.slice(0, 3).forEach((p, i) => {
            const px = getLogX(p.freq, w);
            const dist = Math.abs(px - x);
            if (dist < minDist) {
                minDist = dist;
                closest = i;
            }
        });

        if (closest !== -1) {
            isDragging.current = closest;
            setHoveredBand(closest);
        }
    };

    const processMove = (x: number, y: number, w: number, h: number) => {
        if (isDragging.current !== null) {
            const i = isDragging.current;
            
            // Freq (X)
            const newFreq = Math.max(20, Math.min(20000, getFreqFromX(x, w)));
            
            // Gain (Y)
            const normalizedY = 1 - (y / h); 
            // Mapping: Bottom=0.1, Top=3.0
            const newGain = Math.max(0.1, Math.min(3.0, normalizedY * 3.0));

            onParamChange(i, { freq: newFreq, gain: newGain });
        } else {
            // Hover detection only for Mouse
            let closest = -1;
            let minDist = 20;
            syncParams.slice(0, 3).forEach((p, i) => {
                const px = getLogX(p.freq, w);
                const dist = Math.abs(px - x);
                if (dist < minDist) {
                    minDist = dist;
                    closest = i;
                }
            });
            setHoveredBand(closest === -1 ? null : closest);
        }
    };

    // Important: Add non-passive listener for wheel to prevent default scrolling
    const handleWheel = (e: React.WheelEvent) => {
        // Only capture scroll if we are actively dragging a point
        if (isDragging.current !== null && syncParams[isDragging.current]) {
            e.preventDefault();
            e.stopPropagation();
            
            const idx = isDragging.current;
            const currentWidth = syncParams[idx].width;
            const delta = e.deltaY > 0 ? -5 : 5; // Scroll down shrinks
            const newWidth = Math.max(5, Math.min(150, currentWidth + delta));
            
            onParamChange(idx, { width: newWidth });
        }
    };

    return (
        <div 
            ref={containerRef}
            className="bg-black/20 border border-white/10 rounded-xl mb-4 overflow-hidden relative group cursor-crosshair select-none backdrop-blur-sm touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
        >
            <div className="w-full h-[140px]">
                <canvas 
                    ref={canvasRef} 
                    className="block w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            {/* PANEL DEBUG POD ANALIZATOREM */}
            <div className="border-t border-white/10 bg-slate-900/80 px-3 py-2 flex flex-wrap gap-2 text-[10px] font-mono text-slate-300">
                <div className="flex flex-col mr-2">
                    <span className="text-slate-500 mb-1">Auto gain</span>
                    <label className="flex items-center gap-1 mb-1">
                        <span>targetPeak</span>
                        <input
                            type="number"
                            step={0.01}
                            min={0}
                            max={1}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.targetPeak}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                targetPeak: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                    <label className="flex items-center gap-1 mb-1">
                        <span>minPeak</span>
                        <input
                            type="number"
                            step={0.01}
                            min={0}
                            max={1}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.minPeak}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                minPeak: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        <span>maxGain</span>
                        <input
                            type="number"
                            step={0.1}
                            min={0}
                            max={20}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.maxGain}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                maxGain: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                </div>

                <div className="flex flex-col">
                    <span className="text-slate-500 mb-1">Shape</span>
                    <label className="flex items-center gap-1 mb-1">
                        <span>boostExp</span>
                        <input
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={2}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.boostExp}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                boostExp: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                    <label className="flex items-center gap-1 mb-1">
                        <span>boostMult</span>
                        <input
                            type="number"
                            step={0.1}
                            min={0}
                            max={5}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.boostMult}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                boostMult: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                    <label className="flex items-center gap-1 mb-1">
                        <span>minH</span>
                        <input
                            type="number"
                            step={0.01}
                            min={0}
                            max={0.5}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.minHeightFrac}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                minHeightFrac: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        <span>maxH</span>
                        <input
                            type="number"
                            step={0.01}
                            min={0.3}
                            max={1}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={spectrumDebug.maxHeightFrac}
                            onChange={e => setSpectrumDebug(d => ({
                                ...d,
                                maxHeightFrac: Number(e.target.value) || 0
                            }))}
                        />
                    </label>
                </div>
            </div>
            <div className="absolute top-2 left-3 text-[9px] text-slate-500 font-mono pointer-events-none uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
                Interactive Spectrum<br/>
                Hold & Scroll to adjust Width (Q)
            </div>
        </div>
    );
};

export default memo(SpectrumVisualizer);



