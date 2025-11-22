
import { FilterBand, SyncParam, BandsData } from '../types';

export class AudioEngine {
    ctx: AudioContext | null = null;
    anRaw: AnalyserNode | null = null;
    src: MediaElementAudioSourceNode | null = null;
    gainNode: GainNode | null = null;
    // For Recording
    recDest: MediaStreamAudioDestinationNode | null = null;

    bands: BandsData = { sync1: 0, sync2: 0, sync3: 0 };
    filters: FilterBand[] = [];
    fftData: Uint8Array = new Uint8Array(1024);
    currentParams: SyncParam[] = [];

    constructor() {
        this.bands = { sync1: 0, sync2: 0, sync3: 0 };
    }

    async init(el: HTMLMediaElement): Promise<void> {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.anRaw = this.ctx.createAnalyser();
            // Increased fftSize for better bass resolution
            this.anRaw.fftSize = 4096; 
            this.anRaw.smoothingTimeConstant = 0.6; // Snappier response

            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.anRaw);
            this.anRaw.connect(this.ctx.destination);

            // Create Recording Destination (Loopback for MediaRecorder)
            this.recDest = this.ctx.createMediaStreamDestination();
            this.gainNode.connect(this.recDest);
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Clean up existing source to prevent connection errors or double playing
        if (this.src) {
            try {
                this.src.disconnect();
            } catch (e) {
                console.warn("Could not disconnect old source", e);
            }
            this.src = null;
        }

        try {
            this.src = this.ctx.createMediaElementSource(el);
            if (this.gainNode) {
                this.src.connect(this.gainNode);
            }
        } catch (e) {
            console.error("Error creating MediaElementSource", e);
        }
    }

    // Returns the stream for MediaRecorder
    getAudioStream(): MediaStream | null {
        return this.recDest ? this.recDest.stream : null;
    }

    setupFilters() {
        if (!this.ctx || !this.gainNode) return;

        // Cleanup old filters
        this.filters.forEach(f => {
            if (this.gainNode) this.gainNode.disconnect(f.bandpass);
            f.bandpass.disconnect();
            f.analyser.disconnect();
        });
        this.filters = [];

        ['sync1', 'sync2', 'sync3'].forEach(name => {
            if (!this.ctx || !this.gainNode) return;
            
            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';

            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 64; // Small FFT for fast envelope detection
            analyser.smoothingTimeConstant = 0.3;

            this.gainNode.connect(bandpass);
            bandpass.connect(analyser);

            this.filters.push({ name, bandpass, analyser, data: new Uint8Array(analyser.frequencyBinCount) });
        });
    }

    updateFilters(syncParams: SyncParam[]) {
        this.currentParams = syncParams;
        if (!this.ctx || this.filters.length === 0) return;

        this.filters.forEach((f, index) => {
            const params = syncParams[index];
            if (f.bandpass && params) {
                // Secure frequency clamping
                const freq = Math.max(20, Math.min(20000, params.freq));
                f.bandpass.frequency.setValueAtTime(freq, this.ctx!.currentTime);
                
                // Q Value: 10% Width -> Q=1, 100% Width -> Q=10 (Approximation)
                const qValue = 1 + (params.width * 0.09);
                f.bandpass.Q.setValueAtTime(qValue, this.ctx!.currentTime);
            }
        });
    }

    update() {
        if (!this.anRaw || !this.ctx || this.ctx.state === 'suspended') return;

        // 1. RAW FFT Data (Visualizer)
        // Cast to any to prevent TS mismatch
        this.anRaw.getByteFrequencyData(this.fftData as any);

        // 2. Filtered Bands Data (Logic)
        this.filters.forEach((f, index) => {
            // Cast to any to prevent TS mismatch
            f.analyser.getByteFrequencyData(f.data as any);
            let sum = 0;
            for(let i=0; i<f.data.length; i++) sum += f.data[i];
            
            const avg = sum / f.data.length;
            
            // NORMALIZATION + GAIN SENSITIVITY
            const userGain = this.currentParams[index]?.gain ?? 1.0;
            const rawNorm = avg / 180.0; 
            const normalizedLevel = Math.min(1.2, (rawNorm * rawNorm * 0.5 + rawNorm) * userGain); 
            
            this.bands[f.name] = Math.min(1.0, normalizedLevel);
        });
    }
}
