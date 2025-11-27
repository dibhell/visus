import { AudioEngine } from './audioService';

/**
 * ExperimentalAudioEngine reduces GC pressure by reusing buffers for VU meters
 * and exposing a fast-path levels reader for the experimental renderer loop.
 */
export class ExperimentalAudioEngine extends AudioEngine {
    private vuScratch = new Float32Array(3);
    private vuSmooth = new Float32Array(3);

    getLevelsFast(smoothing = 0.25): Float32Array {
        const calc = (analyser: AnalyserNode | null, idx: number) => {
            if (!analyser) {
                this.vuSmooth[idx] *= 0.9;
                this.vuScratch[idx] = this.vuSmooth[idx];
                return;
            }
            analyser.getByteTimeDomainData(this.vuData);
            let sum = 0;
            for (let i = 0; i < this.vuData.length; i++) {
                const v = (this.vuData[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / this.vuData.length) * 5.0;
            const smoothed = (this.vuSmooth[idx] * (1 - smoothing)) + (rms * smoothing);
            this.vuSmooth[idx] = smoothed;
            this.vuScratch[idx] = smoothed;
        };

        calc(this.videoAnalyser, 0);
        calc(this.musicAnalyser, 1);
        calc(this.micAnalyser, 2);

        // Fallback: if all channels are near-zero but audio is likely playing, use main analyser energy.
        if (this.vuScratch[0] < 0.01 && this.vuScratch[1] < 0.01 && this.vuScratch[2] < 0.01 && this.vizAnalyser) {
            const buf = new Uint8Array(this.vizAnalyser.frequencyBinCount);
            this.vizAnalyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            const rms = Math.sqrt(sum / buf.length) / 255 * 5.0;
            const smoothed = (this.vuSmooth[1] * (1 - smoothing)) + (rms * smoothing);
            this.vuSmooth[0] = smoothed;
            this.vuSmooth[1] = smoothed;
            this.vuSmooth[2] = smoothed * 0.6; // mic likely off
            this.vuScratch[0] = this.vuSmooth[0];
            this.vuScratch[1] = this.vuSmooth[1];
            this.vuScratch[2] = this.vuSmooth[2];
        }

        return this.vuScratch;
    }

    getLevelsObject() {
        const arr = this.getLevelsFast();
        return { video: arr[0], music: arr[1], mic: arr[2] };
    }
}
