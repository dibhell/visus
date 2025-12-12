import React, { useEffect, useRef, useState, memo } from 'react';
import { AudioEngine } from '../services/audioService';
import { SyncParam } from '../constants';

const SPECTRUM_CALIB_MARKERS = [50, 80, 100, 200, 500, 1000, 2000, 5000];

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

    const spectrumDebugRef = useRef(spectrumDebug);
    const lastPeakFreqRef = useRef<number | null>(null);
    const freqRangeRef = useRef<{ min: number; max: number }>({ min: 20, max: 20000 });
    const [freqCalib, setFreqCalib] = useState(1.0);
    const freqCalibRef = useRef(freqCalib);
    const [specStretch, setSpecStretch] = useState(1.0);
    const specStretchRef = useRef(specStretch);
    const [axisMinHz, setAxisMinHz] = useState<number | null>(null);
    const [axisMaxHz, setAxisMaxHz] = useState<number | null>(null);
    const axisMinHzRef = useRef<number | null>(null);
    const axisMaxHzRef = useRef<number | null>(null);

    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { hoveredBandRef.current = hoveredBand; }, [hoveredBand]);
    useEffect(() => { spectrumDebugRef.current = spectrumDebug; }, [spectrumDebug]);
    useEffect(() => { spectrumModeRef.current = spectrumMode; }, [spectrumMode]);
    useEffect(() => { freqCalibRef.current = freqCalib; }, [freqCalib]);
    useEffect(() => { specStretchRef.current = specStretch; }, [specStretch]);
    useEffect(() => { axisMinHzRef.current = axisMinHz; }, [axisMinHz]);
    useEffect(() => { axisMaxHzRef.current = axisMaxHz; }, [axisMaxHz]);

    // --- MATH HELPERS ---
    const getLogX = (freq: number, width: number) => {
        const userMin = axisMinHzRef.current;
        const userMax = axisMaxHzRef.current;
        const minF = Math.max(5, userMin || freqRangeRef.current.min);
        const maxF = Math.max(minF + 1, userMax || freqRangeRef.current.max);
        const minLog = Math.log10(minF);
        const maxLog = Math.log10(maxF);
        const valLog = Math.log10(Math.max(minF, Math.min(maxF, freq * freqCalibRef.current)));
        const base = (valLog - minLog) / (maxLog - minLog);
        return Math.min(width, Math.max(0, base * width));
    };

    const getFreqFromX = (x: number, width: number) => {
        const userMin = axisMinHzRef.current;
        const userMax = axisMaxHzRef.current;
        const minF = Math.max(5, userMin || freqRangeRef.current.min);
        const maxF = Math.max(minF + 1, userMax || freqRangeRef.current.max);
        const minLog = Math.log10(minF);
        const maxLog = Math.log10(maxF);
        const t = Math.min(1, Math.max(0, x / width));
        return Math.pow(10, minLog + t * (maxLog - minLog));
    };

    const findMainPeak = (
        fft: Uint8Array,
        sampleRate: number,
        minFreq: number,
        maxFreq: number
    ) => {
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
            const bandPeakFreqs: Array<number | null> = [null, null, null];
            const bandColors = [
                'rgba(244, 114, 182, 0.12)',
                'rgba(56, 189, 248, 0.12)',
                'rgba(251, 191, 36, 0.12)',
            ];
            const colors = ['#f472b6', '#38bdf8', '#fbbf24']; // Matching new palette

            // dynamic freq range based on current sample rate
            const currentSr = (ae as any)?.ctx?.sampleRate || 48000;
            const currentNyquist = currentSr / 2;
            const minF = 20;
            const maxF = Math.max(minF + 100, Math.min(20000, currentNyquist));
            freqRangeRef.current = { min: minF, max: maxF };

            // 1. Background
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'; // Slate dark
            ctx.fillRect(0, 0, W, H);

            // 2. Grid
            ctx.lineWidth = 1;
            const drawGridLine = (freq: number, label: string) => {
                const x = getLogX(freq, W);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillText(label, x + 4, H - 6);
            };

            // dynamic grid markers up to current max freq
            const markerPool = [20, 30, 50, 80, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            const maxMarker = freqRangeRef.current.max;
            markerPool
                .filter((m) => m <= maxMarker * 1.05) // small slack
                .forEach((m) => drawGridLine(m, m >= 1000 ? `${m / 1000}k` : `${m}`));

            const formatFreq = (f: number) =>
                f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)}kHz` : `${f.toFixed(1)}Hz`;

            const drawBandWindows = () => {
                const bands = syncParamsRef.current;
                bands.slice(0, 3).forEach((b, i) => {
                    if (!b) return;
                    const bandMin = Math.max(freqRangeRef.current.min, b.freq * Math.max(0.05, 1 - b.width / 100));
                    const bandMax = Math.min(freqRangeRef.current.max, b.freq * (1 + b.width / 100));
                    const x1 = getLogX(bandMin, W);
                    const x2 = getLogX(bandMax, W);
                    const left = Math.min(x1, x2);
                    const width = Math.abs(x2 - x1);
                    ctx.save();
                    ctx.fillStyle = bandColors[i];
                    ctx.fillRect(left, 0, width, H);
                    ctx.restore();
                });
            };

            // 3. Spectrum Fill - hi-res, bass-biased FFT
            const aeAny: any = ae;

            // 3.1 FFT z silnika – zawsze hi-res z master bus
            let usedFFT: Uint8Array | null = null;
            let debugSource = 'none';

            // PRIORYTET: bezposrednio mainAnalyser z AudioContext (RAW FFT 0..Nyquist)
            if (aeAny?.mainAnalyser && aeAny?.ctx) {
                try {
                    const analyser: AnalyserNode = aeAny.mainAnalyser;
                    const binCount = analyser.frequencyBinCount;
                    const arr = new Uint8Array(binCount);
                    analyser.getByteFrequencyData(arr);
                    usedFFT = arr;
                    debugSource = 'mainAnalyser';
                } catch {
                    usedFFT = null;
                }
            }

            // Fallback: stare getSpectrum (jesli mainAnalyser z jakiegos powodu nie istnieje)
            else if (aeAny?.getSpectrum) {
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
                ctx.globalAlpha = 0.12;
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
                    ctx.fillStyle = 'rgba(255,255,255,0.45)';
                    ctx.fillText(label, x, 2);
                });

                ctx.restore();
            };

            // 3.4 FFT (logarytmiczna mapa czestotliwosci + auto-gain, bez usredniania zakresow)
            let fftUsed = false;

            if (enabled && usedFFT && usedFFT.length > 0) {
                const dbg = spectrumDebugRef.current;

                // peak z calego FFT - tylko do auto-gain
                let peak = 0;
                for (let i = 0; i < usedFFT.length; i++) {
                    if (usedFFT[i] > peak) peak = usedFFT[i];
                }

                // jeżeli FFT praktycznie martwe - nie używamy go
                if (peak > 1) {
                    const normPeak = peak / 255;
                    const gain = Math.min(
                        dbg.maxGain,
                        dbg.targetPeak / Math.max(normPeak, dbg.minPeak)
                    );

                    const len = usedFFT.length;
                    const sampleRate = aeAny?.ctx?.sampleRate || 48000;
                    const nyquist = sampleRate / 2;
                    const minFreq = freqRangeRef.current.min;
                    const maxFreq = freqRangeRef.current.max;
                    const minLog = Math.log10(minFreq);
                    const maxLog = Math.log10(maxFreq);

                    // 3.4.a - PEAK Hz liczymy z RAW FFT
                    const peakInfo = findMainPeak(usedFFT, sampleRate, minFreq, maxFreq);
                    lastPeakFreqRef.current = peakInfo.freq || 0;

                    // per-band FFT peak (zgodnie z ustawionymi freq/width)
                    const bandsForPeak = syncParamsRef.current;
                    bandsForPeak.slice(0, 3).forEach((b, idx) => {
                        if (!b) return;
                        const bandMin = Math.max(minFreq, b.freq * Math.max(0.05, 1 - b.width / 100));
                        const bandMax = Math.min(maxFreq, b.freq * (1 + b.width / 100));
                        const bandPeak = findMainPeak(usedFFT, sampleRate, bandMin, bandMax);
                        bandPeakFreqs[idx] = bandPeak.freq || null;
                    });

                    // pomocnicza funkcja: mapuje czestotliwosc na indeks binu (dla rysowania)
                    const binForFreq = (freqHz: number) => {
                        const f = Math.max(minFreq, Math.min(maxFreq, freqHz));
                        const idxFloat = (f / nyquist) * len;
                        const idx = Math.round(idxFloat);
                        return Math.min(len - 1, Math.max(0, idx));
                    };

                    // 3.4.b - sampler: dla każdej "kolumny" bierzemy JEDEN bin FFT, z biasem na bas
                    drawSpectrum((i, bars) => {
                        const tLinear = bars > 1 ? i / (bars - 1) : 0;
                        const t = Math.pow(tLinear, 2.5); // bias na bas

                        const logF = minLog + t * (maxLog - minLog);
                        const freq = Math.pow(10, logF) / Math.max(0.05, specStretchRef.current);

                    const bin = binForFreq(freq);
                    const val = usedFFT[bin] || 0;

                    let energy = (val / 255) * gain;
                    if (energy < 0.02) energy = 0.02;
                        if (energy < 0) energy = 0;
                        if (energy > 1) energy = 1;

                        return energy;
                    });

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

            // 3.5 - overlay kalibracyjny piku FFT
            try {
                const peakFreq = lastPeakFreqRef.current;
                if (peakFreq && peakFreq > 0) {
                    const peakX = getLogX(peakFreq, W);

                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(peakX + 0.5, 0);
                    ctx.lineTo(peakX + 0.5, H * 0.25);
                    ctx.stroke();

                    ctx.font = '11px JetBrains Mono, monospace';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';

                    const label =
                        peakFreq >= 1000
                            ? `${(peakFreq / 1000).toFixed(2)} kHz`
                            : `${peakFreq.toFixed(1)} Hz`;

                    ctx.fillText(`Peak: ${label}`, peakX + 4, H * 0.25 - 2);
                    ctx.restore();
                }
            } catch {
                // overlay nie jest krytyczny
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

            // 3.7 - overlay z wartościami: peak FFT + podgląd pasm
            try {
                const peakFreq = lastPeakFreqRef.current;
                const bands = syncParamsRef.current;
                const bandLabels = bands.slice(0, 3).map((b, i) => {
                    const f = bandPeakFreqs[i] || 0;
                    const text = f > 0 ? formatFreq(f) : '---';
                    const setText = b?.freq ? formatFreq(b.freq) : '---';
                    return `${i + 1}:${setText}→${text}`;
                });

                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.fillRect(6, 26, 235, 28);
                ctx.font = '11px JetBrains Mono, monospace';
                ctx.textBaseline = 'middle';

                const peakLabel =
                    peakFreq && peakFreq > 0
                        ? formatFreq(peakFreq)
                        : '---';

                ctx.fillStyle = '#fbbf24';
                ctx.fillText(`Peak (FFT): ${peakLabel}`, 12, 40);
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.fillText(`Bands: ${bandLabels.join(' | ')}`, 125, 40);
                ctx.restore();
            } catch {
                // overlay nie jest krytyczny
            }
            // 4. Interactive Points
            
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
                    const bandPeak = bandPeakFreqs[i];
                    const fftLabel =
                        bandPeak && bandPeak > 0
                            ? (bandPeak >= 1000 ? `${(bandPeak / 1000).toFixed(2)}kHz` : `${bandPeak.toFixed(1)}Hz`)
                            : '---';
                    ctx.fillText(`FFT: ${fftLabel}`, x, tooltipY - 12);
                    ctx.fillStyle = '#fff';
                    const paramLabel =
                        param.freq >= 1000
                            ? `${(param.freq / 1000).toFixed(2)}kHz`
                            : `${Math.round(param.freq)}Hz`;
                    ctx.fillText(`Set: ${paramLabel}`, x, tooltipY - 2);
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
            <div className="w-full h-[180px]">
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
                            SMOOTH
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
                    <label className="flex items-center gap-1 mb-1">
                        <span>axisCalib</span>
                        <input
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={3}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={freqCalib}
                            onChange={e => setFreqCalib(Number(e.target.value) || 1)}
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        <span>stretch</span>
                        <input
                            type="number"
                            step={0.05}
                            min={0.05}
                            max={10}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={specStretch}
                            onChange={e => setSpecStretch(Number(e.target.value) || 1)}
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        <span>minHz</span>
                        <input
                            type="number"
                            step={5}
                            min={5}
                            max={20000}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={axisMinHz ?? ''}
                            onChange={e => setAxisMinHz(e.target.value === '' ? null : Number(e.target.value) || 20)}
                        />
                    </label>
                    <label className="flex items-center gap-1">
                        <span>maxHz</span>
                        <input
                            type="number"
                            step={10}
                            min={20}
                            max={48000}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-1 py-[1px]"
                            value={axisMaxHz ?? ''}
                            onChange={e => setAxisMaxHz(e.target.value === '' ? null : Number(e.target.value) || 20000)}
                        />
                    </label>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {[
                            [20, 30],
                            [30, 50],
                            [50, 80],
                            [80, 100],
                            [100, 200],
                            [200, 500],
                            [500, 1000],
                            [1000, 2000],
                            [2000, 5000],
                            [5000, 10000],
                            [10000, 20000],
                        ].map(([mn, mx]) => (
                            <button
                                key={`${mn}-${mx}`}
                                type="button"
                                className="px-2 py-[2px] text-[9px] rounded bg-slate-800 border border-slate-600 text-slate-200 hover:border-accent hover:text-white transition"
                                onClick={() => {
                                    setAxisMinHz(mn);
                                    setAxisMaxHz(mx);
                                }}
                            >
                                {mn >= 1000 ? `${mn / 1000}k` : mn}-{mx >= 1000 ? `${mx / 1000}k` : mx}
                            </button>
                        ))}
                    </div>
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
