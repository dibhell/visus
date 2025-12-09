import { GLSL_HEADER, SAFE_FX_SHADER, VERT_SRC } from '../constants';

export class GLService {
    gl: WebGLRenderingContext | null = null;
    program: WebGLProgram | null = null;
    tex: WebGLTexture | null = null;
    canvas: HTMLCanvasElement | null = null;
    uniformLocations: Record<string, WebGLUniformLocation | null> = {};
    attribLocations: Record<string, number> = {};
    private videoSize = { w: 0, h: 0 };
    lastShaderError: string | null = null;

    init(canvas: HTMLCanvasElement): boolean {
        if (this.canvas && this.gl && this.canvas === canvas) {
            return true;
        }
        if (this.canvas && this.canvas !== canvas) {
            console.warn('[VISUS] WebGL init blocked: renderer bound to a different canvas');
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
        const options: WebGLContextAttributes = { preserveDrawingBuffer: false, alpha: false, powerPreference: 'high-performance', antialias: false };
        try {
            this.gl = canvas.getContext("webgl2", options) as unknown as WebGLRenderingContext | null;
            console.info(this.gl ? "[VISUS] getContext('webgl2') ok" : "[VISUS] getContext('webgl2') returned null", { sizeInfo, twoDProbe });
            if (!this.gl) {
                this.gl = canvas.getContext("webgl", options);
                console.info(this.gl ? "[VISUS] getContext('webgl') ok" : "[VISUS] getContext('webgl') returned null", { sizeInfo, twoDProbe });
            }
        } catch (err) {
            console.error('[VISUS] WebGL init error (exception):', err);
            return false;
        }
        if (!this.gl) {
            console.warn('[VISUS] WebGL support: unavailable (getContext returned null)', 'canvas size:', sizeInfo, '2d probed:', twoDProbe);
            return false;
        }
        console.info('[VISUS] WebGL support: ok');
        console.info('[VISUS] init renderer');

        const b = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, b);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), this.gl.STATIC_DRAW);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
        
        this.tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return true;
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

        const buildProgram = (source: string) => {
            const vs = compile(this.gl!.VERTEX_SHADER, VERT_SRC, 'main');
            const fs = compile(this.gl!.FRAGMENT_SHADER, GLSL_HEADER + source, 'main');
            if (!vs || !fs) return null;
            const prog = this.gl!.createProgram();
            if (!prog) return null;
            this.gl!.attachShader(prog, vs);
            this.gl!.attachShader(prog, fs);
            this.gl!.linkProgram(prog);
            
            if (!this.gl!.getProgramParameter(prog, this.gl!.LINK_STATUS)) {
               const info = this.gl!.getProgramInfoLog(prog);
               this.lastShaderError = `main/LINK: ${info}`;
               console.error('[VISUS] shader link error (main):', info);
               return null;
            }
            return prog;
        };

        let prog = buildProgram(fragmentSrc);
        if (!prog) {
            console.warn('[VISUS] shader failure -> SAFE_FX_SHADER fallback');
            const safeProgBuilder = () => {
                const vs = compile(this.gl!.VERTEX_SHADER, VERT_SRC, 'safe');
                const fs = compile(this.gl!.FRAGMENT_SHADER, GLSL_HEADER + SAFE_FX_SHADER, 'safe');
                if (!vs || !fs) return null;
                const p = this.gl!.createProgram();
                if (!p) return null;
                this.gl!.attachShader(p, vs);
                this.gl!.attachShader(p, fs);
                this.gl!.linkProgram(p);
                if (!this.gl!.getProgramParameter(p, this.gl!.LINK_STATUS)) {
                    const info = this.gl!.getProgramInfoLog(p);
                    this.lastShaderError = `safe/LINK: ${info}`;
                    console.error('[VISUS] shader link error (safe):', info);
                    return null;
                }
                return p;
            };
            prog = safeProgBuilder();
        }
        if (!prog) {
            console.error('[VISUS] fallback Canvas2D required (shader init failed)');
            this.program = null;
            return false;
        }
        this.lastShaderError = null;

        this.program = prog;

        // Cache uniform and attribute locations for faster draw calls
        const uniformNames = [
            "iTime",
            "iResolution",
            "iVideoResolution",
            "iChannel0",
            "uMainFXGain",
            "uMainFX_ID",
            "uMainMix",
            "uAdditiveMasterGain",
            "uTranslate",
            "uScale",
            "uMirror",
            "uFX1",
            "uFX2",
            "uFX3",
            "uFX4",
            "uFX5",
            "uFX1Mix",
            "uFX2Mix",
            "uFX3Mix",
            "uFX4Mix",
            "uFX5Mix",
            "uFX1_ID",
            "uFX2_ID",
            "uFX3_ID",
            "uFX4_ID",
            "uFX5_ID",
        ];
        this.uniformLocations = {};
        uniformNames.forEach(name => {
            this.uniformLocations[name] = this.gl!.getUniformLocation(prog, name);
        });
        this.attribLocations = {
            position: this.gl.getAttribLocation(prog, "position"),
        };
        this.gl.useProgram(prog);
        const sampler = this.uniformLocations["iChannel0"];
        if (sampler) this.gl.uniform1i(sampler, 0);
        return true;
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 2) return;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;
        const needsResize = vw !== this.videoSize.w || vh !== this.videoSize.h;
        if (needsResize) {
            this.videoSize = { w: vw, h: vh };
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
        } else {
            this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
        }
    }

    draw(time: number, video: HTMLVideoElement, computedFx: any) {
        if (!this.program || !this.gl || !this.canvas) return;
        
        this.gl.useProgram(this.program);
        const u = (n: string) => this.uniformLocations[n];
        const set1f = (name: string, v: number) => {
            const loc = u(name);
            if (loc !== null && loc !== undefined) this.gl!.uniform1f(loc, v);
        };
        const set2f = (name: string, a: number, b: number) => {
            const loc = u(name);
            if (loc !== null && loc !== undefined) this.gl!.uniform2f(loc, a, b);
        };
        const set1i = (name: string, v: number) => {
            const loc = u(name);
            if (loc !== null && loc !== undefined) this.gl!.uniform1i(loc, v);
        };

        const posLoc = this.attribLocations["position"];
        if (posLoc >= 0) {
            this.gl.enableVertexAttribArray(posLoc);
            this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
        }

        set1f("iTime", time / 1000);
        set2f("iResolution", this.canvas.width, this.canvas.height);
        set2f("iVideoResolution", video?.videoWidth || 0, video?.videoHeight || 0);

        // Main Layer Controls (Layer 0)
        set1f("uMainFXGain", computedFx.mainFXGain);
        set1i("uMainFX_ID", computedFx.main_id);
        set1f("uMainMix", computedFx.mainMix || 1.0);
        
        // Additive Chain Controls (Layers 1-5)
        set1f("uAdditiveMasterGain", computedFx.additiveMasterGain);

        // Transforms & Mirror
        set2f("uTranslate", computedFx.transform.x, computedFx.transform.y);
        set1f("uScale", computedFx.transform.scale);
        set1f("uMirror", computedFx.isMirrored ? 1.0 : 0.0);

        // UFX - Levels
        set1f("uFX1", computedFx.fx1);
        set1f("uFX2", computedFx.fx2);
        set1f("uFX3", computedFx.fx3);
        set1f("uFX4", computedFx.fx4);
        set1f("uFX5", computedFx.fx5);
        set1f("uFX1Mix", computedFx.fx1Mix || 1.0);
        set1f("uFX2Mix", computedFx.fx2Mix || 1.0);
        set1f("uFX3Mix", computedFx.fx3Mix || 1.0);
        set1f("uFX4Mix", computedFx.fx4Mix || 1.0);
        set1f("uFX5Mix", computedFx.fx5Mix || 1.0);

        // UFX - IDs
        set1i("uFX1_ID", computedFx.fx1_id);
        set1i("uFX2_ID", computedFx.fx2_id);
        set1i("uFX3_ID", computedFx.fx3_id);
        set1i("uFX4_ID", computedFx.fx4_id);
        set1i("uFX5_ID", computedFx.fx5_id);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    resize(w: number, h: number) {
        if (!this.gl || !this.canvas) return;
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
    }
}
