

import { FilterBand, SyncParam, BandsData } from '../constants';

export class AudioEngine {
    ctx: AudioContext | null = null;
    
    // Main Mix Bus (For Analysis & Recording)
    masterMix: GainNode | null = null;
    mainAnalyser: AnalyserNode | null = null;
    recDest: MediaStreamAudioDestinationNode | null = null;

    // Channel Nodes [Source -> Gain -> VU Analyser -> MasterMix]
    //                               \-> Destination (Speakers, except Mic)
    
    // Channel 1: Video
    videoNode: MediaElementAudioSourceNode | null = null;
    videoGain: GainNode | null = null;
    videoAnalyser: AnalyserNode | null = null;
    // Keep track of the element to avoid re-creation errors
    boundVideoElement: HTMLMediaElement | null = null;

    // Channel 2: Music
    musicNode: MediaElementAudioSourceNode | null = null;
    musicGain: GainNode | null = null;
    musicAnalyser: AnalyserNode | null = null;

    // Channel 3: Mic
    micNode: MediaStreamAudioSourceNode | null = null;
    micGain: GainNode | null = null;
    micAnalyser: AnalyserNode | null = null;

    // Data for Visuals
    bands: BandsData = { sync1: 0, sync2: 0, sync3: 0 };
    filters: FilterBand[] = [];
    vuWorkletLevels = { video: 0, music: 0, mic: 0 };
    vuWorkletReady = false;
    
    // FIXED: Relaxed types to 'any' to prevent TS2345 build error (Uint8Array<ArrayBufferLike> vs ArrayBuffer)
    fftData: any = new Uint8Array(1024);
    
    // Scratch buffers for VU meters
    vuData: any = new Uint8Array(16); 

    constructor() {
        this.bands = { sync1: 0, sync2: 0, sync3: 0 };
    }

    async initContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // 1. Create Main Analysis Chain
            this.mainAnalyser = this.ctx.createAnalyser();
            this.mainAnalyser.fftSize = 4096;
            this.mainAnalyser.smoothingTimeConstant = 0.6;

            this.masterMix = this.ctx.createGain();
            this.masterMix.gain.value = 1.0;
            this.masterMix.connect(this.mainAnalyser);

            // 2. Create Recording Destination
            this.recDest = this.ctx.createMediaStreamDestination();
            this.masterMix.connect(this.recDest);

            // 3. Try load VU Worklet (optional)
            try {
                await this.ctx.audioWorklet.addModule(new URL('./worklets/vu-processor.js', import.meta.url));
                this.vuWorkletReady = true;
            } catch (err) {
                console.warn('VU worklet not available, falling back to analyser nodes', err);
                this.vuWorkletReady = false;
            }
            
            // Initialize Channels
            this.initChannelNodes();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    initChannelNodes() {
        if (!this.ctx || !this.masterMix) return;

        const createChannel = () => {
            const gain = this.ctx!.createGain();
            const analyser = this.ctx!.createAnalyser();
            analyser.fftSize = 32; // Small for VU meter
            analyser.smoothingTimeConstant = 0.3;

            let vuNode: AudioWorkletNode | null = null;
            if (this.vuWorkletReady) {
                try {
                    vuNode = new AudioWorkletNode(this.ctx!, 'vu-processor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
                    vuNode.port.onmessage = () => { /* handler assigned per channel */ };
                } catch (e) {
                    vuNode = null;
                }
            }

            if (vuNode) {
                gain.connect(vuNode);
                vuNode.connect(analyser);
                vuNode.connect(this.masterMix!); // to mix/recording
                vuNode.connect(this.ctx!.destination); // to speakers
            } else {
                gain.connect(analyser);
                gain.connect(this.masterMix!);
                gain.connect(this.ctx!.destination);
            }
            return { gain, analyser, vuNode };
        };

        // Video
        const v = createChannel();
        this.videoGain = v.gain;
        this.videoAnalyser = v.analyser;
        if (v.vuNode) v.vuNode.port.onmessage = (ev) => { this.vuWorkletLevels.video = ev.data.rms * 5; };

        // Music
        const m = createChannel();
        this.musicGain = m.gain;
        this.musicAnalyser = m.analyser;
        if (m.vuNode) m.vuNode.port.onmessage = (ev) => { this.vuWorkletLevels.music = ev.data.rms * 5; };

        // Mic
        const mic = createChannel();
        this.micGain = mic.gain;
        this.micAnalyser = mic.analyser;
        if (mic.vuNode) mic.vuNode.port.onmessage = (ev) => { this.vuWorkletLevels.mic = ev.data.rms * 5; };
    }

    // --- SOURCE CONNECTORS ---

    connectVideo(videoEl: HTMLMediaElement) {
        if (!this.ctx || !this.videoGain) return;
        
        // 1. Check if we already created a source for this EXACT element
        if (this.boundVideoElement === videoEl && this.videoNode) {
            // Already connected. Just ensure the audio graph path is active.
            try {
                this.videoNode.disconnect();
                this.videoNode.connect(this.videoGain);
            } catch(e) {
                // Ignore disconnect errors
            }
            return;
        }
        
        // 2. Disconnect old source if it exists (and is different)
        if (this.videoNode) { 
            try { this.videoNode.disconnect(); } catch(e){} 
        }

        // 3. Create new source
        try {
            this.videoNode = this.ctx.createMediaElementSource(videoEl);
            this.boundVideoElement = videoEl;
            
            // Path 1: To Mixer (Visuals)
            this.videoNode.connect(this.videoGain);
            
            // Path 2: To Speakers (Hearing)
            this.videoGain.connect(this.ctx.destination);
        } catch(e) {
            console.error("AudioEngine: Error connecting video source. It might be already connected.", e);
        }
    }

    connectMusic(audioEl: HTMLMediaElement) {
        if (!this.ctx || !this.musicGain) return;

        if (this.musicNode) { try { this.musicNode.disconnect(); } catch(e){} }

        this.musicNode = this.ctx.createMediaElementSource(audioEl);
        this.musicNode.connect(this.musicGain);
        this.musicGain.connect(this.ctx.destination);
    }

    async connectMic() {
        if (!this.ctx || !this.micGain) return;
        
        // If we have a node, we must check if it's active. 
        // Best practice: always get a new stream to ensure we comply with user intention.
        this.disconnectMic(); 

        try {
            // Request audio with standard constraints
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false 
                }, 
                video: false 
            });
            
            this.micNode = this.ctx.createMediaStreamSource(stream);
            this.micNode.connect(this.micGain);
            // NOTE: We DO NOT connect Mic to ctx.destination to avoid feedback loop
        } catch (e) {
            console.error("Mic access failed", e);
            throw e;
        }
    }

    disconnectMic() {
        if (this.micNode) {
            // CRITICAL: Stop the tracks to release the hardware/permission lock
            if (this.micNode.mediaStream) {
                this.micNode.mediaStream.getTracks().forEach(track => track.stop());
            }
            try { this.micNode.disconnect(); } catch(e){}
            this.micNode = null;
        }
    }

    // --- CONTROLS ---

    setVolume(channel: 'video' | 'music' | 'mic', val: number) {
        // Linear input (0-1) to Exponential Audio Param
        const gainNode = channel === 'video' ? this.videoGain : 
                         channel === 'music' ? this.musicGain : 
                         this.micGain;
        
        if (gainNode && this.ctx) {
            // Smooth transition
            gainNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
        }
    }

    getLevels() {
        if (this.vuWorkletReady) {
            return {
                video: this.vuWorkletLevels.video,
                music: this.vuWorkletLevels.music,
                mic: this.vuWorkletLevels.mic
            };
        }

        const getRMS = (analyser: AnalyserNode | null) => {
            if (!analyser) return 0;
            // No cast needed because vuData is 'any'
            analyser.getByteTimeDomainData(this.vuData);
            let sum = 0;
            for (let i = 0; i < this.vuData.length; i++) {
                const float = (this.vuData[i] - 128) / 128;
                sum += float * float;
            }
            return Math.sqrt(sum / this.vuData.length) * 5.0; // Boosted for visibility
        };

        return {
            video: getRMS(this.videoAnalyser),
            music: getRMS(this.musicAnalyser),
            mic: getRMS(this.micAnalyser)
        };
    }

    // --- ANALYSIS ENGINE ---

    getAudioStream(): MediaStream | null {
        return this.recDest ? this.recDest.stream : null;
    }

    setupFilters(syncParams: SyncParam[]) {
        if (!this.ctx || !this.masterMix) return;

        // Cleanup
        this.filters.forEach(f => {
            if (this.masterMix) this.masterMix.disconnect(f.bandpass);
            f.bandpass.disconnect();
            f.analyser.disconnect();
        });
        this.filters = [];

        ['sync1', 'sync2', 'sync3'].forEach((name, i) => {
            if (!this.ctx || !this.masterMix) return;
            
            const bandpass = this.ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            
            // Set initial params
            const p = syncParams[i];
            bandpass.frequency.value = p ? p.freq : 100;
            bandpass.Q.value = p ? (1 + p.width * 0.1) : 1;

            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 64; 
            analyser.smoothingTimeConstant = 0.3;

            this.masterMix.connect(bandpass);
            bandpass.connect(analyser);

            this.filters.push({ name, bandpass, analyser, data: new Uint8Array(analyser.frequencyBinCount) });
        });
    }

    updateFilters(syncParams: SyncParam[]) {
        if (!this.ctx || this.filters.length === 0) return;

        this.filters.forEach((f, index) => {
            const params = syncParams[index];
            if (f.bandpass && params) {
                const freq = Math.max(20, Math.min(20000, params.freq));
                f.bandpass.frequency.setTargetAtTime(freq, this.ctx!.currentTime, 0.1);
                const qValue = 1 + (params.width * 0.09);
                f.bandpass.Q.setTargetAtTime(qValue, this.ctx!.currentTime, 0.1);
            }
        });
    }

    update() {
        if (!this.mainAnalyser || !this.ctx || this.ctx.state === 'suspended') return;

        // 1. RAW FFT Data (Visualizer)
        // No cast needed because fftData is 'any'
        this.mainAnalyser.getByteFrequencyData(this.fftData);

        // 2. Filtered Bands Data (Logic)
        this.filters.forEach((f, index) => {
            f.analyser.getByteFrequencyData(f.data);
            let sum = 0;
            for(let i=0; i<f.data.length; i++) sum += f.data[i];
            
            const avg = sum / f.data.length;
            const rawNorm = avg / 180.0; 
            // Gain applied in Logic, not audio path
            const normalizedLevel = Math.min(1.2, (rawNorm * rawNorm * 0.5 + rawNorm)); 
            
            this.bands[f.name] = Math.min(1.0, normalizedLevel);
        });
    }
}
