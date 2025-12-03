// Render worker for ExperimentalApp using OffscreenCanvas and WebGL1
// Receives: init (canvas, fragSrc), loadShader(fragSrc), resize(w,h), frame(bitmap, time, fx, videoSize)

import { GLSL_HEADER, VERT_SRC } from '../constants';

type FxPacket = any;

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let tex: WebGLTexture | null = null;
let canvas: OffscreenCanvas | null = null;
let uniformCache: Record<string, WebGLUniformLocation | null> = {};
let programCache: Map<string, WebGLProgram> = new Map();

const cacheUniforms = (names: string[]) => {
    if (!gl || !program) return;
    uniformCache = {};
    names.forEach((n) => {
        uniformCache[n] = gl!.getUniformLocation(program!, n);
    });
};

const compileShader = (type: number, source: string) => {
    if (!gl) return null;
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(sh));
        return null;
    }
    return sh;
};

const loadShader = (fragSrc: string) => {
    if (!gl) return;

    const fallbackSrc = `void main(){ 
        vec2 uv = getUV(gl_FragCoord.xy);
        vec4 base = getVideo(uv);
        float keep = uMainFXGain + uMainMix + uAdditiveMasterGain + uFX1 + uFX2 + uFX3 + uFX4 + uFX5 + uFX1Mix + uFX2Mix + uFX3Mix + uFX4Mix + uFX5Mix + float(uMainFX_ID + uFX1_ID + uFX2_ID + uFX3_ID + uFX4_ID + uFX5_ID);
        keep += iTime * 0.0 + uTranslate.x * 0.0 + uTranslate.y * 0.0 + uScale * 0.0 + uMirror * 0.0;
        keep += iResolution.x * 0.0 + iResolution.y * 0.0 + iVideoResolution.x * 0.0 + iVideoResolution.y * 0.0;
        gl_FragColor = base + keep * 0.0;
    }`;

    const getOrCompile = (src: string) => {
        const cached = programCache.get(src);
        if (cached) return cached;
        const vs = compileShader(gl!.VERTEX_SHADER, VERT_SRC);
        const fs = compileShader(gl!.FRAGMENT_SHADER, GLSL_HEADER + src);
        if (!vs || !fs) return null;
        const prog = gl!.createProgram();
        if (!prog) return null;
        gl!.attachShader(prog, vs);
        gl!.attachShader(prog, fs);
        gl!.linkProgram(prog);
        if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
            console.error('Program link error for src len', src.length, gl!.getProgramInfoLog(prog) || '(empty log)');
            return null;
        }
        programCache.set(src, prog);
        return prog;
    };

    let prog = getOrCompile(fragSrc);
    if (!prog) {
        const fb = getOrCompile(fallbackSrc);
        if (!fb) return;
        prog = fb;
    }
    program = prog;
    gl.useProgram(program);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    cacheUniforms([
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
};

const warmShadersAsync = (sources: string[]) => {
    const unique = Array.from(new Set(sources));
    let idx = 0;
    const step = () => {
        if (!gl) return;
        const src = unique[idx];
        if (src && !programCache.has(src)) {
            loadShader(src);
        }
        idx += 1;
        if (idx < unique.length) setTimeout(step, 12);
    };
    setTimeout(step, 12);
};

const initGL = (c: OffscreenCanvas) => {
    canvas = c;
    gl = canvas.getContext('webgl', { preserveDrawingBuffer: false, alpha: false });
    if (!gl) return false;
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return true;
};

const resize = (w: number, h: number) => {
    if (!gl || !canvas) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
};

const drawFrame = (bitmap: ImageBitmap, time: number, fx: FxPacket, videoSize: { w: number; h: number }) => {
    if (!gl || !program || !canvas || !tex) return;
    const u = uniformCache;
    if (!u['iTime']) return;

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

    gl.uniform1f(u['iTime']!, time / 1000);
    gl.uniform2f(u['iResolution']!, canvas.width, canvas.height);
    gl.uniform2f(u['iVideoResolution']!, videoSize.w, videoSize.h);

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
};

self.onmessage = (e: MessageEvent) => {
    const { type } = e.data;
    if (type === 'init') {
        const { canvas: c, fragSrc } = e.data;
        if (initGL(c)) {
            loadShader(fragSrc);
        }
    } else if (type === 'loadShader') {
        loadShader(e.data.fragSrc);
    } else if (type === 'warmShaders') {
        warmShadersAsync(e.data.fragments || []);
    } else if (type === 'resize') {
        resize(e.data.width, e.data.height);
    } else if (type === 'frame') {
        const { bitmap, time, fx, videoSize } = e.data;
        drawFrame(bitmap, time, fx, videoSize);
        bitmap.close();
        (self as any).postMessage({ type: 'frame-done' });
    }
};
