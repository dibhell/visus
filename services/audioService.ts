

import { FilterBand, SyncParam, BandsData } from '../constants';

export class AudioEngine {
    ctx: AudioContext | null = null;
    anRaw: AnalyserNode | null = null;
    
    // Sources
    src: MediaElementAudioSourceNode | null = null; // File/Element source
    micSrc: MediaStreamAudioSourceNode | null = null; // Microphone source
    
    // Nodes
    gainNode: GainNode | null = null; // Master Gain for Analyzer
    micPreAmp: GainNode | null = null; // Gain specifically for Mic Input boost
    
    // For Recording
    recDest: MediaStreamAudioDestinationNode | null = null;

    bands: BandsData = { sync1: 0, sync2: 0, sync3: 0 };
    filters: FilterBand[] = [];
    fftData: Uint8Array = new Uint8Array(1024);
    currentParams: SyncParam[] = [];
    
    isMicActive: boolean = false;

    constructor() {
        this.bands = { sync1: 0, sync2: 0, sync3: 0 };
    }

    async initContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.anRaw = this.ctx.createAnalyser();
            // Increased fftSize for better bass resolution
            this.anRaw.fftSize = 4096; 
            this.anRaw.smoothingTimeConstant = 0.6; 

            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.anRaw);
            
            // Default: Connect to speakers (will be disconnected for Mic)
            this.anRaw.connect(this.ctx.destination);

            // Create Recording Destination (Loopback for MediaRecorder)
            this.recDest = this.ctx.createMediaStreamDestination();
            this.gainNode.connect(this.recDest);
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    async enableMicrophone(initialGain: number = 2.0): Promise<void> {
        await this.initContext();
        this.stopAllSources();
        this.isMicActive = true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            // Create Mic Source
            this.micSrc = this.ctx!.createMediaStreamSource(stream);
            
            // Create Pre-Amp Gain for Mic (to boost quiet signals)
            this.micPreAmp = this.ctx!.createGain();
            this.micPreAmp.gain.value = initialGain;

            // Connect: Mic -> PreAmp -> MainAnalyzerGain
            this.micSrc.connect(this.micPreAmp);
            if (this.gainNode) {
                this.micPreAmp.connect(this.gainNode);
            }

            // CRITICAL: Disconnect Analyzer from Speakers to prevent Feedback Loop
            // But keep it connected to RecDest (handled in initContext)
            try {
                this.anRaw?.disconnect(this.ctx!.destination);
            } catch (e) { 
                // Ignore if already disconnected
            }

        } catch (e) {
            console.error("Error accessing microphone", e);
            throw e;
        }
    }

    stopMicrophone() {
        if (this.micSrc) {
            try { 
                this.micSrc.disconnect(); 
                this.micPreAmp?.disconnect();
            } catch (e) {}
            this.micSrc = null;
            this.micPreAmp = null;
        }
        
        // Reconnect analyzer to speakers if we want to go back to normal mode? 
        // For now just silence the mic path.
        this.isMicActive = false;
    }

    setMicrophoneGain(value: number) {
        if (this.micPreAmp) {
            this.micPreAmp.gain.value = value;
        }
    }

    async init(el: HTMLMediaElement): Promise<void> {
        await this.initContext();
        this.stopAllSources();
        this.isMicActive = false;

        try {
            this.src = this.ctx!.createMediaElementSource(el);
            if (this.gainNode) {
                this.src.connect(this.gainNode);
            }
            
            // Reconnect to speakers for file playback
            try {
                this.anRaw?.connect(this.ctx!.destination);
            } catch(e) {
                // Already connected
            }
        } catch (e) {
            console.error("Error creating MediaElementSource", e);
        }
    }

    private stopAllSources() {
        // Stop File Source
        if (this.src) {
            try { this.src.disconnect(); } catch (e) {}
            this.src = null;
        }

        // Stop Mic Source
        if (this.micSrc) {
            try { 
                this.micSrc.disconnect(); 
                this.micPreAmp?.disconnect();
            } catch (e) {}
            this.micSrc = null;
            this.micPreAmp = null;
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