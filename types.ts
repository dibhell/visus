
export interface SyncParam {
  bpm: number;
  offset: number;
  freq: number;
  width: number;
}

export type RoutingType = 'off' | 'bpm' | 'sync1' | 'sync2' | 'sync3';

// FR-105: Support for Manual Resolution
export type AspectRatioMode = 'fit' | '16:9' | '9:16' | 'manual';

export interface FxConfig {
  shader: string;
  routing: RoutingType;
  gain: number;
  mix?: number; // Only for main
}

export interface FxState {
  main: FxConfig;
  fx1: FxConfig;
  fx2: FxConfig;
  fx3: FxConfig;
  fx4: FxConfig;
  fx5: FxConfig;
}

export interface ShaderDefinition {
  id: number;
  src: string;
}

export interface ShaderList {
  [key: string]: ShaderDefinition;
}

export interface FilterBand {
  name: string;
  bandpass: BiquadFilterNode;
  analyser: AnalyserNode;
  data: Uint8Array;
}

export interface BandsData {
  sync1: number;
  sync2: number;
  sync3: number;
  [key: string]: number;
}
