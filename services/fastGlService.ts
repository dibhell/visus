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
    private isPassthrough = false;
    private useCanvas2D = false;
    private ctx2d: CanvasRenderingContext2D | null = null;
    private static FALLBACK_FRAG = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
void main() {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    gl_FragColor = texture2D(iChannel0, uv);
}`;
    // Reduced FX shader (safe subset) to avoid driver limits on large monolithic shader
    private static SAFE_FX_SHADER = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iVideoResolution;
uniform sampler2D iChannel0;
uniform vec2 uTranslate;
uniform float uScale;
uniform float uMirror;
uniform float uMainFXGain;
uniform int uMainFX_ID;
uniform float uMainMix;
uniform float uAdditiveMasterGain;
uniform float uFX1;
uniform float uFX2;
uniform float uFX3;
uniform float uFX4;
uniform float uFX5;
uniform float uFX1Mix;
uniform float uFX2Mix;
uniform float uFX3Mix;
uniform float uFX4Mix;
uniform float uFX5Mix;
uniform int uFX1_ID;
uniform int uFX2_ID;
uniform int uFX3_ID;
uniform int uFX4_ID;
uniform int uFX5_ID;

vec2 getUV(vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    if (uMirror > 0.5) uv.x = 1.0 - uv.x;
    if (iVideoResolution.x < 1.0) return uv;
    float sR = iResolution.x / iResolution.y;
    float vR = iVideoResolution.x / iVideoResolution.y;
    vec2 scale = vec2(1.0);
    vec2 offset = vec2(0.0);
    if (sR > vR) { scale.x = sR / vR; offset.x = (1.0 - scale.x) * 0.5; }
    else { scale.y = vR / sR; offset.y = (1.0 - scale.y) * 0.5; }
    vec2 correctedUV = (uv - offset) / scale;
    vec2 p = correctedUV - 0.5;
    p /= max(0.1, uScale);
    p -= uTranslate;
    return p + 0.5;
}
vec4 getVideo(vec2 uv) {
    vec2 p = abs(fract(uv * 0.5 + 0.5) * 2.0 - 1.0);
    p.y = 1.0 - p.y;
    if (iVideoResolution.x < 2.0) return vec4(0.0);
    return texture2D(iChannel0, p);
}
vec4 applyLayer(vec4 bg, vec2 uv, float amt, int id) {
    if (amt < 0.001 || id == 0) return bg;
    if (id == 1) { // RGB shift
        float off = amt * 0.05;
        float r = getVideo(uv + vec2(off, 0.0)).r;
        float b = getVideo(uv - vec2(off, 0.0)).b;
        return mix(bg, vec4(r, bg.g, b, 1.0), amt);
    } else if (id == 9) { // Scanlines
        float lines = sin(uv.y * 800.0) * 0.5 + 0.5;
        vec3 lined = bg.rgb * (1.0 - lines * clamp(amt, 0.0, 0.9));
        return vec4(lined, 1.0);
    } else if (id == 22) { // Fisheye
        vec2 p = uv * 2.0 - 1.0;
        float d = length(p);
        float bind = max(0.0, amt * 0.5);
        vec2 uv2 = uv + (p * pow(d, 2.0) * bind);
        vec4 fishCol = getVideo(uv2);
        fishCol.rgb *= 1.0 - (dot(p, p) * bind * 0.5);
        return mix(bg, fishCol, amt);
    } else if (id == 27) { // Halftone
        float freq = 80.0;
        vec2 nearest = 2.0 * fract(freq * uv) - 1.0;
        float dist = length(nearest);
        float gray = dot(bg.rgb, vec3(0.299, 0.587, 0.114));
        float radius = sqrt(gray) * 1.0;
        vec3 dotCol = vec3(step(dist, radius));
        return mix(bg, vec4(dotCol, 1.0), amt);
    } else if (id == 103) { // Color shift
        vec4 c = getVideo(uv);
        float hueShift = sin(iTime * 0.5) * amt * 2.0;
        c.rgb = mod(c.rgb + hueShift, 1.0);
        return mix(bg, c, amt);
    } else if (id == 112) { // ASCII matrix (lighter)
        float pixels = 80.0 - (amt * 40.0);
        vec2 blockUV = floor(uv * pixels) / pixels;
        vec4 c = getVideo(blockUV);
        float gray = dot(c.rgb, vec3(0.3));
        vec2 cellUV = fract(uv * pixels);
        float char = 0.0;
        float d = max(abs(cellUV.x-0.5), abs(cellUV.y-0.5));
        if (gray > 0.8) char = step(d, 0.4);
        else if (gray > 0.6) char = step(abs(cellUV.x-0.5), 0.1) + step(abs(cellUV.y-0.5), 0.1);
        else if (gray > 0.4) char = step(abs(cellUV.x-cellUV.y), 0.1);
        else if (gray > 0.2) char = step(length(cellUV-0.5), 0.2);
        char = clamp(char, 0.0, 1.0);
        vec3 matrixCol = vec3(0.2, 1.0, 0.4) * char;
        return mix(bg, vec4(matrixCol, 1.0), amt);
    }
    return bg;
}
vec4 applyAdditiveFX(vec4 baseCol, vec2 uv) {
    vec4 col = baseCol;
    vec4 p1 = applyLayer(col, uv, uFX1 * uAdditiveMasterGain, uFX1_ID);
    col = mix(col, p1, clamp(uFX1Mix, 0.0, 1.0));
    vec4 p2 = applyLayer(col, uv, uFX2 * uAdditiveMasterGain, uFX2_ID);
    col = mix(col, p2, clamp(uFX2Mix, 0.0, 1.0));
    vec4 p3 = applyLayer(col, uv, uFX3 * uAdditiveMasterGain, uFX3_ID);
    col = mix(col, p3, clamp(uFX3Mix, 0.0, 1.0));
    vec4 p4 = applyLayer(col, uv, uFX4 * uAdditiveMasterGain, uFX4_ID);
    col = mix(col, p4, clamp(uFX4Mix, 0.0, 1.0));
    vec4 p5 = applyLayer(col, uv, uFX5 * uAdditiveMasterGain, uFX5_ID);
    col = mix(col, p5, clamp(uFX5Mix, 0.0, 1.0));
    return col;
}
void main(){
    vec2 uv = getUV(gl_FragCoord.xy);
    vec4 base = getVideo(uv);
    vec4 processedMain = applyLayer(base, uv, uMainFXGain, uMainFX_ID);
    base = mix(base, processedMain, clamp(uMainMix, 0.0, 1.0));
    gl_FragColor = applyAdditiveFX(base, uv);
}`;
    private enableCanvasFallback() {
        if (!this.canvas) return;
        this.gl = null;
        this.program = null;
        this.tex = null;
        this.useCanvas2D = true;
        this.ctx2d = this.canvas.getContext('2d');
    }

    init(canvas: HTMLCanvasElement): boolean {
        this.canvas = canvas;
        // Try WebGL first
        this.gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: false,
            alpha: false,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            // Fallback to Canvas2D renderer (no FX) if WebGL is unavailable
            this.ctx2d = canvas.getContext('2d');
            this.useCanvas2D = !!this.ctx2d;
            return this.useCanvas2D;
        }

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

    loadShader(fragmentSrc: string, mode: 'normal' | 'passthrough' | 'safe' = 'normal') {
        if (this.useCanvas2D) return; // Already in canvas fallback, skip WebGL shaders
        if (!this.gl) {
            this.enableCanvasFallback();
            return;
        }
        if ((this.gl as any).isContextLost && (this.gl as any).isContextLost()) {
            this.enableCanvasFallback();
            return;
        }
        // Optional manual disable: ?fx=0 or localStorage visus_fx=off
        const disableFx = typeof location !== 'undefined' && (location.search.includes('fx=0') || localStorage.getItem('visus_fx') === 'off');
        if (disableFx && mode === 'normal') {
            console.warn('FX disabled by flag (?fx=0 or visus_fx=off); using passthrough shader.');
            this.loadShader(FastGLService.FALLBACK_FRAG, 'passthrough');
            return;
        }
        if (!fragmentSrc) {
            console.error('Shader source missing, using canvas fallback.');
            this.enableCanvasFallback();
            return;
        }
        this.isPassthrough = mode === 'passthrough';

        const compile = (type: number, source: string) => {
            if (!this.gl) return null;
            if ((this.gl as any).isContextLost && (this.gl as any).isContextLost()) {
                return null;
            }
            const sh = this.gl.createShader(type);
            if (!sh) return null;
            this.gl!.shaderSource(sh, source);
            this.gl!.compileShader(sh);
            if (!this.gl!.getShaderParameter(sh, this.gl!.COMPILE_STATUS)) {
                console.error('Shader compile error:', this.gl!.getShaderInfoLog(sh) || '(empty log)');
                return null;
            }
            return sh;
        };

        const prependHeader = mode === 'normal';
        const fsSource = prependHeader ? GLSL_HEADER + fragmentSrc : fragmentSrc;
        const vs = compile(this.gl!.VERTEX_SHADER, VERT_SRC);
        const fs = compile(this.gl!.FRAGMENT_SHADER, fsSource);
        if (!vs || !fs) {
            if (mode === 'normal') {
                console.warn('Falling back to safe FX shader (compile failed). Source length:', fsSource.length);
                this.loadShader(FastGLService.SAFE_FX_SHADER, 'safe');
            } else if (mode === 'safe') {
                console.warn('Safe FX shader failed; using passthrough.');
                this.loadShader(FastGLService.FALLBACK_FRAG, 'passthrough');
            } else {
                console.warn('Fallback passthrough shader failed; enabling Canvas2D fallback.');
                this.enableCanvasFallback();
            }
            return;
        }

        const prog = this.gl!.createProgram();
        if (!prog) return;

        this.gl!.attachShader(prog, vs);
        this.gl!.attachShader(prog, fs);
        this.gl!.linkProgram(prog);

        if (!this.gl!.getProgramParameter(prog, this.gl!.LINK_STATUS)) {
            console.error('Program link error', this.gl!.getProgramInfoLog(prog) || '');
            if (mode === 'normal') {
                console.warn('Falling back to safe FX shader (link failed).');
                this.loadShader(FastGLService.SAFE_FX_SHADER, 'safe');
            } else if (mode === 'safe') {
                console.warn('Safe FX shader failed; using passthrough.');
                this.loadShader(FastGLService.FALLBACK_FRAG, 'passthrough');
            } else {
                console.warn('Fallback passthrough shader failed; enabling Canvas2D fallback.');
                this.enableCanvasFallback();
            }
            return;
        }

        this.program = prog;
        if (!this.gl) {
            this.enableCanvasFallback();
            return;
        }
        const gl = this.gl;
        gl.useProgram(prog);

        const posLoc = gl.getAttribLocation(prog, 'position');
        this.positionLoc = posLoc;
        if (posLoc >= 0) {
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
        } else {
            this.enableCanvasFallback();
            return;
        }

        if (this.isPassthrough) {
            this.cacheUniforms(['iResolution', 'iChannel0']);
        } else {
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
        // Canvas2D fallback: draw video frame without FX
        if (this.useCanvas2D && this.ctx2d && this.canvas) {
            try {
                this.ctx2d.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
            } catch {}
            return;
        }

        if (!this.program || !this.gl || !this.canvas || !this.tex) return;
        if (this.positionLoc === null || this.positionLoc < 0) return;

        const gl = this.gl;
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        const u = this.uniformCache;

        // Passthrough mode: only resolution + sampler, no FX uniforms needed.
        if (this.isPassthrough) {
            if (u['iChannel0']) gl.uniform1i(u['iChannel0']!, 0);
            if (u['iResolution']) gl.uniform2f(u['iResolution']!, this.canvas.width, this.canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return;
        }

        const required = ['iTime', 'iResolution', 'iVideoResolution', 'uMainFXGain', 'uMainFX_ID', 'uMainMix', 'uAdditiveMasterGain', 'uTranslate', 'uScale', 'uMirror', 'uFX1', 'uFX2', 'uFX3', 'uFX4', 'uFX5', 'uFX1Mix', 'uFX2Mix', 'uFX3Mix', 'uFX4Mix', 'uFX5Mix', 'uFX1_ID', 'uFX2_ID', 'uFX3_ID', 'uFX4_ID', 'uFX5_ID'];
        if (required.some(name => !u[name])) return;
        if (u['iChannel0']) gl.uniform1i(u['iChannel0']!, 0);

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
