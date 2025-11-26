

import React, { useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../services/audioService';
import { SyncParam } from '../constants';

interface Props {
    audioServiceRef: React.MutableRefObject<AudioEngine>;
    syncParams: SyncParam[];
    onParamChange: (index: number, changes: Partial<SyncParam>) => void;
}

const SpectrumVisualizer: React.FC<Props> = ({ audioServiceRef, syncParams, onParamChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const syncParamsRef = useRef<SyncParam[]>(syncParams);
    const hoveredBandRef = useRef<number | null>(null);
    
    const [hoveredBand, setHoveredBand] = useState<number | null>(null);
    const isDragging = useRef<number | null>(null);

    useEffect(() => { syncParamsRef.current = syncParams; }, [syncParams]);
    useEffect(() => { hoveredBandRef.current = hoveredBand; }, [hoveredBand]);

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

            // 3. Spectrum Fill
            const fftData = ae.fftData;
            if (fftData && fftData.length > 0) {
                ctx.beginPath();
                
                const step = 2;
                for (let x = 0; x < W; x += step) {
                    const freq = getFreqFromX(x, W);
                    const nyquist = (ae.ctx?.sampleRate || 48000) / 2;
                    const binIndex = Math.min(fftData.length - 1, Math.max(0, Math.floor((freq / nyquist) * fftData.length)));
                    const val = fftData[binIndex] || 0;
                    
                    const barHeight = (val / 255) * (H * 0.9);
                    const y = H - barHeight;

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.lineTo(W, H);
                ctx.lineTo(0, H);
                ctx.closePath();
                
                // New Gradient: Teal to Transparent
                const grad = ctx.createLinearGradient(0, 0, 0, H);
                grad.addColorStop(0, 'rgba(45, 212, 191, 0.4)'); // Teal
                grad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
                ctx.fillStyle = grad;
                ctx.fill();
                
                // Top Line
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#2dd4bf';
                ctx.stroke();
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
            <div className="absolute top-2 left-3 text-[9px] text-slate-500 font-mono pointer-events-none uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
                Interactive Spectrum<br/>
                Hold & Scroll to adjust Width (Q)
            </div>
        </div>
    );
};

export default SpectrumVisualizer;
