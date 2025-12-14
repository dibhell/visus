export type RecordingPreset = {
    id: string;
    label: string;
    note: string;
    /**
     * If width/height are 0, the app treats the preset as AUTO and will resolve
     * the actual capture size at runtime (output canvas or video source).
     */
    width: number;
    height: number;
    fps: number;
    videoBitrate: number;
    audioBitrate: number;
    codecVideo: 'vp9' | 'vp8' | 'h264';
    codecAudio: 'opus';
    container: 'webm';
};

export type RecordingAudioPreset = {
    id: string;
    label: string;
    note: string;
    bitrate: number;
};

export const RECORDING_VIDEO_PRESETS: RecordingPreset[] = [
    {
        id: 'match_output',
        label: 'Match Output (AUTO)',
        note: 'Matches current output canvas size (what you see).',
        width: 0,
        height: 0,
        fps: 60,
        videoBitrate: 15_000_000,
        audioBitrate: 192_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: 'match_source',
        label: 'Match Source (AUTO)',
        note: 'Matches the intrinsic video source size (videoWidth/videoHeight) when available.',
        width: 0,
        height: 0,
        fps: 60,
        videoBitrate: 15_000_000,
        audioBitrate: 192_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: '4k_ultra',
        label: '4K Ultra',
        note: '30 fps cinematic',
        width: 3840,
        height: 2160,
        fps: 30,
        videoBitrate: 56_000_000,
        audioBitrate: 256_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: '4k_high',
        label: '4K High',
        note: '30 fps studio',
        width: 3840,
        height: 2160,
        fps: 30,
        videoBitrate: 48_000_000,
        audioBitrate: 256_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: '1080p_high',
        label: '1080p High',
        note: '60 fps action',
        width: 1920,
        height: 1080,
        fps: 60,
        videoBitrate: 15_000_000,
        audioBitrate: 192_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: '1080p_standard',
        label: '1080p Standard',
        note: '30 fps',
        width: 1920,
        height: 1080,
        fps: 30,
        videoBitrate: 10_000_000,
        audioBitrate: 128_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: '1080p_lite',
        label: '1080p Lite',
        note: 'web upload',
        width: 1920,
        height: 1080,
        fps: 30,
        videoBitrate: 8_000_000,
        audioBitrate: 128_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
    {
        id: '720p_stream',
        label: '720p Stream',
        note: 'bandwidth saver',
        width: 1280,
        height: 720,
        fps: 30,
        videoBitrate: 6_000_000,
        audioBitrate: 96_000,
        codecVideo: 'vp9',
        codecAudio: 'opus',
        container: 'webm',
    },
];

export const RECORDING_AUDIO_PRESETS: RecordingAudioPreset[] = [
    { id: 'audio_320', label: '320 kbps', note: 'HiFi music', bitrate: 320_000 },
    { id: 'audio_256', label: '256 kbps', note: 'High', bitrate: 256_000 },
    { id: 'audio_192', label: '192 kbps', note: 'Standard', bitrate: 192_000 },
    { id: 'audio_160', label: '160 kbps', note: 'Podcast+', bitrate: 160_000 },
    { id: 'audio_128', label: '128 kbps', note: 'Balanced', bitrate: 128_000 },
    { id: 'audio_64', label: '64 kbps', note: 'Voice only', bitrate: 64_000 },
];

// Default to AUTO so REC doesn't silently force 1920x1080.
export const DEFAULT_RECORDING_VIDEO_PRESET_ID = 'match_output';
export const DEFAULT_RECORDING_AUDIO_PRESET_ID = 'audio_192';
