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
    // Optional flags allow the caller to note worker usage intent (for debug toggles).
    // They are currently informational only.
    constructor(config?: { noWorker?: boolean }) {
        void config;
    }
    private gl: WebGLRenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private copyProgram: WebGLProgram | null = null;
    private tex: WebGLTexture | null = null;
    private positionBuffer: WebGLBuffer | null = null;
    private feedbackTexture: WebGLTexture | null = null;
    private outputTexture: WebGLTexture | null = null;
    private framebuffer: WebGLFramebuffer | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private uniformCache: Record<string, WebGLUniformLocation | null> = {};
    private copyUniformCache: Record<string, WebGLUniformLocation | null> = {};
    private positionLoc: number | null = null;
    private copyPositionLoc: number | null = null;
    private videoSize = { w: 0, h: 0 };
    private feedbackSize = { w: 0, h: 0 };
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
        const twoDProbe = false;
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
        this.positionBuffer = b;
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
        this.feedbackTexture = this.createTexture(1, 1);
        this.outputTexture = this.createTexture(1, 1);
        this.framebuffer = gl.createFramebuffer();
        this.copyProgram = this.createCopyProgram();
        return true;
    }

    private createTexture(w: number, h: number): WebGLTexture | null {
        if (!this.gl) return null;
        const gl = this.gl;
        const texture = gl.createTexture();
        if (!texture) return null;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, w), Math.max(1, h), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        return texture;
    }

    private resizeTexture(texture: WebGLTexture | null, w: number, h: number) {
        if (!this.gl || !texture) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, w), Math.max(1, h), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    private ensureFeedbackTarget(w: number, h: number) {
        if (!this.gl || !this.feedbackTexture || !this.outputTexture) return;
        if (this.feedbackSize.w === w && this.feedbackSize.h === h) return;
        this.feedbackSize = { w, h };
        this.resizeTexture(this.feedbackTexture, w, h);
        this.resizeTexture(this.outputTexture, w, h);
    }

    private createCopyProgram(): WebGLProgram | null {
        if (!this.gl) return null;
        const gl = this.gl;
        const frag = `
            precision mediump float;
            uniform sampler2D uCopyTex;
            uniform vec2 uCopyResolution;
            void main() {
                vec2 uv = gl_FragCoord.xy / max(uCopyResolution, vec2(1.0));
                gl_FragColor = texture2D(uCopyTex, uv);
            }
        `;
        const compile = (type: number, source: string) => {
            const sh = gl.createShader(type);
            if (!sh) return null;
            gl.shaderSource(sh, source);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                console.error('[VISUS] copy shader compile error:', gl.getShaderInfoLog(sh));
                return null;
            }
            return sh;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
        const fs = compile(gl.FRAGMENT_SHADER, frag);
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        if (!prog) return null;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('[VISUS] copy shader link error:', gl.getProgramInfoLog(prog));
            return null;
        }
        this.copyPositionLoc = gl.getAttribLocation(prog, 'position');
        this.copyUniformCache = {
            uCopyTex: gl.getUniformLocation(prog, 'uCopyTex'),
            uCopyResolution: gl.getUniformLocation(prog, 'uCopyResolution')
        };
        return prog;
    }

    private bindPosition(loc: number | null) {
        if (!this.gl || !this.positionBuffer || loc === null || loc < 0) return false;
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        return true;
    }
    private cacheUniforms(names: string[]) {
        if (!this.gl || !this.program) return;
        names.forEach(name => {
            this.uniformCache[name] =
                this.gl!.getUniformLocation(this.program!, name) ||
                this.gl!.getUniformLocation(this.program!, `${name}[0]`);
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
        this.bindPosition(posLoc);

        this.cacheUniforms([
            'iTime',
            'iResolution',
            'iVideoResolution',
            'iChannel0',
            'iFrame1',
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
        const feedbackSampler = this.gl.getUniformLocation(prog, 'iFrame1');
        if (feedbackSampler) this.gl.uniform1i(feedbackSampler, 1);
        return true;
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 2) return;
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
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
        const dpr = window.devicePixelRatio || 1;
        const cssW = this.canvas.clientWidth || this.canvas.getBoundingClientRect().width || this.canvas.width;
        const cssH = this.canvas.clientHeight || this.canvas.getBoundingClientRect().height || this.canvas.height;
        const targetW = Math.max(4, Math.round(cssW * dpr));
        const targetH = Math.max(4, Math.round(cssH * dpr));
        if (targetW !== this.canvas.width || targetH !== this.canvas.height) {
            this.resize(targetW, targetH);
        }
        if (this.currentProgram !== this.program) {
            gl.useProgram(this.program);
            this.currentProgram = this.program;
        }
        if (!this.bindPosition(this.positionLoc)) return;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        this.currentTexture = this.tex;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.feedbackTexture);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const u = this.uniformCache;
        const required = ['iTime', 'iResolution', 'iVideoResolution', 'iChannel0', 'uFXGain', 'uFXMix', 'uFX_ID', 'uAdditiveMasterGain', 'uTranslate', 'uScale', 'uMirror'];
        if (required.some(name => !u[name])) return;
        const needsFeedback = fx.main_id === 140 || fx.fx1_id === 140 || fx.fx2_id === 140 || fx.fx3_id === 140 || fx.fx4_id === 140 || fx.fx5_id === 140;
        const feedbackReady = needsFeedback && !!(this.copyProgram && this.framebuffer && this.feedbackTexture && this.outputTexture);
        if (feedbackReady) {
            this.ensureFeedbackTarget(this.canvas.width, this.canvas.height);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.feedbackTexture);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, null);
        if (feedbackReady) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTexture, 0);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.uniform1f(u['iTime']!, time / 1000);
        gl.uniform2f(u['iResolution']!, this.canvas.width, this.canvas.height);
        gl.uniform2f(u['iVideoResolution']!, this.videoSize.w || video?.videoWidth || 0, this.videoSize.h || video?.videoHeight || 0);

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

        if (feedbackReady) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.useProgram(this.copyProgram);
            this.currentProgram = this.copyProgram;
            if (!this.bindPosition(this.copyPositionLoc)) return;
            const cu = this.copyUniformCache;
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
            if (cu.uCopyTex) gl.uniform1i(cu.uCopyTex, 2);
            if (cu.uCopyResolution) gl.uniform2f(cu.uCopyResolution, this.canvas.width, this.canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            const prev = this.feedbackTexture;
            this.feedbackTexture = this.outputTexture;
            this.outputTexture = prev;
            this.currentTexture = null;
        }
    }

    resize(w: number, h: number) {
        if (!this.gl || !this.canvas) return;
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        this.gl.viewport(0, 0, w, h);
        this.ensureFeedbackTarget(w, h);
    }

    isReady() {
        return !!(this.gl && this.program && this.tex && this.canvas);
    }
}
