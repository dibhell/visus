
import React, { useEffect, useRef } from 'react';

interface Props {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    volume: number; // 0 to 1
    defaultVolume?: number;
    vuLevel: number; // 0 to 1
    isPlaying?: boolean; // New: Transport state
    onToggle: (active: boolean) => void;
    onVolumeChange: (vol: number) => void;
    onPlayPause?: () => void; // New
    onStop?: () => void; // New
    children?: React.ReactNode; // For file inputs or extra buttons
    color?: string;
}

const MixerChannel: React.FC<Props> = ({
    label,
    icon,
    isActive,
    volume,
    defaultVolume,
    vuLevel,
    isPlaying,
    onToggle,
    onVolumeChange,
    onPlayPause,
    onStop,
    children,
    color = "#a78bfa"
}) => {
    const sliderRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);

    const clampVolume = (val: number) => Math.max(0, Math.min(1.2, val));

    const updateFromPointer = (clientY: number) => {
        const el = sliderRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = 1 - (clientY - rect.top) / rect.height;
        const mapped = clampVolume(ratio * 1.2);
        onVolumeChange(parseFloat(mapped.toFixed(2)));
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;
        updateFromPointer(e.clientY);
    };

    const endDrag = () => {
        isDraggingRef.current = false;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', endDrag);
    };

    const startDrag = (e: React.PointerEvent) => {
        isDraggingRef.current = true;
        updateFromPointer(e.clientY);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', endDrag);
    };

    const handleDoubleClick = () => {
        if (defaultVolume === undefined) return;
        onVolumeChange(defaultVolume);
    };

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', endDrag);
        };
    }, []);
    
    // Create VU meter segments
    const segments = 12;
    const activeSegments = Math.round(vuLevel * segments);

    return (
        <div className="flex flex-col items-center gap-2 p-3 bg-black/40 rounded-2xl border border-white/5 w-28 shadow-lg backdrop-blur-sm">
            {/* Header */}
            <div className="flex flex-col items-center justify-center h-12 text-center text-slate-300">
                <div className="opacity-90">{icon}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-2">{label}</div>
            </div>

            {/* Master Toggle */}
            <div className="flex flex-col items-center gap-2 w-full mb-2">
                 <label className="relative inline-flex items-center cursor-pointer group">
                    <input 
                        type="checkbox" 
                        checked={isActive} 
                        onChange={(e) => onToggle(e.target.checked)} 
                        className="sr-only peer" 
                    />
                    <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white shadow-inner"></div>
                </label>
            </div>

            {/* Slider & Meter Container */}
            <div className="relative h-32 w-full flex justify-center items-center gap-3 bg-black/20 rounded-xl py-3 border border-white/5 shadow-inner">
                
                {/* VU Meter */}
                <div className="h-full w-1.5 bg-black/50 rounded-full flex flex-col justify-end overflow-hidden py-[1px]">
                    {Array.from({length: segments}).map((_, i) => (
                        <div 
                            key={i} 
                            className="w-full h-[6%] mb-[2%] rounded-[1px] transition-colors duration-75"
                            style={{ 
                                backgroundColor: (segments - 1 - i) < activeSegments 
                                    ? ((segments - 1 - i) > segments * 0.8 ? '#ef4444' : color) 
                                    : '#1e293b'
                            }}
                        />
                    ))}
                </div>

                {/* Vertical Slider Wrapper (custom drag) */}
                <div
                    ref={sliderRef}
                    onPointerDown={startDrag}
                    onDoubleClick={handleDoubleClick}
                    className="h-full w-8 relative flex items-center justify-center group cursor-pointer select-none"
                >
                    {/* Custom Track Visual */}
                    <div className="pointer-events-none absolute w-1.5 h-full bg-slate-800/80 rounded-full overflow-hidden">
                        <div 
                            className="absolute bottom-0 w-full bg-slate-300 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all duration-75"
                            style={{ height: `${Math.min(100, (volume / 1.2) * 100)}%` }}
                        ></div>
                    </div>
                    
                    {/* Thumb visual enhancement (fake) */}
                    <div 
                         className="pointer-events-none absolute w-4 h-3 bg-slate-200 rounded shadow-md border border-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                         style={{ bottom: `calc(${Math.min(100, (volume / 1.2) * 100)}% - 6px)` }}
                    />
                </div>
            </div>

            {/* Transport Controls (Only if handlers provided) */}
            {(onPlayPause || onStop) && (
                <div className="flex gap-1 w-full justify-center mt-1">
                    {onPlayPause && (
                        <button 
                            onClick={onPlayPause}
                            className={`flex-1 h-7 rounded-lg flex items-center justify-center transition-all border border-white/5 ${isPlaying ? 'bg-accent text-white shadow-[0_0_10px_rgba(167,139,250,0.4)] border-accent/50' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                        >
                            {isPlaying ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                            ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
                            )}
                        </button>
                    )}
                    {onStop && (
                        <button 
                            onClick={onStop}
                            className="w-7 h-7 rounded-lg bg-white/5 text-slate-400 border border-white/5 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 flex items-center justify-center transition-all"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                        </button>
                    )}
                </div>
            )}

            {/* Inputs / Extra Actions */}
            <div className="w-full mt-1 min-h-[24px] flex items-center justify-center gap-1">
                {children}
            </div>
        </div>
    );
};

export default React.memo(MixerChannel);
