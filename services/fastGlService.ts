import { GLSL_HEADER, VERT_SRC, TransformConfig } from '../constants';

export interface ExperimentalFxPacket {
    mainFXGain: number;
    main_id: number;
    mainMix: number;
    additiveMasterGain: number;
    transform: TransformConfig;
    isMirrored: boolean;
    fx1: number;
    fx2: number;
    fx3: number;
    fx4: number;
    fx5: number;
    fx1_id: number;
    fx2_id: number;
    fx3_id: number;
    fx4_id: number;
    fx5_id: number;
    fx1Mix: number;
    fx2Mix: number;
    fx3Mix: number;
    fx4Mix: number;
    fx5Mix: number;
}

/**
 * FastGLService keeps uniform lookups cached and avoids unnecessary texture reallocations.
 * It is wired only to the experimental mode so the legacy path remains untouched.
 */
export class FastGLService {
    private gl: WebGLRenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private tex: WebGLTexture | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private uniformCache: Record<string, WebGLUniformLocation | null> = {};
    private positionLoc: number | null = null;
    private videoSize = { w: 0, h: 0 };
    private programCache: Map<string, WebGLProgram> = new Map();

    init(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: false,
            alpha: false,
            powerPreference: 'high-performance'
        });
        if (!this.gl) return false;

        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);

        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return true;
    }

    private cacheUniforms(names: string[]) {
        if (!this.gl || !this.program) return;
        this.uniformCache = {};
        names.forEach(name => {
            this.uniformCache[name] = this.gl!.getUniformLocation(this.program!, name);
        });
    }

    loadShader(fragmentSrc: string) {
        if (!this.gl) return;

        const fallbackSrc = `void main(){ 
            vec2 uv = getUV(gl_FragCoord.xy);
            vec4 base = getVideo(uv);
            float keep = uMainFXGain + uMainMix + uAdditiveMasterGain + uFX1 + uFX2 + uFX3 + uFX4 + uFX5 + uFX1Mix + uFX2Mix + uFX3Mix + uFX4Mix + uFX5Mix + float(uMainFX_ID + uFX1_ID + uFX2_ID + uFX3_ID + uFX4_ID + uFX5_ID);
            keep += iTime * 0.0 + uTranslate.x * 0.0 + uTranslate.y * 0.0 + uScale * 0.0 + uMirror * 0.0;
            keep += iResolution.x * 0.0 + iResolution.y * 0.0 + iVideoResolution.x * 0.0 + iVideoResolution.y * 0.0;
            gl_FragColor = base + keep * 0.0;
        }`;

        const getOrCompile = (src: string) => {
            const cached = this.programCache.get(src);
            if (cached) return cached;

            const compile = (type: number, source: string) => {
                const sh = this.gl!.createShader(type);
                if (!sh) return null;
                this.gl!.shaderSource(sh, source);
                this.gl!.compileShader(sh);
                if (!this.gl!.getShaderParameter(sh, this.gl!.COMPILE_STATUS)) {
                    console.error('Shader compile error:', this.gl!.getShaderInfoLog(sh));
                    return null;
                }
                return sh;
            };
    
            const vs = compile(this.gl!.VERTEX_SHADER, VERT_SRC);
            const fs = compile(this.gl!.FRAGMENT_SHADER, GLSL_HEADER + src);
            if (!vs || !fs) return null;
    
            const prog = this.gl!.createProgram();
            if (!prog) return null;
            this.gl!.attachShader(prog, vs);
            this.gl!.attachShader(prog, fs);
            this.gl!.linkProgram(prog);
    
            if (!this.gl!.getProgramParameter(prog, this.gl!.LINK_STATUS)) {
                console.error('Program link error');
                return null;
            }
            this.programCache.set(src, prog);
            return prog;
        };

        let prog = getOrCompile(fragmentSrc);
        if (!prog) {
            const fb = getOrCompile(fallbackSrc);
            if (!fb) return;
            prog = fb;
        }

        this.program = prog;
        this.gl.useProgram(prog);

        const posLoc = this.gl.getAttribLocation(prog, 'position');
        this.positionLoc = posLoc;
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.cacheUniforms([
            'iTime',
            'iResolution',
            'iVideoResolution',
            'uMainFXGain',
            'uMainFX_ID',
            'uMainMix',
            'uAdditiveMasterGain',
            'uTranslate',
            'uScale',
            'uMirror',
            'uFX1',
            'uFX2',
            'uFX3',
            'uFX4',
            'uFX5',
            'uFX1Mix',
            'uFX2Mix',
            'uFX3Mix',
            'uFX4Mix',
            'uFX5Mix',
            'uFX1_ID',
            'uFX2_ID',
            'uFX3_ID',
            'uFX4_ID',
            'uFX5_ID'
        ]);
    }

    warmAllShadersAsync(fragmentSources: string[]) {
        if (!this.gl) return;
        const unique = Array.from(new Set(fragmentSources));
        let idx = 0;
        const step = () => {
            if (!this.gl) return;
            const src = unique[idx];
            if (src && !this.programCache.has(src)) {
                this.loadShader(src);
            }
            idx += 1;
            if (idx < unique.length) setTimeout(step, 0);
        };
        setTimeout(step, 0);
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 2) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;
        const needsResize = vw !== this.videoSize.w || vh !== this.videoSize.h;
        if (needsResize) {
            this.videoSize = { w: vw, h: vh };
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
        }
    }

    draw(time: number, video: HTMLVideoElement, fx: ExperimentalFxPacket) {
        if (!this.program || !this.gl || !this.canvas || !this.tex) return;
        if (this.positionLoc === null || this.positionLoc < 0) return;

        const gl = this.gl;
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);

        const u = this.uniformCache;
        const required = ['iTime', 'iResolution', 'iVideoResolution', 'uMainFXGain', 'uMainFX_ID', 'uMainMix', 'uAdditiveMasterGain', 'uTranslate', 'uScale', 'uMirror', 'uFX1', 'uFX2', 'uFX3', 'uFX4', 'uFX5', 'uFX1Mix', 'uFX2Mix', 'uFX3Mix', 'uFX4Mix', 'uFX5Mix', 'uFX1_ID', 'uFX2_ID', 'uFX3_ID', 'uFX4_ID', 'uFX5_ID'];
        if (required.some(name => !u[name])) return;

        gl.uniform1f(u['iTime']!, time / 1000);
        gl.uniform2f(u['iResolution']!, this.canvas.width, this.canvas.height);
        gl.uniform2f(u['iVideoResolution']!, video?.videoWidth || 0, video?.videoHeight || 0);

        gl.uniform1f(u['uMainFXGain']!, fx.mainFXGain);
        gl.uniform1i(u['uMainFX_ID']!, fx.main_id);
        gl.uniform1f(u['uMainMix']!, fx.mainMix);
        gl.uniform1f(u['uAdditiveMasterGain']!, fx.additiveMasterGain);

        gl.uniform2f(u['uTranslate']!, fx.transform.x, fx.transform.y);
        gl.uniform1f(u['uScale']!, fx.transform.scale);
        gl.uniform1f(u['uMirror']!, fx.isMirrored ? 1.0 : 0.0);

        gl.uniform1f(u['uFX1']!, fx.fx1);
        gl.uniform1f(u['uFX2']!, fx.fx2);
        gl.uniform1f(u['uFX3']!, fx.fx3);
        gl.uniform1f(u['uFX4']!, fx.fx4);
        gl.uniform1f(u['uFX5']!, fx.fx5);
        gl.uniform1f(u['uFX1Mix']!, fx.fx1Mix);
        gl.uniform1f(u['uFX2Mix']!, fx.fx2Mix);
        gl.uniform1f(u['uFX3Mix']!, fx.fx3Mix);
        gl.uniform1f(u['uFX4Mix']!, fx.fx4Mix);
        gl.uniform1f(u['uFX5Mix']!, fx.fx5Mix);

        gl.uniform1i(u['uFX1_ID']!, fx.fx1_id);
        gl.uniform1i(u['uFX2_ID']!, fx.fx2_id);
        gl.uniform1i(u['uFX3_ID']!, fx.fx3_id);
        gl.uniform1i(u['uFX4_ID']!, fx.fx4_id);
        gl.uniform1i(u['uFX5_ID']!, fx.fx5_id);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    resize(w: number, h: number) {
        if (!this.gl || !this.canvas) return;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        this.gl.viewport(0, 0, w, h);
    }

    isReady() {
        return !!(this.gl && this.program && this.tex && this.canvas);
    }
}
