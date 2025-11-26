declare module '*?worker' {
    const WorkerFactory: { new(): Worker };
    export default WorkerFactory;
}

declare module '*.worker.ts' {
    const WorkerFactory: { new(): Worker };
    export default WorkerFactory;
}

// Minimal WebCodecs declarations (fallback if TS lib doesn't include dom.webcodecs)
interface VideoEncoderEncodeOptions { keyFrame?: boolean; }
type EncodedVideoChunkType = 'key' | 'delta';
interface EncodedVideoChunk {
    readonly type: EncodedVideoChunkType;
    readonly timestamp: number;
    readonly duration?: number;
    copyTo(destination: BufferSource): void;
    readonly byteLength: number;
}
interface EncodedVideoChunkMetadata {
    decoderConfig?: VideoDecoderConfig;
}
interface VideoEncoderInit {
    output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
    error: (error: DOMException) => void;
}
interface VideoEncoderConfig {
    codec: string;
    width: number;
    height: number;
    bitrate?: number;
    framerate?: number;
    hardwareAcceleration?: 'prefer-hardware' | 'prefer-software' | 'no-preference';
}
declare class VideoEncoder {
    static isConfigSupported(config: VideoEncoderConfig): Promise<{ supported: boolean }>;
    readonly state: 'unconfigured' | 'configured' | 'closed';
    constructor(init: VideoEncoderInit);
    configure(config: VideoEncoderConfig): void;
    encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
    flush(): Promise<void>;
    close(): void;
}
interface MediaStreamTrackProcessorInit {
    track: MediaStreamTrack;
}
declare class MediaStreamTrackProcessor<T = VideoFrame> {
    readonly readable: ReadableStream<T>;
    constructor(init: MediaStreamTrackProcessorInit);
}
