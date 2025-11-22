
import React, { useState } from 'react';
import { MusicTrack } from '../types';

interface Props {
    onSelect: (url: string, trackName: string) => void;
    onClose: () => void;
}

const MusicCatalog: React.FC<Props> = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MusicTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const searchMusic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=15`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setResults(data.results);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch music. iTunes API might be blocked by CORS.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-30"></div>

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h3 className="text-white font-black tracking-widest text-xl">MUSIC CATALOG</h3>
                        <div className="text-[10px] text-zinc-500 font-mono mt-1 tracking-widest">POWERED BY ITUNES • 30s PREVIEWS</div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:border-white/30 transition-all">✕</button>
                </div>

                {/* Search */}
                <div className="p-6 border-b border-white/5 bg-black/40">
                    <form onSubmit={searchMusic} className="flex gap-3">
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search artists, genres, songs..."
                            className="flex-1 bg-black border border-white/10 text-white text-sm p-4 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all placeholder-zinc-600"
                            autoFocus
                        />
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-white text-black font-bold text-sm px-8 rounded-xl hover:bg-accent hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {loading ? '...' : 'SEARCH'}
                        </button>
                    </form>
                    {error && <div className="text-red-500 text-xs mt-3 font-mono bg-red-900/20 p-2 rounded border border-red-900/50">{error}</div>}
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-black/20">
                    {results.length === 0 && !loading && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-4">
                            <div className="text-5xl opacity-20">♪</div>
                            <div className="text-xs font-mono tracking-widest opacity-50">ENTER A SEARCH TERM</div>
                        </div>
                    )}

                    {results.map((track) => (
                        <div 
                            key={track.trackId}
                            onClick={() => onSelect(track.previewUrl, `${track.artistName} - ${track.trackName}`)}
                            className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-800 hover:border-accent/50 cursor-pointer transition-all group"
                        >
                            <img src={track.artworkUrl100} alt="art" className="w-12 h-12 rounded-lg shadow-lg group-hover:scale-105 transition-transform" />
                            <div className="flex-1 min-w-0">
                                <div className="text-gray-200 text-sm font-bold truncate group-hover:text-accent transition-colors">{track.trackName}</div>
                                <div className="text-zinc-500 text-xs truncate font-mono">{track.artistName}</div>
                            </div>
                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 group-hover:text-black group-hover:bg-accent group-hover:border-accent transition-all">
                                ▶
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MusicCatalog;
