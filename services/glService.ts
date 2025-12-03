import { GLSL_HEADER, VERT_SRC } from '../constants';

export class GLService {
    gl: WebGLRenderingContext | null = null;
    program: WebGLProgram | null = null;
    tex: WebGLTexture | null = null;
    canvas: HTMLCanvasElement | null = null;
    private programCache: Map<string, WebGLProgram> = new Map();

    init(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { preserveDrawingBuffer: false, alpha: false, powerPreference: 'high-performance', antialias: false });
        if (!this.gl) return false;

        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);

        const b = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, b);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), this.gl.STATIC_DRAW);
        
        this.tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return true;
    }

    loadShader(fragmentSrc: string, label?: string) {
        if (!this.gl) return;
        if ((this.gl as any).isContextLost && (this.gl as any).isContextLost()) return;

        const fallbackSrc = `void main(){ 
            vec2 uv = gl_FragCoord.xy / iResolution; 
            vec4 base = texture2D(iChannel0, uv); 
            float keep = uMainFXGain + uMainMix + uAdditiveMasterGain + uFX1 + uFX2 + uFX3 + uFX4 + uFX5 + uFX1Mix + uFX2Mix + uFX3Mix + uFX4Mix + uFX5Mix + float(uMainFX_ID + uFX1_ID + uFX2_ID + uFX3_ID + uFX4_ID + uFX5_ID); 
            keep += iTime * 0.0 + uTranslate.x * 0.0 + uTranslate.y * 0.0 + uScale * 0.0 + uMirror * 0.0;
            keep += iResolution.x * 0.0 + iResolution.y * 0.0 + iVideoResolution.x * 0.0 + iVideoResolution.y * 0.0;
            gl_FragColor = base + keep * 0.0; 
        }`;

        const compile = (type: number, source: string) => {
            const sh = this.gl!.createShader(type);
            if (!sh) return null;
            this.gl!.shaderSource(sh, source);
            this.gl!.compileShader(sh);
            if (!this.gl!.getShaderParameter(sh, this.gl!.COMPILE_STATUS)) {
                console.error("Shader compile error:", label || '', this.gl!.getShaderInfoLog(sh) || "(empty log)");
                return null;
            }
            return sh;
        };

        const getOrCompile = (src: string) => {
            const cached = this.programCache.get(src);
            if (cached) return cached;

            const vs = compile(this.gl!.VERTEX_SHADER, VERT_SRC);
            const fs = compile(this.gl!.FRAGMENT_SHADER, GLSL_HEADER + src);
            if (!vs || !fs) return null;

            const prog = this.gl!.createProgram();
            if (!prog) return null;
            this.gl!.attachShader(prog, vs);
            this.gl!.attachShader(prog, fs);
            this.gl!.linkProgram(prog);
            if (!this.gl!.getProgramParameter(prog, this.gl!.LINK_STATUS)) {
               console.error("Program link error", label || '', this.gl!.getProgramInfoLog(prog) || "(empty log)");
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
                this.loadShader(src, lbl); // uses cache
            }
            idx += 1;
            if (idx < unique.length) setTimeout(step, 25);
        };
        setTimeout(step, 25);
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 2) return;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
    }

    draw(time: number, video: HTMLVideoElement, computedFx: any) {
        if (!this.program || !this.gl || !this.canvas) return;
        if (!video || video.readyState < 2 || video.videoWidth < 2 || video.videoHeight < 2) {
            this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            return;
        }
        
        this.gl.useProgram(this.program);
        const u = (n: string) => this.gl!.getUniformLocation(this.program!, n);

        const posLoc = this.gl.getAttribLocation(this.program, "position");
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.uniform1f(u("iTime"), time / 1000);
        this.gl.uniform2f(u("iResolution"), this.canvas.width, this.canvas.height);
        this.gl.uniform2f(u("iVideoResolution"), video?.videoWidth || 0, video?.videoHeight || 0);
        const ch0 = u("iChannel0");
        if (ch0 !== null) this.gl.uniform1i(ch0, 0);

        // Main Layer Controls (Layer 0)
        this.gl.uniform1f(u("uMainFXGain"), computedFx.mainFXGain);
        this.gl.uniform1i(u("uMainFX_ID"), computedFx.main_id);
        this.gl.uniform1f(u("uMainMix"), computedFx.mainMix || 1.0);
        
        // Additive Chain Controls (Layers 1-5)
        this.gl.uniform1f(u("uAdditiveMasterGain"), computedFx.additiveMasterGain);

        // Transforms & Mirror
        this.gl.uniform2f(u("uTranslate"), computedFx.transform.x, computedFx.transform.y);
        this.gl.uniform1f(u("uScale"), computedFx.transform.scale);
        this.gl.uniform1f(u("uMirror"), computedFx.isMirrored ? 1.0 : 0.0);

        // UFX - Levels
        this.gl.uniform1f(u("uFX1"), computedFx.fx1);
        this.gl.uniform1f(u("uFX2"), computedFx.fx2);
        this.gl.uniform1f(u("uFX3"), computedFx.fx3);
        this.gl.uniform1f(u("uFX4"), computedFx.fx4);
        this.gl.uniform1f(u("uFX5"), computedFx.fx5);
        this.gl.uniform1f(u("uFX1Mix"), computedFx.fx1Mix || 1.0);
        this.gl.uniform1f(u("uFX2Mix"), computedFx.fx2Mix || 1.0);
        this.gl.uniform1f(u("uFX3Mix"), computedFx.fx3Mix || 1.0);
        this.gl.uniform1f(u("uFX4Mix"), computedFx.fx4Mix || 1.0);
        this.gl.uniform1f(u("uFX5Mix"), computedFx.fx5Mix || 1.0);

        // UFX - IDs
        this.gl.uniform1i(u("uFX1_ID"), computedFx.fx1_id);
        this.gl.uniform1i(u("uFX2_ID"), computedFx.fx2_id);
        this.gl.uniform1i(u("uFX3_ID"), computedFx.fx3_id);
        this.gl.uniform1i(u("uFX4_ID"), computedFx.fx4_id);
        this.gl.uniform1i(u("uFX5_ID"), computedFx.fx5_id);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    resize(w: number, h: number) {
        if (!this.gl || !this.canvas) return;
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
    }
}
