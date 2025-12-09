class VUProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastSent = 0;
    this.fftSize = 512;
    this.bucketCount = 12; // 8–16 buckets of coarse spectrum energy
    this.buffer = new Float32Array(this.fftSize);
    this.bufferIndex = 0;
    this.window = new Float32Array(this.fftSize);
    this.buckets = new Float32Array(this.bucketCount);
    this.bands = new Float32Array(3); // low / mid / high
    this.rmsSmooth = 0;

    for (let i = 0; i < this.fftSize; i++) {
      // Hann window to reduce spectral leakage
      this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
    }
  }

  computeBuckets() {
    const N = this.fftSize;
    if (this.bufferIndex < N) return;

    // Naive DFT on a handful of buckets to keep CPU low in the worklet
    for (let b = 0; b < this.bucketCount; b++) {
      const k = Math.max(1, Math.floor(((b + 0.5) * N) / (2 * this.bucketCount)));
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        const s = this.buffer[n] * this.window[n];
        const phase = (-2 * Math.PI * k * n) / N;
        re += s * Math.cos(phase);
        im += s * Math.sin(phase);
      }
      const mag = Math.sqrt(re * re + im * im) / (N / 2);
      this.buckets[b] = mag;
    }

    // Low / Mid / High aggregation
    const lowEnd = Math.max(1, Math.floor(this.bucketCount / 4));
    const midEnd = Math.max(lowEnd + 1, Math.floor(this.bucketCount / 2));
    const sumRange = (start, end) => {
      let sum = 0;
      const count = Math.max(1, end - start);
      for (let i = start; i < end; i++) sum += this.buckets[i];
      return sum / count;
    };
    this.bands[0] = sumRange(0, lowEnd);
    this.bands[1] = sumRange(lowEnd, midEnd);
    this.bands[2] = sumRange(midEnd, this.bucketCount);

    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData) return true;

    let sum = 0;
    const len = channelData.length;
    for (let i = 0; i < len; i++) {
      const v = channelData[i];
      sum += v * v;
      if (this.bufferIndex < this.fftSize) {
        this.buffer[this.bufferIndex++] = v;
      }
    }
    const blockRms = Math.sqrt(sum / len);
    this.rmsSmooth = this.rmsSmooth * 0.8 + blockRms * 0.2;

    if (this.bufferIndex >= this.fftSize) {
      this.computeBuckets();
    }

    // Throttle posts to ~60fps
    const now = currentTime;
    if (now - this.lastSent > 1 / 60 && this.buckets && this.buckets.length) {
      this.port.postMessage({
        rms: this.rmsSmooth,
        bands: this.bands,
        buckets: this.buckets
      });
      this.lastSent = now;
    }
    return true;
  }
}

registerProcessor('vu-processor', VUProcessor);
