import React from 'react';
import { SyncParam } from '../types';

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

    const colors = ['text-sync1', 'text-sync2', 'text-sync3'];
    const borderColors = ['border-sync1', 'border-sync2', 'border-sync3'];
    const names = ['Bass / Kick', 'Mid / Snare', 'High / Hats'];
    const thumbClasses = ['bass-thumb', 'mid-thumb', 'high-thumb']; // Requires custom CSS matching, using generic for now via logic

    return (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded p-3 mb-4">
            <div className="text-xs font-bold text-sync2 uppercase tracking-widest border-b border-sync2 pb-1 mb-3">
                2. Sync & Analysis
            </div>

            {/* Global BPM */}
            <div className="flex gap-2 mb-4 bg-black/40 p-2 rounded">
                <div className="flex-1">
                    <div className="text-xl font-mono text-accent text-center">{syncParams[0].bpm.toFixed(1)}</div>
                    <div className="text-[9px] text-gray-500 text-center mb-1">BPM</div>
                    <input 
                        type="range" min="60" max="180" step="0.1" 
                        value={syncParams[0].bpm}
                        onChange={(e) => update(0, 'bpm', parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>
                <div className="flex-1">
                    <div className="text-xl font-mono text-sync2 text-center">{syncParams[0].offset}ms</div>
                    <div className="text-[9px] text-gray-500 text-center mb-1">OFFSET</div>
                    <input 
                        type="range" min="0" max="1000" step="5" 
                        value={syncParams[0].offset}
                        onChange={(e) => update(0, 'offset', parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Bands */}
            {syncParams.slice(0, 3).map((sync, i) => (
                <div key={i} className={`border-l-2 ${borderColors[i]} pl-3 mb-3 py-1 bg-zinc-900/40 rounded-r`}>
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold ${colors[i]}`}>{names[i]}</span>
                        <span className="text-[9px] font-mono text-gray-400">
                            {sync.freq < 1000 ? `${sync.freq}Hz` : `${(sync.freq/1000).toFixed(1)}kHz`} / Q:{sync.width}
                        </span>
                    </div>
                    
                    <div className="flex gap-2 items-center mb-1">
                        <label className="text-[8px] w-6 text-gray-500">FREQ</label>
                        <input 
                            type="range" 
                            min={i === 0 ? 30 : i === 1 ? 300 : 2000} 
                            max={i === 0 ? 300 : i === 1 ? 4000 : 20000} 
                            step={i === 2 ? 100 : 10}
                            value={sync.freq}
                            onChange={(e) => update(i, 'freq', parseFloat(e.target.value))}
                            className="w-full"
                            style={{accentColor: i===0?'#ff3333':i===1?'#00eeff':'#fce303'}}
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        <label className="text-[8px] w-6 text-gray-500">WIDTH</label>
                        <input 
                            type="range" min="10" max="100" 
                            value={sync.width}
                            onChange={(e) => update(i, 'width', parseFloat(e.target.value))}
                            className="w-full"
                            style={{accentColor: '#888'}}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BandControls;