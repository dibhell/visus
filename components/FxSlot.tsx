
import React, { useMemo } from 'react';
import { FxState, RoutingType, SHADER_LIST } from '../constants';
import Knob from './Knob';

interface FxSlotProps {
    slotName: keyof FxState;
    fxState: FxState;
    setFxState: React.Dispatch<React.SetStateAction<FxState>>;
    title?: string;
    category?: 'main' | 'additive'; // Kept for styling, not filtering
    activeLevel?: number; // FX modulation level (for glow)
    vuLevel?: number;      // Source/routing meter level (for meter)
}

const FxSlot: React.FC<FxSlotProps> = ({ slotName, fxState, setFxState, title, category, activeLevel = 0, vuLevel = 0 }) => {
    const isMain = slotName === 'main';
    const config = fxState[slotName];
    const routingColor = (() => {
        if (config.routing === 'sync1') return '#f472b6';
        if (config.routing === 'sync2') return '#38bdf8';
        if (config.routing === 'sync3') return '#fbbf24';
        if (config.routing === 'bpm') return '#a78bfa';
        return '#94a3b8';
    })();

    const handleChange = (key: string, value: any) => {
        setFxState(prev => ({
            ...prev,
            [slotName]: { ...prev[slotName], [key]: value }
        }));
    };

    // Memoize and Sort options
    const shaderOptions = useMemo(() => {
        return Object.keys(SHADER_LIST)
            .map(key => ({
                value: key,
                label: key.replace(/^\d+_/, '').replace(/_/g, ' ')
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, []);

    // Modern Colors
    const slotBorder = isMain ? 'border-accent/30' : 'border-white/5';
    const slotBg = isMain ? 'bg-accent/5' : 'bg-white/5';
    const glowColor = isMain ? '#a78bfa' : '#2dd4bf';

    return (
        <div className={`${slotBg} p-3 rounded-xl border ${slotBorder} mb-3 relative overflow-hidden group hover:border-white/20 transition-all duration-300`}>
             {/* Activity Indicator Bar */}
             <div 
                className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent transition-all duration-75 ease-out shadow-[0_0_10px_rgba(167,139,250,0.5)]"
                style={{ 
                    opacity: config.routing !== 'off' ? 0.3 + (activeLevel * 0.7) : 0,
                    height: `${Math.min(100, activeLevel * 100)}%`,
                    bottom: 0, top: 'auto' 
                }} 
            />
            
            {title && <div className="text-[9px] font-bold text-slate-400 mb-1 uppercase pl-3 tracking-wider flex items-center justify-between">{title}</div>}
            
            <div className="flex flex-col gap-3 pl-2">
                {/* Top Row: Shader & Routing */}
                <div className="flex gap-2">
                    <select
                        className={`flex-1 bg-black/60 border border-white/10 text-[10px] p-2 rounded-lg focus:border-accent outline-none font-mono transition-colors cursor-pointer hover:bg-black/80 ${config.shader === '00_NONE' ? 'text-slate-400 italic' : 'text-slate-200 font-semibold'}`}
                        value={config.shader}
                        onChange={(e) => handleChange('shader', e.target.value)}
                    >
                        {shaderOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200 not-italic font-sans">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    
                    <select
                        className="w-20 bg-black/60 border border-white/10 text-[9px] text-slate-300 p-2 rounded-lg focus:border-accent outline-none uppercase cursor-pointer hover:bg-black/80"
                        value={config.routing}
                        onChange={(e) => handleChange('routing', e.target.value as RoutingType)}
                    >
                        <option value="off" className="bg-slate-900">MANUAL</option>
                        <option value="bpm" className="bg-slate-900">BPM</option>
                        <option value="sync1" className="bg-slate-900">BASS</option>
                        <option value="sync2" className="bg-slate-900">MID</option>
                        <option value="sync3" className="bg-slate-900">HIGH</option>
                    </select>
                </div>

                {/* Bottom Row: Knobs Grid */}
                {config.shader !== '00_NONE' && (
                    <div className="flex justify-around items-center pt-2 pb-1 bg-black/20 rounded-lg border border-white/5 relative overflow-hidden">
                        {/* Band VU (if routed to band/BPM) */}
                        {config.routing !== 'off' && (
                            <div className="absolute left-1 top-2 bottom-2 w-2.5 bg-slate-900/70 rounded-full overflow-hidden">
                                <div
                                    className="w-full rounded-full transition-all duration-60"
                                    style={{
                                        height: `${Math.min(100, Math.max(5, vuLevel * 120))}%`,
                                        background: `linear-gradient(180deg, ${routingColor} 0%, ${routingColor}55 70%, transparent 100%)`,
                                        position: 'absolute',
                                        bottom: 0,
                                        boxShadow: `0 0 8px ${routingColor}55`
                                    }}
                                />
                            </div>
                        )}

                        {/* Depth/Gain Knob */}
                        <Knob 
                            label="Depth"
                            value={config.gain}
                            min={0}
                            max={200}
                            step={1}
                            onChange={(v) => handleChange('gain', v)}
                            format={(v) => `${v}%`}
                            color={glowColor}
                        />

                        {/* Wet/Dry Knob */}
                        <Knob 
                            label="Wet/Dry"
                            value={config.mix || 100}
                            min={0}
                            max={100}
                            step={1}
                            onChange={(v) => handleChange('mix', v)}
                            format={(v) => `${v}%`}
                            color="#ffffff"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default FxSlot;
