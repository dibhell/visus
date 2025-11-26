class VUProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastSent = 0;
  }

  process(inputs) {
    // Single input expected
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData) return true;

    let sum = 0;
    const len = channelData.length;
    for (let i = 0; i < len; i++) {
      const v = channelData[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / len);

    // Throttle posts to ~60fps
    const now = currentTime;
    if (now - this.lastSent > 1 / 60) {
      this.port.postMessage({ rms });
      this.lastSent = now;
    }
    return true;
  }
}

registerProcessor('vu-processor', VUProcessor);
