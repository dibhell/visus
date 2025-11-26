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
        return this.vuScratch;
    }

    getLevelsObject() {
        const arr = this.getLevelsFast();
        return { video: arr[0], music: arr[1], mic: arr[2] };
    }
}
