
import React, { useEffect, useRef, useState, memo } from 'react';
import { AudioEngine } from '../services/audioService';
import { SyncParam } from '../constants';

const SPECTRUM_CALIB_MARKERS = [50, 80, 100, 200, 500, 1000, 2000, 5000];

// pomocnicza funkcja do znalezienia głównego piku w FFT
function findMainPeak(
    fft: Uint8Array,
    sampleRate: number,
    minFreq: number,
    maxFreq: number
) {
    if (!fft || fft.length === 0) {
        return { freq: 0, value: 0 };
    }

    const nyquist = sampleRate / 2;
    const len = fft.length;

    const minBin = Math.max(1, Math.round((minFreq / nyquist) * len));
    const maxBin = Math.min(len - 1, Math.round((maxFreq / nyquist) * len));

    let bestBin = minBin;
    let bestVal = 0;

    for (let i = minBin; i <= maxBin; i++) {
        const v = fft[i] || 0;
        if (v > bestVal) {
            bestVal = v;
            bestBin = i;
        }
    }

    const freq = (bestBin / len) * nyquist;
    return { freq, value: bestVal };
}

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
    const dragMetaRef = useRef<{
        index: number;
        startY: number;
        startGain: number;
    } | null>(null);
    const [spectrumDebug, setSpectrumDebug] = useState({
        targetPeak: 1.0,
        minPeak: 0.30,
        maxGain: 20.0,
        boostExp: 2.0,
        boostMult: 0.6,
        minHeightFrac: 0.0,
        maxHeightFrac: 0.81,
    });
    const [spectrumMode, setSpectrumMode] = useState<'ableton' | 'raw'>('ableton');
    const spectrumModeRef = useRef<'ableton' | 'raw'>('ableton');

    const lastPeakFreqRef = useRef<number | null>(null);
    const spectrumDebugRef = useRef(spectrumDebug);

    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { hoveredBandRef.current = hoveredBand; }, [hoveredBand]);
    useEffect(() => { spectrumDebugRef.current = spectrumDebug; }, [spectrumDebug]);
    useEffect(() => { spectrumModeRef.current = spectrumMode; }, [spectrumMode]);

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

                                                            // 3. Spectrum Fill - hi-res, bass-biased FFT
            const aeAny: any = ae;

            // 3.1 FFT z silnika ÔÇô zawsze hi-res z master bus
            let usedFFT: Uint8Array | null = null;
            let debugSource = 'none';
            if (aeAny?.getSpectrum) {
                try {
                    usedFFT = aeAny.getSpectrum();
                    debugSource = 'getSpectrum';
                } catch {
                    usedFFT = null;
                }
            }

            // 3.2 - bands fallback with smoothing
            let rawBands = { sync1: 0, sync2: 0, sync3: 0 };
            if (aeAny?.getBandLevels) {
                rawBands = aeAny.getBandLevels() || rawBands;
            } else if (aeAny?.vuWorkletBands && aeAny.vuWorkletBands.video) {
                const vb = aeAny.vuWorkletBands.video as Float32Array;
                rawBands = {
                    sync1: vb[0] || 0,
                    sync2: vb[1] || 0,
                    sync3: vb[2] || 0,
                };
            }

            const smooth = smoothBandsRef.current;
            const bandAlpha = 0.6;
            smooth.sync1 = smooth.sync1 * (1 - bandAlpha) + rawBands.sync1 * bandAlpha;
            smooth.sync2 = smooth.sync2 * (1 - bandAlpha) + rawBands.sync2 * bandAlpha;
            smooth.sync3 = smooth.sync3 * (1 - bandAlpha) + rawBands.sync3 * bandAlpha;

            // 3.3 - draw helper (dense curve, bass bias)
            const drawSpectrum = (
                sampler: (i: number, bars: number) => number,
                overlay?: { fft?: Uint8Array | null; sampleRate?: number }
            ) => {
                const dbg = spectrumDebugRef.current;
                const mode = spectrumModeRef.current;

                // dense sampling for more detail (bli┼╝ej Ableton)
                const bars = Math.min(4096, Math.max(1024, Math.floor(W * 4.0)));

                const minHeight = H * dbg.minHeightFrac;
                const maxHeight = H * dbg.maxHeightFrac;

                const points: Array<{ x: number; y: number }> = [];

                for (let i = 0; i < bars; i++) {
                    const energy = sampler(i, bars); // 0..1

                    let displayEnergy = energy;

                    if (mode === 'ableton') {
                        // „muzyczny” tryb z kształtowaniem – jak dotychczas
                        displayEnergy = Math.pow(Math.max(0, energy), dbg.boostExp) * dbg.boostMult;
                    } else {
                        // RAW – bez dodatkowego wzmacniania, tylko clamp
                        displayEnergy = Math.max(0, Math.min(1, energy));
                    }

                    const barH = Math.max(
                        minHeight,
                        Math.min(maxHeight, displayEnergy * H)
                    );

                    const x = (i / (bars - 1)) * W;
                    const y = (H - 2) - barH;
                    points.push({ x, y });
                }

                // fill
                ctx.beginPath();
                ctx.moveTo(0, H - 2);
                points.forEach((p) => ctx.lineTo(p.x, p.y));
                ctx.lineTo(W, H - 2);
                ctx.lineTo(0, H - 2);
                ctx.closePath();
                ctx.fillStyle = 'rgba(45, 212, 191, 0.18)';
                ctx.fill();

                // stroke
                ctx.beginPath();
                if (points.length) {
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 1; i < points.length; i++) {
                        const p = points[i];
                        ctx.lineTo(p.x, p.y);
                    }
                }
                ctx.lineTo(W, H - 2);
                ctx.strokeStyle = '#2dd4bf';
                ctx.lineWidth = 1;
                ctx.stroke();

                // --- KALIBRACJA: linie częstotliwości + opis piku ---
                ctx.save();
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.35;
                ctx.strokeStyle = '#ffffff';

                SPECTRUM_CALIB_MARKERS.forEach((markerHz) => {
                    const x = getLogX(markerHz, W);
                    ctx.beginPath();
                    ctx.moveTo(x + 0.5, 0);
                    ctx.lineTo(x + 0.5, H);
                    ctx.stroke();

                    // mały opis nad osią
                    ctx.font = '10px system-ui';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    const label =
                        markerHz >= 1000
                            ? `${(markerHz / 1000).toFixed(markerHz >= 2000 ? 0 : 1)}k`
                            : `${markerHz}`;
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.fillText(label, x, 2);
                });

                const peakFreq = lastPeakFreqRef.current;

                if (peakFreq && peakFreq > 0) {
                    const peakX = getLogX(peakFreq, W);

                    // marker piku
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(peakX + 0.5, 0);
                    ctx.lineTo(peakX + 0.5, H * 0.25);
                    ctx.stroke();

                    // tekst z częstotliwością
                    ctx.font = '11px system-ui';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
                    const freqLabel =
                        peakFreq >= 1000
                            ? `${(peakFreq / 1000).toFixed(2)} kHz`
                            : `${peakFreq.toFixed(1)} Hz`;
                    ctx.fillText(`Peak: ${freqLabel}`, peakX + 4, H * 0.25 - 2);
                }

                ctx.restore();
            };

            // 3.4 FFT (logarytmiczna mapa czestotliwosci + auto-gain, bez usredniania zakresow)
            let fftUsed = false;
            lastPeakFreqRef.current = null;

            if (enabled && usedFFT && usedFFT.length > 0) {
                const dbg = spectrumDebugRef.current;

                // peak z calego FFT
                let peak = 0;
                for (let i = 0; i < usedFFT.length; i++) {
                    if (usedFFT[i] > peak) peak = usedFFT[i];
                }

                // jeżeli FFT praktycznie martwe – nie używamy go
                if (peak > 1) {
                    const normPeak = peak / 255;
                    const gain = Math.min(
                        dbg.maxGain,
                        dbg.targetPeak / Math.max(normPeak, dbg.minPeak)
                    );

                    const len = usedFFT.length;
                    const sampleRate = aeAny?.ctx?.sampleRate || 48000;
                    const nyquist = sampleRate / 2;

                    // pomocnicza funkcja: mapuje czestotliwosc na indeks binu
                    const binForFreq = (freqHz: number) => {
                        const f = Math.max(20, Math.min(20000, freqHz));
                        const idxFloat = (f / nyquist) * len;
                        const idx = Math.round(idxFloat);
                        return Math.min(len - 1, Math.max(0, idx));
                    };

                    // zakres spektrum – taki sam jak grid (20 Hz – 20 kHz)
                    const minFreq = 20;
                    const maxFreq = 20000;
                    const minLog = Math.log10(minFreq);
                    const maxLog = Math.log10(maxFreq);

                    // sampler: dla każdej "kolumny" bierzemy JEDEN bin FFT, z biasem na bas
                    let visPeakFreq = 0;
                    let visPeakEnergy = 0;

                    drawSpectrum((i, bars) => {
                        // bias na bas: więcej punktów w dole pasma
                        const tLinear = bars > 1 ? i / (bars - 1) : 0;
                        const t = Math.pow(tLinear, 2.5);

                        // logarytmiczna oś częstotliwości
                        const logF = minLog + t * (maxLog - minLog);
                        const freq = Math.pow(10, logF);

                        const bin = binForFreq(freq);
                        const val = usedFFT[bin] || 0;

                        let energy = (val / 255) * gain;
                        // delikatny floor, żeby cisza nie dawała linii 0 px
                        if (energy < 0.02) energy = 0.02;
                        if (energy < 0) energy = 0;
                        if (energy > 1) energy = 1;

                        // zapamiętujemy to, co rysujemy jako najwyższy słupek
                        const mode = spectrumModeRef.current;
                        const displayEnergy = mode === 'ableton'
                            ? Math.pow(Math.max(0, energy), dbg.boostExp) * dbg.boostMult
                            : Math.max(0, Math.min(1, energy));
                        if (displayEnergy > visPeakEnergy) {
                            visPeakEnergy = displayEnergy;
                            visPeakFreq = freq;
                        }

                        return energy;
                    }, { fft: usedFFT, sampleRate });

                    if (visPeakFreq > 0) {
                        lastPeakFreqRef.current = visPeakFreq;
                    }

                    fftUsed = true;
                }
            }

            // 3.5 - fallback to bands when FFT is empty
            if (!fftUsed) {
                const dbg = spectrumDebugRef.current;
                const bandsSmooth = smoothBandsRef.current;

                const tri = (t: number, c: number, w: number) => {
                    const d = Math.abs(t - c) / w;
                    return d >= 1 ? 0 : 1 - d;
                };

                const peakBand = Math.max(
                    bandsSmooth.sync1 || 0,
                    bandsSmooth.sync2 || 0,
                    bandsSmooth.sync3 || 0
                );

                const gain = Math.min(
                    dbg.maxGain,
                    dbg.targetPeak / Math.max(peakBand, dbg.minPeak)
                );

                drawSpectrum((i, bars) => {
                    const t = i / Math.max(1, bars - 1);

                    const bass = bandsSmooth.sync1 || 0;
                    const mid  = bandsSmooth.sync2 || 0;
                    const high = bandsSmooth.sync3 || 0;

                    const energy =
                        bass * tri(t, 0.18, 0.30) +
                        mid  * tri(t, 0.50, 0.35) +
                        high * tri(t, 0.82, 0.30);

                    return Math.min(1, energy * gain);
                });
            }

            // 3.6 - overlay: FFT vs fallback (debug)
            try {
                let info = '';

                if (fftUsed && usedFFT && usedFFT.length) {
                    info = `FFT:${debugSource} len=${usedFFT.length}`;
                } else {
                    const bandsSmooth = smoothBandsRef.current;
                    const pk = Math.max(
                        bandsSmooth.sync1 || 0,
                        bandsSmooth.sync2 || 0,
                        bandsSmooth.sync3 || 0
                    ).toFixed(2);
                    info = `BANDS:fallback pk=${pk}`;
                }

                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.fillRect(6, 6, 220, 18);
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
        const { x, y, w, h } = getMousePos(e);
        checkHit(x, y, w, h);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y, w, h } = getMousePos(e);
        processMove(x, y, w, h);
    };

    const handleMouseUp = () => {
        isDragging.current = null;
        dragMetaRef.current = null;
    };

    // --- TOUCH ---
    
    const handleTouchStart = (e: React.TouchEvent) => {
        // e.preventDefault(); // Often needed to prevent scroll
        const { x, y, w, h } = getMousePos(e);
        checkHit(x, y, w, h);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const { x, y, w, h } = getMousePos(e);
        processMove(x, y, w, h);
    };

    const handleTouchEnd = () => {
        isDragging.current = null;
        dragMetaRef.current = null;
    };

    // --- SHARED LOGIC ---

    const checkHit = (x: number, y: number, w: number, h: number) => {
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
            const params = syncParams[closest];
            dragMetaRef.current = {
                index: closest,
                startY: y,
                startGain: params ? params.gain : 1.0,
            };
        } else {
            dragMetaRef.current = null;
        }
    };

    const processMove = (x: number, y: number, w: number, h: number) => {
        if (isDragging.current !== null) {
            const i = isDragging.current;
            
            // Freq (X)
            const newFreq = Math.max(20, Math.min(20000, getFreqFromX(x, w)));
            
            // Gain (Y) relative to drag start
            const meta = dragMetaRef.current;
            const minGain = 0.1;
            const maxGain = 3.0;
            let newGain = syncParams[i]?.gain ?? 1.0;

            if (meta && meta.index === i) {
                const dy = meta.startY - y; // up -> increase gain
                const gainRange = maxGain - minGain;
                const deltaGain = (dy / h) * gainRange;
                newGain = meta.startGain + deltaGain;
            }

            newGain = Math.max(minGain, Math.min(maxGain, newGain));

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

    useEffect(() => {
        const onGlobalWheel = (e: WheelEvent) => {
            if (isDragging.current !== null) {
                e.preventDefault();
            }
        };

        window.addEventListener('wheel', onGlobalWheel, { passive: false });
        return () => window.removeEventListener('wheel', onGlobalWheel);
    }, []);

    return (
        <div 
            ref={containerRef}
            className="bg-black/20 border border-white/10 rounded-xl mb-4 overflow-hidden relative group cursor-crosshair select-none backdrop-blur-sm touch-none overscroll-contain"
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
                <div className="flex flex-col mr-4">
                    <span className="text-slate-500 mb-1">Mode</span>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            className={
                                'px-2 py-[2px] rounded border text-[9px] ' +
                                (spectrumMode === 'ableton'
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                    : 'bg-slate-800 border-slate-600 text-slate-300')
                            }
                            onClick={() => setSpectrumMode('ableton')}
                        >
                            ABLETON
                        </button>
                        <button
                            type="button"
                            className={
                                'px-2 py-[2px] rounded border text-[9px] ' +
                                (spectrumMode === 'raw'
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                    : 'bg-slate-800 border-slate-600 text-slate-300')
                            }
                            onClick={() => setSpectrumMode('raw')}
                        >
                            RAW
                        </button>
                    </div>
                </div>
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
