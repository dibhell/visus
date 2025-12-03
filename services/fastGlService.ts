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

    loadShader(fragmentSrc: string, label?: string) {
        if (!this.gl) return;
        if ((this.gl as any).isContextLost && (this.gl as any).isContextLost()) return;

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
                console.error('Shader compile error:', label || '', this.gl!.getShaderInfoLog(sh) || '(empty log)');
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
                console.error('Program link error', label || '', this.gl!.getProgramInfoLog(prog) || '(empty log)');
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
            'iChannel0',
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

    warmAllShadersAsync(fragmentSources: { label?: string; src: string; }[]) {
        if (!this.gl) return;
        const unique = Array.from(new Set(fragmentSources));
        let idx = 0;
        const step = () => {
            if (!this.gl) return;
            if ((this.gl as any).isContextLost && (this.gl as any).isContextLost()) return;
            const item = unique[idx];
            const src = (item as any)?.src || (item as any);
            const lbl = (item as any)?.label;
            if (src && !this.programCache.has(src)) {
                this.loadShader(src, lbl);
            }
            idx += 1;
            if (idx < unique.length) setTimeout(step, 25);
        };
        setTimeout(step, 25);
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 1) return;
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
        if (video && video.videoWidth > 1 && video.videoHeight > 1) {
            const needsResize = (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight);
            if (needsResize) this.resize(video.videoWidth, video.videoHeight);
        }

        const gl = this.gl;
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);

        const u = this.uniformCache;
        const set1f = (name: string, val: number) => { const loc = u[name]; if (loc) gl.uniform1f(loc, val); };
        const set2f = (name: string, v1: number, v2: number) => { const loc = u[name]; if (loc) gl.uniform2f(loc, v1, v2); };
        const set1i = (name: string, val: number) => { const loc = u[name]; if (loc) gl.uniform1i(loc, val); };

        const vReady = video && video.readyState >= 1;
        const vW = vReady ? (video?.videoWidth || 0) : 0;
        const vH = vReady ? (video?.videoHeight || 0) : 0;

        set1f('iTime', time / 1000);
        set2f('iResolution', this.canvas.width, this.canvas.height);
        set2f('iVideoResolution', vW, vH);
        set1i('iChannel0', 0); // bind sampler to texture unit 0

        set1f('uMainFXGain', fx.mainFXGain);
        set1i('uMainFX_ID', fx.main_id);
        set1f('uMainMix', fx.mainMix);
        set1f('uAdditiveMasterGain', fx.additiveMasterGain);

        set2f('uTranslate', fx.transform.x, fx.transform.y);
        set1f('uScale', fx.transform.scale);
        set1f('uMirror', fx.isMirrored ? 1.0 : 0.0);

        set1f('uFX1', fx.fx1);
        set1f('uFX2', fx.fx2);
        set1f('uFX3', fx.fx3);
        set1f('uFX4', fx.fx4);
        set1f('uFX5', fx.fx5);
        set1f('uFX1Mix', fx.fx1Mix);
        set1f('uFX2Mix', fx.fx2Mix);
        set1f('uFX3Mix', fx.fx3Mix);
        set1f('uFX4Mix', fx.fx4Mix);
        set1f('uFX5Mix', fx.fx5Mix);

        set1i('uFX1_ID', fx.fx1_id);
        set1i('uFX2_ID', fx.fx2_id);
        set1i('uFX3_ID', fx.fx3_id);
        set1i('uFX4_ID', fx.fx4_id);
        set1i('uFX5_ID', fx.fx5_id);

        gl.clearColor(1.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
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
