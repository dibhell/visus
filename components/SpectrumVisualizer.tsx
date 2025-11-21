
import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../services/audioService';
import { SyncParam } from '../types';

interface Props {
    audioServiceRef: React.MutableRefObject<AudioEngine>;
    syncParams: SyncParam[];
}

const SpectrumVisualizer: React.FC<Props> = ({ audioServiceRef, syncParams }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);

    // Helper: Map frequency to X position using Logarithmic scale
    const getLogX = (freq: number, width: number) => {
        const minLog = Math.log10(20);
        const maxLog = Math.log10(20000);
        const valLog = Math.log10(Math.max(20, Math.min(20000, freq)));
        return ((valLog - minLog) / (maxLog - minLog)) * width;
    };

    useEffect(() => {
        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            
            // High DPI Handling
            const dpr = window.devicePixelRatio || 1;
            // Get container dimensions
            const rect = canvas.getBoundingClientRect();
            
            // Update canvas resolution if needed
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Scale context to match logical size
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const ae = audioServiceRef.current;
            const W = rect.width;
            const H = rect.height;

            // 1. Clear Background
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, W, H);

            // 2. Draw Grid (Subtle)
            ctx.lineWidth = 1;
            const drawGridLine = (freq: number, label: string) => {
                const x = getLogX(freq, W);
                ctx.strokeStyle = '#222';
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
                ctx.stroke();
                
                ctx.fillStyle = '#444';
                ctx.font = '9px monospace';
                ctx.fillText(label, x + 4, H - 6);
            };

            drawGridLine(100, '100Hz');
            drawGridLine(1000, '1kHz');
            drawGridLine(10000, '10kHz');

            // Horizontal Center Line
            ctx.strokeStyle = '#33ff9922';
            ctx.beginPath();
            ctx.moveTo(0, H / 2);
            ctx.lineTo(W, H / 2);
            ctx.stroke();

            // 3. Draw Spectrum Curve
            const fftData = ae.fftData;
            if (fftData && fftData.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = '#33ff99';
                ctx.lineWidth = 1.5;
                
                // To avoid jagged lines on log scale at high freq, we iterate steps
                // But simple iteration is faster for now
                const step = 2;
                for (let x = 0; x < W; x += step) {
                    // Inverse Log: Pixel X -> Frequency
                    const minLog = Math.log10(20);
                    const maxLog = Math.log10(20000);
                    const t = x / W;
                    const freq = Math.pow(10, minLog + t * (maxLog - minLog));

                    // Frequency -> FFT Bin
                    const nyquist = 24000; 
                    const binIndex = Math.floor((freq / nyquist) * fftData.length);
                    
                    const val = fftData[binIndex] || 0;
                    // Visualize: 0 is bottom. 
                    // We want standard visualizer: bottom to top
                    const barHeight = (val / 255) * (H * 0.9);
                    const y = H - barHeight;

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Fill Gradient
                ctx.lineTo(W, H);
                ctx.lineTo(0, H);
                ctx.closePath();
                const grad = ctx.createLinearGradient(0, 0, 0, H);
                grad.addColorStop(0, 'rgba(51, 255, 153, 0.3)');
                grad.addColorStop(1, 'rgba(51, 255, 153, 0.05)');
                ctx.fillStyle = grad;
                ctx.fill();
            }

            // 4. Draw Sync Markers (Bubbles)
            const colors = ['#ff3333', '#00eeff', '#fce303'];
            syncParams.slice(0, 3).forEach((param, i) => {
                const x = getLogX(param.freq, W);
                const bandKey = `sync${i+1}` as keyof typeof ae.bands;
                const level = ae.bands[bandKey] || 0;
                
                // Calculate Y pos based on level (bouncing ball)
                const bounceY = H - (level * (H * 0.8)) - 10;

                // Line
                ctx.strokeStyle = colors[i] + '44';
                ctx.beginPath();
                ctx.moveTo(x, H);
                ctx.lineTo(x, bounceY);
                ctx.stroke();

                // Dot
                const r = 4 + (level * 4);
                ctx.fillStyle = '#000';
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, bounceY, r, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Number
                ctx.fillStyle = colors[i];
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((i+1).toString(), x, bounceY);
            });

            frameRef.current = requestAnimationFrame(draw);
        };

        frameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frameRef.current);
    }, [syncParams, audioServiceRef]);

    return (
        <div className="bg-black border border-zinc-800 rounded mb-4 overflow-hidden shadow-md relative">
            {/* Fixed Height Container to prevent Flex stretching issues */}
            <div className="w-full h-[128px]">
                <canvas 
                    ref={canvasRef} 
                    className="block w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            <div className="absolute top-1 left-2 text-[9px] text-gray-600 font-mono pointer-events-none">
                LOG SPECTRUM (20Hz - 20kHz)
            </div>
        </div>
    );
};

export default SpectrumVisualizer;
