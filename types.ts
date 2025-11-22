
export interface SyncParam {
  bpm: number;
  offset: number;
  freq: number;
  width: number;
  gain: number; // Added for sensitivity control
}

export type RoutingType = 'off' | 'bpm' | 'sync1' | 'sync2' | 'sync3';

// FR-105: Support for Manual Resolution and Social Formats
export type AspectRatioMode = 'native' | 'fit' | '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | 'manual';

export interface TransformConfig {
  x: number;
  y: number;
  scale: number;
}

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

export interface MusicTrack {
  trackId: number;
  artistName: string;
  trackName: string;
  previewUrl: string;
  artworkUrl100: string;
}