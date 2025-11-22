
import React from 'react';
import { SyncParam } from '../types';
import Knob from './Knob';

interface BandControlsProps {
    syncParams: SyncParam[];
    setSyncParams: React.Dispatch<React.SetStateAction<SyncParam[]>>;
    onUpdateFilters: (params: SyncParam[]) => void;
}

const BandControls: React.FC<BandControlsProps> = ({ syncParams, setSyncParams, onUpdateFilters }) => {
    
    const update = (index: number, key: keyof SyncParam, value: number) => {
        const newParams = [...syncParams];
        newParams[index] = { ...newParams[index], [key]: value };
        setSyncParams(newParams);
        onUpdateFilters(newParams);
    };

    const colors = ['#ff3333', '#00eeff', '#fce303']; // hex for knobs
    const textColors = ['text-sync1', 'text-sync2', 'text-sync3'];
    const borderColors = ['border-sync1', 'border-sync2', 'border-sync3'];
    const names = ['Bass', 'Mid', 'High'];

    const formatFreq = (v: number) => v < 1000 ? `${Math.round(v)}Hz` : `${(v/1000).toFixed(1)}k`;
    const formatPct = (v: number) => `${v.toFixed(0)}%`;
    const formatGain = (v: number) => `${v.toFixed(1)}x`;

    return (
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-4 mb-4 space-y-4 backdrop-blur-sm">
            {/* Global BPM - Keep as Slider for precision */}
            <div className="flex gap-3 bg-black/40 p-3 rounded-lg border border-white/5">
                <div className="flex-1">
                    <div className="flex justify-between items-end mb-2">
                        <div className="text-[9px] text-zinc-500 font-bold tracking-widest">BPM</div>
                        <div className="text-xs font-mono text-accent">{syncParams[0].bpm.toFixed(1)}</div>
                    </div>
                    <input 
                        type="range" min="60" max="180" step="0.1" 
                        value={syncParams[0].bpm}
                        onChange={(e) => update(0, 'bpm', parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>
                <div className="flex-1">
                     <div className="flex justify-between items-end mb-2">
                        <div className="text-[9px] text-zinc-500 font-bold tracking-widest">OFFSET</div>
                        <div className="text-xs font-mono text-zinc-300">{syncParams[0].offset}ms</div>
                    </div>
                    <input 
                        type="range" min="0" max="1000" step="5" 
                        value={syncParams[0].offset}
                        onChange={(e) => update(0, 'offset', parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Bands Knob View */}
            <div className="space-y-2">
                {syncParams.slice(0, 3).map((sync, i) => (
                    <div key={i} className={`relative p-2 bg-black/20 rounded border-l-2 ${borderColors[i]} flex items-center gap-2`}>
                        <div className={`text-[10px] font-black uppercase w-8 -rotate-90 ${textColors[i]} text-center`}>
                            {names[i]}
                        </div>
                        
                        <div className="flex-1 flex justify-around items-center">
                            {/* Frequency Knob */}
                            <Knob 
                                label="Freq" 
                                value={sync.freq} 
                                min={i === 0 ? 20 : i === 1 ? 200 : 2000} 
                                max={i === 0 ? 500 : i === 1 ? 5000 : 20000}
                                step={10}
                                onChange={(v) => update(i, 'freq', v)}
                                format={formatFreq}
                                color={colors[i]}
                            />

                            {/* Width (Q) Knob */}
                            <Knob 
                                label="Width" 
                                value={sync.width} 
                                min={1} 
                                max={150}
                                step={1}
                                onChange={(v) => update(i, 'width', v)}
                                format={formatPct}
                                color={colors[i]}
                            />

                            {/* Gain Knob */}
                            <Knob 
                                label="Gain" 
                                value={sync.gain} 
                                min={0.1} 
                                max={3.0}
                                step={0.1}
                                onChange={(v) => update(i, 'gain', v)}
                                format={formatGain}
                                color={colors[i]}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BandControls;
