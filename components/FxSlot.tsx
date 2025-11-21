
import React from 'react';
import { FxState, RoutingType } from '../types';
import { SHADER_LIST } from '../constants';

interface FxSlotProps {
    slotName: keyof FxState;
    fxState: FxState;
    setFxState: React.Dispatch<React.SetStateAction<FxState>>;
    title?: string;
    category: 'main' | 'additive'; // New prop to filter shader types
    activeLevel?: number; // New prop to visualize current modulation
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

    // Filter Shaders based on Category
    // ID < 10 are Simple (Additive), ID >= 10 are Complex (Main)
    const shaderOptions = Object.keys(SHADER_LIST)
        .filter(key => {
            const id = SHADER_LIST[key].id;
            if (key === '00_NONE') return true; // Always available
            if (category === 'additive') return id < 10;
            if (category === 'main') return id >= 10;
            return true;
        })
        .map(key => ({
            value: key,
            label: key.replace(/^\d+_/, '').replace(/_/g, ' ')
        }));

    return (
        <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800 mb-2 relative overflow-hidden">
             {/* Activity Indicator Bar (Left Border) */}
             <div 
                className="absolute left-0 top-0 bottom-0 w-1 bg-accent transition-all duration-75 ease-out"
                style={{ 
                    opacity: config.routing !== 'off' ? 0.5 + (activeLevel * 0.5) : 0,
                    height: `${Math.min(100, activeLevel * 100)}%`,
                    bottom: 0, top: 'auto' 
                }} 
            />
            
            {title && <div className="text-xs font-bold text-gray-500 mb-1 uppercase pl-2">{title}</div>}
            
            <div className="flex flex-col gap-2 pl-2">
                {/* Shader Select */}
                <select
                    className={`w-full bg-black border border-zinc-700 text-xs p-1.5 rounded focus:border-accent outline-none ${config.shader === '00_NONE' ? 'text-gray-500' : 'text-white'}`}
                    value={config.shader}
                    onChange={(e) => handleChange('shader', e.target.value)}
                >
                    {shaderOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>

                <div className="flex items-center gap-2">
                    {/* Routing */}
                    <div className="flex flex-col w-1/3">
                        <label className="text-[9px] text-gray-500 uppercase">Source</label>
                        <select
                            className="w-full bg-black border border-zinc-700 text-[10px] text-white p-1 rounded focus:border-accent outline-none"
                            value={config.routing}
                            onChange={(e) => handleChange('routing', e.target.value as RoutingType)}
                        >
                            <option value="off">Manual</option>
                            <option value="bpm">BPM Pulse</option>
                            <option value="sync1">Sync 1 (Bass)</option>
                            <option value="sync2">Sync 2 (Mid)</option>
                            <option value="sync3">Sync 3 (High)</option>
                        </select>
                    </div>

                    {/* Gain */}
                    <div className="flex flex-col w-2/3">
                        <label className="text-[9px] text-gray-500 uppercase flex justify-between">
                            <span>Gain (Depth)</span>
                            <span className="text-accent font-mono">{config.gain}%</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="range" min="0" max="200" 
                                value={config.gain}
                                onChange={(e) => handleChange('gain', parseInt(e.target.value))}
                                className="w-full"
                            />
                            {/* Mini Visualizer for Activity */}
                            <div className="w-2 h-2 rounded-full bg-accent transition-opacity" style={{opacity: activeLevel > 0.1 ? 1 : 0.1}} />
                        </div>
                    </div>
                </div>

                {isMain && (
                    <div className="flex flex-col mt-1 pt-2 border-t border-zinc-800">
                        <label className="text-[9px] text-gray-500 uppercase flex justify-between">
                            <span>Dry / Wet Mix</span>
                            <span className="text-white font-mono">{config.mix}%</span>
                        </label>
                        <input 
                            type="range" min="0" max="100" 
                            value={config.mix}
                            onChange={(e) => handleChange('mix', parseInt(e.target.value))}
                            className="w-full accent-white"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default FxSlot;
