
import React from 'react';
import { FxState, RoutingType } from '../types';
import { SHADER_LIST } from '../constants';
import Knob from './Knob';

interface FxSlotProps {
    slotName: keyof FxState;
    fxState: FxState;
    setFxState: React.Dispatch<React.SetStateAction<FxState>>;
    title?: string;
    category: 'main' | 'additive';
    activeLevel?: number;
}

const FxSlot: React.FC<FxSlotProps> = ({ slotName, fxState, setFxState, title, category, activeLevel = 0 }) => {
    const isMain = slotName === 'main';
    const config = fxState[slotName];

    const handleChange = (key: string, value: any) => {
        setFxState(prev => ({
            ...prev,
            [slotName]: { ...prev[slotName], [key]: value }
        }));
    };

    const shaderOptions = Object.keys(SHADER_LIST)
        .filter(key => {
            const id = SHADER_LIST[key].id;
            if (key === '00_NONE') return true;
            if (category === 'additive') return id < 100 && id >= 0; // Additive < 100
            if (category === 'main') return id >= 100; // Main Scenes > 100 (renumbered for clarity if needed, but keeping logic similar)
            return true;
        })
        .map(key => ({
            value: key,
            label: key.replace(/^\d+_/, '').replace(/_/g, ' ')
        }));

    return (
        <div className="bg-black/20 p-3 rounded-lg border border-white/5 mb-2 relative overflow-hidden group hover:border-white/10 transition-colors">
             {/* Activity Indicator Bar */}
             <div 
                className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent transition-all duration-75 ease-out"
                style={{ 
                    opacity: config.routing !== 'off' ? 0.3 + (activeLevel * 0.7) : 0,
                    height: `${Math.min(100, activeLevel * 100)}%`,
                    bottom: 0, top: 'auto' 
                }} 
            />
            
            {title && <div className="text-[9px] font-bold text-zinc-600 mb-1 uppercase pl-3 tracking-wider">{title}</div>}
            
            <div className="flex flex-col gap-3 pl-2">
                {/* Top Row: Shader & Routing */}
                <div className="flex gap-2">
                    <select
                        className={`flex-1 bg-black border border-white/10 text-[10px] p-1.5 rounded-md focus:border-accent outline-none font-mono transition-colors ${config.shader === '00_NONE' ? 'text-zinc-600' : 'text-gray-200'}`}
                        value={config.shader}
                        onChange={(e) => handleChange('shader', e.target.value)}
                    >
                        {shaderOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    
                    <select
                        className="w-20 bg-black border border-white/10 text-[9px] text-gray-300 p-1.5 rounded focus:border-accent outline-none uppercase"
                        value={config.routing}
                        onChange={(e) => handleChange('routing', e.target.value as RoutingType)}
                    >
                        <option value="off">MANUAL</option>
                        <option value="bpm">BPM</option>
                        <option value="sync1">BASS</option>
                        <option value="sync2">MID</option>
                        <option value="sync3">HIGH</option>
                    </select>
                </div>

                {/* Bottom Row: Knobs Grid */}
                {config.shader !== '00_NONE' && (
                    <div className="flex justify-around items-center pt-1 pb-1 bg-black/10 rounded-lg">
                        {/* Depth/Gain Knob */}
                        <Knob 
                            label="Depth"
                            value={config.gain}
                            min={0}
                            max={200}
                            step={1}
                            onChange={(v) => handleChange('gain', v)}
                            format={(v) => `${v}%`}
                            color="#33ff99"
                        />

                        {/* Only show Mix for Main */}
                        {isMain && (
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
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FxSlot;
