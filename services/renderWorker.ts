// Render worker for ExperimentalApp using OffscreenCanvas and WebGL1
// Receives: init (canvas, fragSrc), loadShader(fragSrc), resize(w,h), frame(bitmap, time, fx, videoSize)

import { GLSL_HEADER, SAFE_FX_SHADER, VERT_SRC } from '../constants';

type FxPacket = any;

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let tex: WebGLTexture | null = null;
let canvas: OffscreenCanvas | null = null;
let uniformCache: Record<string, WebGLUniformLocation | null> = {};
let lastVideoSize = { w: 0, h: 0 };
let lastShaderError: string | null = null;
let fxGain = new Float32Array(6);
let fxMix = new Float32Array(6);
let fxId = new Int32Array(6);
let currentProgram: WebGLProgram | null = null;
let currentTexture: WebGLTexture | null = null;

const cacheUniforms = (names: string[]) => {
    if (!gl || !program) return;
    names.forEach((n) => {
        uniformCache[n] = gl!.getUniformLocation(program!, n);
    });
};

const compileShader = (type: number, source: string, label: 'main' | 'safe') => {
    if (!gl) return null;
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(sh);
        const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        const snippet = source.slice(0, 200);
        console.error(`[VISUS] shader compile error (${label}/${typeName}):`, info, 'src:', snippet);
        lastShaderError = `${label}/${typeName}: ${info}`;
        return null;
    }
    return sh;
};

const loadShader = (fragSrc: string) => {
    if (!gl) return false;
    const buildProgram = (src: string, label: 'main' | 'safe') => {
        const vs = compileShader(gl!.VERTEX_SHADER, VERT_SRC, label);
        const fs = compileShader(gl!.FRAGMENT_SHADER, GLSL_HEADER + src, label);
        if (!vs || !fs) return null;
        const prog = gl!.createProgram();
        if (!prog) return null;
        gl!.attachShader(prog, vs);
        gl!.attachShader(prog, fs);
        gl!.linkProgram(prog);
        if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
            console.error(`[VISUS] shader link error (${label}):`, gl!.getProgramInfoLog(prog));
            lastShaderError = `${label}/LINK: ${gl!.getProgramInfoLog(prog)}`;
            return null;
        }
        return prog;
    };

    let prog = buildProgram(fragSrc, 'main');
    if (!prog) {
        console.warn('[VISUS] shader failure -> SAFE_FX_SHADER fallback (worker)');
        prog = buildProgram(SAFE_FX_SHADER, 'safe');
    }
    if (!prog) {
        program = null;
        return false;
    }
    lastShaderError = null;

    program = prog;
    currentProgram = prog;
    gl.useProgram(program);

    uniformCache = {};
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    cacheUniforms([
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
    const sampler = gl.getUniformLocation(program, 'iChannel0');
    if (sampler) gl.uniform1i(sampler, 0);
    return true;
};

const initGL = (c: OffscreenCanvas) => {
    canvas = c;
    gl = canvas.getContext('webgl', { preserveDrawingBuffer: false, alpha: false });
    if (!gl) return false;
    lastVideoSize = { w: 0, h: 0 };
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
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
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

    if (currentProgram !== program) {
        gl.useProgram(program);
        currentProgram = program;
    }
    if (currentTexture !== tex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        currentTexture = tex;
    }
    const needsResize = videoSize.w !== lastVideoSize.w || videoSize.h !== lastVideoSize.h;
    if (needsResize) {
        lastVideoSize = videoSize;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    }

    gl.uniform1f(u['iTime']!, time / 1000);
    gl.uniform2f(u['iResolution']!, canvas.width, canvas.height);
    gl.uniform2f(u['iVideoResolution']!, videoSize.w, videoSize.h);

    fxGain[0] = fx.mainFXGain;
    fxMix[0] = fx.mainMix;
    fxId[0] = fx.main_id;
    fxGain[1] = fx.fx1;
    fxGain[2] = fx.fx2;
    fxGain[3] = fx.fx3;
    fxGain[4] = fx.fx4;
    fxGain[5] = fx.fx5;
    fxMix[1] = fx.fx1Mix;
    fxMix[2] = fx.fx2Mix;
    fxMix[3] = fx.fx3Mix;
    fxMix[4] = fx.fx4Mix;
    fxMix[5] = fx.fx5Mix;
    fxId[1] = fx.fx1_id;
    fxId[2] = fx.fx2_id;
    fxId[3] = fx.fx3_id;
    fxId[4] = fx.fx4_id;
    fxId[5] = fx.fx5_id;

    gl.uniform1fv(u['uFXGain']!, fxGain);
    gl.uniform1fv(u['uFXMix']!, fxMix);
    gl.uniform1iv(u['uFX_ID']!, fxId);
    gl.uniform1f(u['uAdditiveMasterGain']!, fx.additiveMasterGain);

    gl.uniform2f(u['uTranslate']!, fx.transform.x, fx.transform.y);
    gl.uniform1f(u['uScale']!, fx.transform.scale);
    gl.uniform1f(u['uMirror']!, fx.isMirrored ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
};

self.onmessage = (e: MessageEvent) => {
    const { type } = e.data;
    if (type === 'init') {
        const { canvas: c, fragSrc } = e.data;
        let success = false;
        let mode: 'webgl' | 'none' = 'none';
        if (initGL(c)) {
            success = loadShader(fragSrc);
            mode = success ? 'webgl' : 'none';
        }
        (self as any).postMessage({ type: 'init-result', success, mode, lastShaderError });
    } else if (type === 'loadShader') {
        if (!loadShader(e.data.fragSrc)) {
            console.warn('[VISUS] worker shader reload failed');
        }
    } else if (type === 'resize') {
        resize(e.data.width, e.data.height);
    } else if (type === 'frame') {
        const { bitmap, time, fx, videoSize } = e.data;
        drawFrame(bitmap, time, fx, videoSize);
        bitmap.close();
        (self as any).postMessage({ type: 'frame-done' });
    }
};
