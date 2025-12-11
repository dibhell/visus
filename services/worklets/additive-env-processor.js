const clamp01 = (v) => Math.max(0, Math.min(1, v));

class AdditiveEnvProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.config = {
      enabled: false,
      source: 'RMS',
      attackMs: 10,
      releaseMs: 200,
      shape: 0,
      gain: 1,
      offset: 0,
      delayMs: 0,
      depth: 0,
      mode: 'normal',
    };

    this.env = 0.5;
    this.blockSize = 128;
    this.attackCoef = this.calcCoef(this.config.attackMs);
    this.releaseCoef = this.calcCoef(this.config.releaseMs);
    this.delayBlocks = 0;
    this.delayBuffer = new Float32Array(this.computeMaxDelayBlocks() + 2);
    this.writeIndex = 0;
    this.lastSent = 0;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'config' && data.config) {
        this.applyConfig(data.config);
      }
    };
  }

  calcCoef(ms) {
    const clamped = Math.max(0.0005, ms * 0.001);
    return Math.exp(-1 / (clamped * sampleRate));
  }

  computeMaxDelayBlocks() {
    const maxMs = 200;
    return Math.max(1, Math.ceil((maxMs * sampleRate) / (this.blockSize * 1000)));
  }

  resetDelay(value = 0.5) {
    for (let i = 0; i < this.delayBuffer.length; i++) {
      this.delayBuffer[i] = value;
    }
    this.writeIndex = 0;
  }

  updateDelaySettings() {
    const neededSize = this.computeMaxDelayBlocks() + 2;
    if (this.delayBuffer.length !== neededSize) {
      this.delayBuffer = new Float32Array(neededSize);
      this.resetDelay(0.5);
    }
    const boundedDelay = Math.max(0, Math.min(200, this.config.delayMs));
    this.delayBlocks = Math.max(
      0,
      Math.round((boundedDelay * sampleRate) / (this.blockSize * 1000))
    );
  }

  applyConfig(partial) {
    const next = { ...this.config, ...partial };
    next.enabled = !!next.enabled;
    next.source = next.source === 'PEAK' ? 'PEAK' : 'RMS';
    next.mode = next.mode === 'invert' ? 'invert' : 'normal';
    next.attackMs = Math.min(200, Math.max(0.5, next.attackMs));
    next.releaseMs = Math.min(2000, Math.max(10, next.releaseMs));
    next.shape = Math.max(-1, Math.min(1, next.shape));
    next.gain = Math.max(0, Math.min(2, next.gain));
    next.offset = Math.max(-1, Math.min(1, next.offset));
    next.delayMs = Math.max(0, Math.min(200, next.delayMs));
    next.depth = Math.max(0, Math.min(1, next.depth));

    this.config = next;
    this.attackCoef = this.calcCoef(next.attackMs);
    this.releaseCoef = this.calcCoef(next.releaseMs);
    this.updateDelaySettings();

    if (!next.enabled || next.depth <= 0) {
      this.env = 0.5;
      this.resetDelay(0.5);
    }
  }

  maybeSend(envOut, detector, envRaw) {
    const now = currentTime;
    // gęstsze próbkowanie ~50 fps
    if (now - this.lastSent >= 0.02) {
      this.port.postMessage({
        additiveEnv: envOut,
        detector,
        envRaw,
      });
      this.lastSent = now;
    }
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];

    if (channel && channel.length > 0 && channel.length !== this.blockSize) {
      this.blockSize = channel.length;
      this.updateDelaySettings();
    }

    if (!this.config.enabled || this.config.depth <= 0) {
      this.maybeSend(0.5, 0.0, this.env);
      return true;
    }

    if (!channel || channel.length === 0) {
      this.maybeSend(clamp01(this.env), 0.0, this.env);
      return true;
    }

    let level = 0;
    if (this.config.source === 'PEAK') {
      let peak = 0;
      for (let i = 0; i < channel.length; i++) {
        const v = Math.abs(channel[i]);
        if (v > peak) peak = v;
      }
      level = peak;
    } else {
      let sum = 0;
      for (let i = 0; i < channel.length; i++) {
        const v = channel[i];
        sum += v * v;
      }
      level = Math.sqrt(sum / channel.length);
    }

    const incoming = clamp01(level);
    let env = this.env;
    if (incoming > env) {
      env = env + this.attackCoef * (incoming - env);
    } else {
      env = env + this.releaseCoef * (incoming - env);
    }
    this.env = env;

    let shaped;
    if (this.config.shape >= 0) {
      const expo = Math.max(0.05, 1.0 - this.config.shape);
      shaped = Math.pow(env, expo);
    } else {
      const expo = 1.0 - this.config.shape;
      shaped = Math.pow(env, expo);
    }

    let value = shaped * this.config.gain + this.config.offset;

    this.delayBuffer[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.delayBuffer.length;
    const readIndex =
      (this.writeIndex - this.delayBlocks + this.delayBuffer.length) %
      this.delayBuffer.length;
    let delayed = this.delayBuffer[readIndex];

    if (this.config.mode === 'invert') {
      delayed = 1.0 - delayed;
    }

    const envOut = clamp01(delayed);

    // incoming: poziom z detektora (RMS/Peak 0..1)
    // env: obwiednia po attack/release
    this.maybeSend(envOut, incoming, env);
    return true;
  }
}

registerProcessor('additive-env-processor', AdditiveEnvProcessor);
