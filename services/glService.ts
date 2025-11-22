import { GLSL_HEADER, VERT_SRC } from '../constants';

export class GLService {
    gl: WebGLRenderingContext | null = null;
    program: WebGLProgram | null = null;
    tex: WebGLTexture | null = null;
    canvas: HTMLCanvasElement | null = null;

    init(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { preserveDrawingBuffer: false, alpha: false });
        if (!this.gl) return false;

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
    }

    updateTexture(video: HTMLVideoElement) {
        if (!this.gl || !this.tex || !video || video.readyState < 2) return;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video);
    }

    draw(time: number, video: HTMLVideoElement, computedFx: any) {
        if (!this.program || !this.gl || !this.canvas) return;
        
        this.gl.useProgram(this.program);
        const u = (n: string) => this.gl!.getUniformLocation(this.program!, n);

        const posLoc = this.gl.getAttribLocation(this.program, "position");
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.uniform1f(u("iTime"), time / 1000);
        this.gl.uniform2f(u("iResolution"), this.canvas.width, this.canvas.height);
        this.gl.uniform2f(u("iVideoResolution"), video?.videoWidth || 0, video?.videoHeight || 0);

        // Main Layer Controls (Layer 0)
        this.gl.uniform1f(u("uMainFXGain"), computedFx.mainFXGain);
        this.gl.uniform1i(u("uMainFX_ID"), computedFx.main_id);
        
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

        // UFX - IDs
        this.gl.uniform1i(u("uFX1_ID"), computedFx.fx1_id);
        this.gl.uniform1i(u("uFX2_ID"), computedFx.fx2_id);
        this.gl.uniform1i(u("uFX3_ID"), computedFx.fx3_id);
        this.gl.uniform1i(u("uFX4_ID"), computedFx.fx4_id);
        this.gl.uniform1i(u("uFX5_ID"), computedFx.fx5_id);

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