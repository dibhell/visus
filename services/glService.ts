import { GLSL_HEADER, VERT_SRC } from '../constants';

export class GLService {
    gl: WebGLRenderingContext | null = null;
    program: WebGLProgram | null = null;
    tex: WebGLTexture | null = null;
    canvas: HTMLCanvasElement | null = null;
    uniformLocations: Record<string, WebGLUniformLocation | null> = {};
    attribLocations: Record<string, number> = {};

    init(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { preserveDrawingBuffer: false, alpha: false, powerPreference: 'high-performance', antialias: false });
        if (!this.gl) return false;

        const b = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, b);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), this.gl.STATIC_DRAW);
        
        this.tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return true;
    }

    loadShader(fragmentSrc: string) {
        if (!this.gl) return;
        
        const compile = (type: number, source: string) => {
            const sh = this.gl!.createShader(type);
            if (!sh) return null;
            this.gl!.shaderSource(sh, source);
            this.gl!.compileShader(sh);
            if (!this.gl!.getShaderParameter(sh, this.gl!.COMPILE_STATUS)) {
                console.error("Shader compile error:", this.gl!.getShaderInfoLog(sh));
                return null;
            }
            return sh;
        };

        const vs = compile(this.gl.VERTEX_SHADER, VERT_SRC);
        const fs = compile(this.gl.FRAGMENT_SHADER, GLSL_HEADER + fragmentSrc);

        if (!vs || !fs) return;

        const prog = this.gl.createProgram();
        if (!prog) return;

        this.gl.attachShader(prog, vs);
        this.gl.attachShader(prog, fs);
        this.gl.linkProgram(prog);
        
        if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
           console.error("Program link error");
           return;
        }

        this.program = prog;

        // Cache uniform and attribute locations for faster draw calls
        const uniformNames = [
            "iTime",
            "iResolution",
            "iVideoResolution",
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
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 2) return;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
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
