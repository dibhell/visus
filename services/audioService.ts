

import { FilterBand, SyncParam, BandsData } from '../constants';

export class AudioEngine {
    ctx: AudioContext | null = null;
    
    // Main Mix Bus (For Analysis & Recording)
    masterMix: GainNode | null = null;
    mainAnalyser: AnalyserNode | null = null;
    vizAnalyser: AnalyserNode | null = null;
    analysisSink: GainNode | null = null;
    recDest: MediaStreamAudioDestinationNode | null = null;
    recordTaps: MediaStreamAudioDestinationNode[] = [];
    vizOut: GainNode | null = null;

    // Channel Nodes [Source -> Gain -> VU Analyser -> MasterMix]
    //                               \-> Destination (Speakers, except Mic)
    
    // Channel 1: Video
    videoNode: MediaElementAudioSourceNode | null = null;
    videoGain: GainNode | null = null;
    videoAnalyser: AnalyserNode | null = null;
    videoTapAnalyser: AnalyserNode | null = null;
    // Keep track of the element to avoid re-creation errors
    boundVideoElement: HTMLMediaElement | null = null;

    // Channel 2: Music
    musicNode: MediaElementAudioSourceNode | null = null;
    musicGain: GainNode | null = null;
    musicAnalyser: AnalyserNode | null = null;
    musicTapAnalyser: AnalyserNode | null = null;

    // Channel 3: Mic
    micNode: MediaStreamAudioSourceNode | null = null;
    micGain: GainNode | null = null;
    micAnalyser: AnalyserNode | null = null;
    micTapAnalyser: AnalyserNode | null = null;

    // Data for Visuals
    bands: BandsData = { sync1: 0, sync2: 0, sync3: 0 };
    filters: FilterBand[] = [];
    vuWorkletLevels = { video: 0, music: 0, mic: 0 };
    vuWorkletBands = { video: new Float32Array(3), music: new Float32Array(3), mic: new Float32Array(3) };
    vuWorkletBuckets: Record<'video' | 'music' | 'mic', Float32Array | null> = { video: null, music: null, mic: null };
    vuWorkletReady = false;
    useWorkletFFT = true;
    
    // FFT buffer sized to analyser.frequencyBinCount
    fftData: Uint8Array = new Uint8Array(1024);
    vizData: Uint8Array = new Uint8Array(1024);
    spectrumData: Uint8Array = new Uint8Array(1024);
    
    // Scratch buffers for VU meters
    vuData: any = new Uint8Array(16); 
    channelActive = { video: false, music: false, mic: false };

    constructor() {
        this.bands = { sync1: 0, sync2: 0, sync3: 0 };
    }

    getSpectrum(): Uint8Array {
        const analyser = this.vizAnalyser || this.mainAnalyser;
        if (!analyser) return this.spectrumData;
        if (this.spectrumData.length !== analyser.frequencyBinCount) {
            this.spectrumData = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(this.spectrumData as Uint8Array<ArrayBuffer>);
        return this.spectrumData;
    }

    getVizFFTBuffer(): Uint8Array | null {
        if (!this.vizAnalyser) return null;
        if (!this.vizData || this.vizData.length !== this.vizAnalyser.frequencyBinCount) {
            this.vizData = new Uint8Array(this.vizAnalyser.frequencyBinCount);
        }
        this.vizAnalyser.getByteFrequencyData(this.vizData as Uint8Array<ArrayBuffer>);
        return this.vizData;
    }

    getBandLevels(): BandsData {
        return { ...this.bands };
    }

    async initContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'playback' });
            
            // 1. Create Main Analysis Chain
            this.mainAnalyser = this.ctx.createAnalyser();
            this.mainAnalyser.fftSize = 4096;
            this.mainAnalyser.smoothingTimeConstant = 0.6;
            this.fftData = new Uint8Array(this.mainAnalyser.frequencyBinCount);

            this.vizAnalyser = this.ctx.createAnalyser();
            this.vizAnalyser.fftSize = 1024; // wizualizacja: 1024 biny wystarcz¦ù i s¦ù ta+äsze
            this.vizAnalyser.smoothingTimeConstant = 0.28; // troch¦Ö +-ywsze, mniej rozmycia
            this.vizAnalyser.minDecibels = -90;
            this.vizAnalyser.maxDecibels = -10;
            this.vizData = new Uint8Array(this.vizAnalyser.frequencyBinCount);

            // Silent sink to keep analyser branches pulling without audible output
            this.analysisSink = this.ctx.createGain();
            this.analysisSink.gain.value = 0.0;
            this.mainAnalyser.connect(this.analysisSink);
            this.vizAnalyser.connect(this.analysisSink);

            this.masterMix = this.ctx.createGain();
            this.masterMix.gain.value = 1.0;
            this.masterMix.connect(this.mainAnalyser);
            this.masterMix.connect(this.vizAnalyser);

            // Ensure analyser nodes are pulled by the graph (0 gain tap to destination)
            this.vizOut = this.ctx.createGain();
            this.vizOut.gain.value = 0.0;
            this.masterMix.connect(this.vizOut);
            this.vizOut.connect(this.ctx.destination);
            this.analysisSink.connect(this.ctx.destination);

            // 2. Create Recording Destination
            this.recDest = this.ctx.createMediaStreamDestination();
            this.recDest.channelCount = 2;
            this.recDest.channelCountMode = 'explicit';
            this.recDest.channelInterpretation = 'speakers';
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

    private handleVuMessage(channel: 'video' | 'music' | 'mic', payload: any) {
        if (!payload) return;
        const { rms = 0, bands, buckets } = payload;
        this.vuWorkletLevels[channel] = (rms || 0) * 5;
        if (bands && bands.length >= 3) {
            const target = this.vuWorkletBands[channel];
            target[0] = bands[0] || 0;
            target[1] = bands[1] || 0;
            target[2] = bands[2] || 0;
        }
        if (buckets && buckets.length) {
            this.vuWorkletBuckets[channel] = buckets instanceof Float32Array ? buckets : new Float32Array(buckets);
        }
    }

    initChannelNodes() {
        if (!this.ctx || !this.masterMix) return;

        const createChannel = (channel: 'video' | 'music' | 'mic') => {
            const gain = this.ctx!.createGain();
            const analyser = this.ctx!.createAnalyser();
            analyser.fftSize = 32; // Small for VU meter
            analyser.smoothingTimeConstant = 0.3;

            const tap = this.ctx!.createAnalyser();
            tap.fftSize = 512;
            tap.smoothingTimeConstant = 0.55;

            let vuNode: AudioWorkletNode | null = null;
            if (this.vuWorkletReady) {
                try {
                    vuNode = new AudioWorkletNode(this.ctx!, 'vu-processor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
                    vuNode.port.onmessage = (ev) => this.handleVuMessage(channel, ev.data);
                } catch (e) {
                    vuNode = null;
                }
            }

            if (vuNode) {
                gain.connect(vuNode);
                vuNode.connect(analyser);
                vuNode.connect(tap);
                vuNode.connect(this.masterMix!); // to mix/recording
                vuNode.connect(this.ctx!.destination); // to speakers
            } else {
                gain.connect(analyser);
                gain.connect(tap);
                gain.connect(this.masterMix!);
                gain.connect(this.ctx!.destination);
            }

            // Keep analyser branches active even if their output is unused
            if (this.analysisSink) {
                analyser.connect(this.analysisSink);
                tap.connect(this.analysisSink);
            }

            return { gain, analyser, tap, vuNode };
        };

        // Video
        const v = createChannel('video');
        this.videoGain = v.gain;
        this.videoAnalyser = v.analyser;
        this.videoTapAnalyser = v.tap;

        // Music
        const m = createChannel('music');
        this.musicGain = m.gain;
        this.musicAnalyser = m.analyser;
        this.musicTapAnalyser = m.tap;

        // Mic
        const mic = createChannel('mic');
        this.micGain = mic.gain;
        this.micAnalyser = mic.analyser;
        this.micTapAnalyser = mic.tap;
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

            // Path 3: Direct tap for metering (pre-fader)
            if (this.videoTapAnalyser) {
                this.videoNode.connect(this.videoTapAnalyser);
                if (this.analysisSink) this.videoTapAnalyser.connect(this.analysisSink);
            }
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

        // Direct tap pre-fader for VU/FFT
        if (this.musicTapAnalyser) {
            this.musicNode.connect(this.musicTapAnalyser);
            if (this.analysisSink) this.musicTapAnalyser.connect(this.analysisSink);
        }
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

            // Direct tap for metering (pre-fader)
            if (this.micTapAnalyser) {
                this.micNode.connect(this.micTapAnalyser);
                if (this.analysisSink) this.micTapAnalyser.connect(this.analysisSink);
            }
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

    setUseWorkletFFT(enabled: boolean) {
        this.useWorkletFFT = enabled;
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

    setChannelActive(channel: 'video' | 'music' | 'mic', active: boolean) {
        this.channelActive[channel] = active;
    }

    getLevels() {
        if (this.vuWorkletReady && this.useWorkletFFT) {
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
        if (!this.ctx || !this.masterMix) return null;

        // Lazily create destination if missing
        if (!this.recDest) {
            this.recDest = this.ctx.createMediaStreamDestination();
            this.recDest.channelCount = 2;
            this.recDest.channelCountMode = 'explicit';
            this.recDest.channelInterpretation = 'speakers';
            this.masterMix.connect(this.recDest);
        }

        const tracks = this.recDest.stream.getAudioTracks();
        const hasLive = tracks.some(t => t.readyState === 'live');

        // Ensure the track is enabled before handing it to MediaRecorder.
        tracks.forEach(t => { t.enabled = true; });

        // If the node stopped producing audio (ended), rebuild destination to restore a live track.
        if (!hasLive) {
            try { this.masterMix.disconnect(this.recDest); } catch {}
            this.recDest = this.ctx.createMediaStreamDestination();
            this.recDest.channelCount = 2;
            this.recDest.channelCountMode = 'explicit';
            this.recDest.channelInterpretation = 'speakers';
            this.masterMix.connect(this.recDest);
        }

        return this.recDest.stream;
    }

    createRecordingTap(): MediaStreamAudioDestinationNode | null {
        if (!this.ctx || !this.masterMix) return null;
        const tap = this.ctx.createMediaStreamDestination();
        tap.channelCount = 2;
        tap.channelCountMode = 'explicit';
        tap.channelInterpretation = 'speakers';
        this.masterMix.connect(tap);
        this.recordTaps.push(tap);
        return tap;
    }

    releaseRecordingTap(tap: MediaStreamAudioDestinationNode | null) {
        if (!tap || !this.masterMix) return;
        try { this.masterMix.disconnect(tap); } catch {}
        this.recordTaps = this.recordTaps.filter(t => t !== tap);
    }

    createRecordingStream() {
        if (!this.ctx || !this.masterMix) return { stream: null as MediaStream | null, cleanup: () => {} };
        const dest = this.ctx.createMediaStreamDestination();
        dest.channelCount = 2;
        dest.channelCountMode = 'explicit';
        dest.channelInterpretation = 'speakers';
        this.masterMix.connect(dest);
        const cleanup = () => {
            try { this.masterMix?.disconnect(dest); } catch {}
        };
        return { stream: dest.stream, cleanup };
    }

    getFFTData(): Uint8Array | null {
        // Keep context alive to ensure analysers flow
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (this.vuWorkletReady && this.useWorkletFFT) {
            const chooseBuckets = (): Float32Array | null => {
                const priority: Array<'music' | 'video' | 'mic'> = ['music', 'video', 'mic'];
                for (const ch of priority) {
                    if (this.vuWorkletBuckets[ch]) return this.vuWorkletBuckets[ch];
                }
                return this.vuWorkletBuckets.music || this.vuWorkletBuckets.video || this.vuWorkletBuckets.mic || null;
            };
            const buckets = chooseBuckets();
            if (buckets && buckets.length > 0) {
                const buf = new Uint8Array(buckets.length);
                for (let i = 0; i < buckets.length; i++) {
                    const v = Math.max(0, Math.min(1, buckets[i] || 0));
                    buf[i] = Math.min(255, Math.round(v * 255));
                }
                return buf;
            }
        }

        // Prefer available analysers regardless of channelActive to keep spectrum alive
        const analyser =
            this.musicTapAnalyser ||
            this.videoTapAnalyser ||
            this.micTapAnalyser ||
            this.vizAnalyser ||
            this.mainAnalyser ||
            null;

        if (!analyser) return null;

        if (this.vizData.length !== analyser.frequencyBinCount) {
            this.vizData = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(this.vizData as Uint8Array<ArrayBuffer>);

        // If the analyser is starved (all zeros), try a quick fallback from other analysers.
        let hasEnergy = false;
        for (let i = 0; i < this.vizData.length; i++) {
            if (this.vizData[i] > 0) { hasEnergy = true; break; }
        }

        if (!hasEnergy) {
            const scratch = new Uint8Array(512);
            const mixInto = (src: AnalyserNode | null) => {
                if (!src) return;
                if (src.fftSize < 1024) src.fftSize = 1024;
                src.smoothingTimeConstant = 0.5;
                src.getByteFrequencyData(scratch as Uint8Array<ArrayBuffer>);
                for (let i = 0; i < scratch.length && i < this.vizData.length; i++) {
                    this.vizData[i] = Math.max(this.vizData[i], scratch[i]);
                }
            };
            mixInto(this.videoTapAnalyser || this.videoAnalyser || this.vizAnalyser || this.mainAnalyser);
            mixInto(this.musicTapAnalyser || this.musicAnalyser || this.vizAnalyser || this.mainAnalyser);
            mixInto(this.micTapAnalyser || this.micAnalyser || this.vizAnalyser || this.mainAnalyser);

            // Last resort: use time-domain energy to synthesize a floor so the UI shows activity.
            if (this.vizData.every(v => v === 0)) {
                const timeBuf = new Uint8Array(analyser.fftSize);
                analyser.getByteTimeDomainData(timeBuf as Uint8Array<ArrayBuffer>);
                for (let i = 0; i < timeBuf.length && i < this.vizData.length; i++) {
                    const v = Math.abs(timeBuf[i] - 128) * 2;
                    this.vizData[i] = Math.min(255, v);
                }
            }
        }

        return new Uint8Array(this.vizData);
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
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.45;

            this.masterMix.connect(bandpass);
            bandpass.connect(analyser);

            // Connect analyser to silent sink so it keeps processing
            if (this.analysisSink) analyser.connect(this.analysisSink);

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
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
            return;
        }

        // 1. RAW FFT Data (Visualizer)
        if (!this.vuWorkletReady || !this.useWorkletFFT) {
            const analyser = this.vizAnalyser || this.mainAnalyser;
            if (analyser) {
                if (this.fftData.length !== analyser.frequencyBinCount) {
                    this.fftData = new Uint8Array(analyser.frequencyBinCount);
                }
                analyser.getByteFrequencyData(this.fftData as Uint8Array<ArrayBuffer>);

                // If still empty (possible if graph not yet flowing), try time-domain energy
                let energy = 0;
                for (let i = 0; i < this.fftData.length; i++) energy += this.fftData[i];
                if (energy === 0) {
                    const timeBuf = new Uint8Array(analyser.fftSize);
                    analyser.getByteTimeDomainData(timeBuf as Uint8Array<ArrayBuffer>);
                    for (let i = 0; i < timeBuf.length && i < this.fftData.length; i++) {
                        const v = Math.abs(timeBuf[i] - 128) * 2;
                        this.fftData[i] = Math.min(255, v);
                    }
                }
            }
        }

        // 2. Filtered Bands Data (Logic)
        this.filters.forEach((f, index) => {
            f.analyser.getByteFrequencyData(f.data);
            let peak = 0;
            for (let i = 0; i < f.data.length; i++) {
                if (f.data[i] > peak) peak = f.data[i];
            }
            // Use peak with soft power curve and smoothing to keep bands stable but reactive
            const shaped = Math.pow(peak / 255, 0.6) * 1.4;
            const target = Math.min(1.0, shaped);
            const prev = this.bands[f.name] ?? 0;
            this.bands[f.name] = (prev * 0.25) + (target * 0.75);
        });

        // Blend in worklet-provided bands when available (use max across channels)
        if (this.vuWorkletReady && this.useWorkletFFT) {
            const low = Math.max(this.vuWorkletBands.video[0] || 0, this.vuWorkletBands.music[0] || 0, this.vuWorkletBands.mic[0] || 0);
            const mid = Math.max(this.vuWorkletBands.video[1] || 0, this.vuWorkletBands.music[1] || 0, this.vuWorkletBands.mic[1] || 0);
            const high = Math.max(this.vuWorkletBands.video[2] || 0, this.vuWorkletBands.music[2] || 0, this.vuWorkletBands.mic[2] || 0);
            this.bands.sync1 = (this.bands.sync1 * 0.4) + (low * 0.6);
            this.bands.sync2 = (this.bands.sync2 * 0.4) + (mid * 0.6);
            this.bands.sync3 = (this.bands.sync3 * 0.4) + (high * 0.6);
        }
    }
}
