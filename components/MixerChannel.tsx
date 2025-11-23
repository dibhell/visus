
import React from 'react';

interface Props {
    label: string;
    icon: string;
    isActive: boolean;
    volume: number; // 0 to 1
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
    label, icon, isActive, volume, vuLevel, isPlaying, onToggle, onVolumeChange, onPlayPause, onStop, children, color = "#a78bfa"
}) => {
    
    // Create VU meter segments
    const segments = 10;
    const activeSegments = Math.round(vuLevel * segments);

    return (
        <div className="flex flex-col items-center gap-2 p-2 bg-black/40 rounded-xl border border-white/10 w-24">
            {/* Header */}
            <div className="flex flex-col items-center justify-center h-10 text-center">
                <div className="text-lg leading-none">{icon}</div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-1">{label}</div>
            </div>

            {/* Master Toggle */}
            <div className="flex flex-col items-center gap-2 w-full mb-1">
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={isActive} 
                        onChange={(e) => onToggle(e.target.checked)} 
                        className="sr-only peer" 
                    />
                    <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-accent"></div>
                </label>
            </div>

            {/* Slider & Meter Container */}
            <div className="relative h-28 w-full flex justify-center items-center gap-2 bg-black/20 rounded-lg py-2 border border-white/5">
                
                {/* VU Meter */}
                <div className="h-full w-2 bg-black/50 rounded-full flex flex-col justify-end overflow-hidden py-[1px]">
                    {Array.from({length: segments}).map((_, i) => (
                        <div 
                            key={i} 
                            className="w-full h-[8%] mb-[2%] rounded-[1px] transition-colors duration-75"
                            style={{ 
                                backgroundColor: (segments - 1 - i) < activeSegments 
                                    ? ((segments - 1 - i) > segments * 0.8 ? '#ef4444' : color) 
                                    : '#333'
                            }}
                        />
                    ))}
                </div>

                {/* Vertical Slider Wrapper */}
                <div className="h-full w-8 relative flex items-center justify-center">
                    <input 
                        type="range" 
                        min="0" max="1.2" step="0.01"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="absolute w-24 h-8 rotate-270 origin-center bg-transparent cursor-pointer appearance-none"
                        style={{
                            WebkitAppearance: 'none',
                        }}
                    />
                    {/* Custom Track Visual */}
                    <div className="pointer-events-none absolute w-1.5 h-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="absolute bottom-0 w-full bg-slate-200 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            style={{ height: `${Math.min(100, (volume / 1.2) * 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Transport Controls (Only if handlers provided) */}
            {(onPlayPause || onStop) && (
                <div className="flex gap-1 w-full justify-center">
                    {onPlayPause && (
                        <button 
                            onClick={onPlayPause}
                            className={`flex-1 h-6 rounded flex items-center justify-center text-[10px] transition-colors ${isPlaying ? 'bg-accent text-white shadow-[0_0_10px_rgba(167,139,250,0.5)]' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                        >
                            {isPlaying ? '❚❚' : '▶'}
                        </button>
                    )}
                    {onStop && (
                        <button 
                            onClick={onStop}
                            className="w-6 h-6 rounded bg-white/10 text-slate-300 hover:bg-red-500/80 hover:text-white flex items-center justify-center text-[8px]"
                        >
                            ◼
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

export default MixerChannel;
