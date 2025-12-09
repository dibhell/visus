import { GLSL_HEADER, SAFE_FX_SHADER, VERT_SRC, TransformConfig } from '../constants';

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
    private fxGain = new Float32Array(6);
    private fxMix = new Float32Array(6);
    private fxId = new Int32Array(6);
    private currentProgram: WebGLProgram | null = null;
    private currentTexture: WebGLTexture | null = null;
    lastShaderError: string | null = null;

    init(canvas: HTMLCanvasElement): boolean {
        if (this.canvas && this.gl && this.canvas === canvas) {
            return true;
        }
        if (this.canvas && this.canvas !== canvas) {
            console.warn('[VISUS] WebGL init blocked: renderer already bound to another canvas');
            return false;
        }
        this.canvas = canvas;
        this.videoSize = { w: 0, h: 0 };
        const sizeInfo = { w: canvas.width, h: canvas.height };
        let twoDProbe = false;
        try {
            twoDProbe = !!canvas.getContext('2d', { willReadFrequently: false } as any);
        } catch (err) {
            console.warn('[VISUS] 2d probe exception (ignored):', err);
        }
        const options: WebGLContextAttributes = {
            preserveDrawingBuffer: false,
            alpha: false,
            powerPreference: 'high-performance'
        };
        let glCtx: WebGLRenderingContext | null = null;
        try {
            glCtx = (canvas.getContext('webgl2', options) as unknown as WebGLRenderingContext | null);
            console.info(glCtx ? "[VISUS] getContext('webgl2') ok" : "[VISUS] getContext('webgl2') returned null", { sizeInfo, twoDProbe });
            if (!glCtx) {
                glCtx = canvas.getContext('webgl', options);
                console.info(glCtx ? "[VISUS] getContext('webgl') ok" : "[VISUS] getContext('webgl') returned null", { sizeInfo, twoDProbe });
            }
        } catch (err) {
            console.error('[VISUS] WebGL init error (exception):', err);
            return false;
        }
        this.gl = glCtx;
        if (!this.gl) {
            console.warn('[VISUS] WebGL support: unavailable (getContext returned null)', 'canvas size:', sizeInfo, '2d probed:', twoDProbe);
            return false;
        }
        console.info('[VISUS] WebGL support: ok');
        console.info('[VISUS] init renderer');

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
        names.forEach(name => {
            this.uniformCache[name] = this.gl!.getUniformLocation(this.program!, name);
        });
    }

    loadShader(fragmentSrc: string): boolean {
        if (!this.gl) return false;

        const compile = (type: number, source: string, label: 'main' | 'safe') => {
            const sh = this.gl!.createShader(type);
            if (!sh) return null;
            this.gl!.shaderSource(sh, source);
            this.gl!.compileShader(sh);
            if (!this.gl!.getShaderParameter(sh, this.gl!.COMPILE_STATUS)) {
                const info = this.gl!.getShaderInfoLog(sh);
                const typeName = type === this.gl!.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
                const snippet = source.slice(0, 200);
                this.lastShaderError = `${label}/${typeName}: ${info}`;
                console.error(`[VISUS] shader compile error (${label}/${typeName}):`, info, 'src:', snippet);
                return null;
            }
            return sh;
        };

        const buildProgram = (src: string, label: 'main' | 'safe') => {
            const vs = compile(this.gl!.VERTEX_SHADER, VERT_SRC, label);
            const fs = compile(this.gl!.FRAGMENT_SHADER, GLSL_HEADER + src, label);
            if (!vs || !fs) return null;

            const prog = this.gl!.createProgram();
            if (!prog) return null;

            this.gl!.attachShader(prog, vs);
            this.gl!.attachShader(prog, fs);
            this.gl!.linkProgram(prog);

            if (!this.gl!.getProgramParameter(prog, this.gl!.LINK_STATUS)) {
                const info = this.gl!.getProgramInfoLog(prog);
                this.lastShaderError = `${label}/LINK: ${info}`;
                console.error(`[VISUS] shader link error (${label}):`, info);
                return null;
            }
            return prog;
        };

        let prog = buildProgram(fragmentSrc, 'main');
        if (!prog) {
            console.warn('[VISUS] shader failure -> SAFE_FX_SHADER fallback');
            prog = buildProgram(SAFE_FX_SHADER, 'safe');
        }

        if (!prog) {
            console.error('[VISUS] fallback Canvas2D required (shader init failed)');
            this.program = null;
            return false;
        }

        this.lastShaderError = null;
        this.program = prog;
        this.currentProgram = prog;
        this.gl.useProgram(prog);
        this.uniformCache = {};

        const posLoc = this.gl.getAttribLocation(prog, 'position');
        this.positionLoc = posLoc;
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.cacheUniforms([
            'iTime',
            'iResolution',
            'iVideoResolution',
            'iChannel0',
            'uFXGain',
            'uFXMix',
            'uFX_ID',
            'uAdditiveMasterGain',
            'uTranslate',
            'uScale',
            'uMirror'
        ]);
        const sampler = this.gl.getUniformLocation(prog, 'iChannel0');
        if (sampler) this.gl.uniform1i(sampler, 0);
        return true;
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
        if (this.currentProgram !== this.program) {
            gl.useProgram(this.program);
            this.currentProgram = this.program;
        }
        if (this.currentTexture !== this.tex) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.tex);
            this.currentTexture = this.tex;
        }

        const u = this.uniformCache;
        const required = ['iTime', 'iResolution', 'iVideoResolution', 'iChannel0', 'uFXGain', 'uFXMix', 'uFX_ID', 'uAdditiveMasterGain', 'uTranslate', 'uScale', 'uMirror'];
        if (required.some(name => !u[name])) return;

        gl.uniform1f(u['iTime']!, time / 1000);
        gl.uniform2f(u['iResolution']!, this.canvas.width, this.canvas.height);
        gl.uniform2f(u['iVideoResolution']!, video?.videoWidth || 0, video?.videoHeight || 0);

        this.fxGain[0] = fx.mainFXGain;
        this.fxMix[0] = fx.mainMix;
        this.fxId[0] = fx.main_id;
        this.fxGain[1] = fx.fx1;
        this.fxGain[2] = fx.fx2;
        this.fxGain[3] = fx.fx3;
        this.fxGain[4] = fx.fx4;
        this.fxGain[5] = fx.fx5;
        this.fxMix[1] = fx.fx1Mix;
        this.fxMix[2] = fx.fx2Mix;
        this.fxMix[3] = fx.fx3Mix;
        this.fxMix[4] = fx.fx4Mix;
        this.fxMix[5] = fx.fx5Mix;
        this.fxId[1] = fx.fx1_id;
        this.fxId[2] = fx.fx2_id;
        this.fxId[3] = fx.fx3_id;
        this.fxId[4] = fx.fx4_id;
        this.fxId[5] = fx.fx5_id;

        gl.uniform1fv(u['uFXGain']!, this.fxGain);
        gl.uniform1fv(u['uFXMix']!, this.fxMix);
        gl.uniform1iv(u['uFX_ID']!, this.fxId);
        gl.uniform1f(u['uAdditiveMasterGain']!, fx.additiveMasterGain);

        gl.uniform2f(u['uTranslate']!, fx.transform.x, fx.transform.y);
        gl.uniform1f(u['uScale']!, fx.transform.scale);
        gl.uniform1f(u['uMirror']!, fx.isMirrored ? 1.0 : 0.0);

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
