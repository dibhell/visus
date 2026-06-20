// Render worker for ExperimentalApp using OffscreenCanvas and WebGL1
// Receives: init (canvas, fragSrc), loadShader(fragSrc), resize(w,h), frame(bitmap, time, fx, videoSize)

import { GLSL_HEADER, SAFE_FX_SHADER, VERT_SRC } from '../constants';

type FxPacket = any;

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let copyProgram: WebGLProgram | null = null;
let tex: WebGLTexture | null = null;
let positionBuffer: WebGLBuffer | null = null;
let feedbackTexture: WebGLTexture | null = null;
let outputTexture: WebGLTexture | null = null;
let framebuffer: WebGLFramebuffer | null = null;
let canvas: OffscreenCanvas | null = null;
let uniformCache: Record<string, WebGLUniformLocation | null> = {};
let copyUniformCache: Record<string, WebGLUniformLocation | null> = {};
let lastVideoSize = { w: 0, h: 0 };
let feedbackSize = { w: 0, h: 0 };
let lastShaderError: string | null = null;
let fxGain = new Float32Array(6);
let fxMix = new Float32Array(6);
let fxId = new Int32Array(6);
let currentProgram: WebGLProgram | null = null;
let currentTexture: WebGLTexture | null = null;
let copyPositionLoc: number | null = null;

const bindPosition = (loc: number | null) => {
    if (!gl || !positionBuffer || loc === null || loc < 0) return false;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return true;
};
const cacheUniforms = (names: string[]) => {
    if (!gl || !program) return;
    names.forEach((n) => {
        uniformCache[n] =
            gl!.getUniformLocation(program!, n) ||
            gl!.getUniformLocation(program!, `${n}[0]`);
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

const createTexture = (w: number, h: number) => {
    if (!gl) return null;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, w), Math.max(1, h), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return texture;
};

const resizeTexture = (texture: WebGLTexture | null, w: number, h: number) => {
    if (!gl || !texture) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, w), Math.max(1, h), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
};

const ensureFeedbackTarget = (w: number, h: number) => {
    if (!gl || !feedbackTexture || !outputTexture) return;
    if (feedbackSize.w === w && feedbackSize.h === h) return;
    feedbackSize = { w, h };
    resizeTexture(feedbackTexture, w, h);
    resizeTexture(outputTexture, w, h);
};

const createCopyProgram = () => {
    if (!gl) return null;
    const frag = `
        precision mediump float;
        uniform sampler2D uCopyTex;
        uniform vec2 uCopyResolution;
        void main() {
            vec2 uv = gl_FragCoord.xy / max(uCopyResolution, vec2(1.0));
            gl_FragColor = texture2D(uCopyTex, uv);
        }
    `;
    const vs = compileShader(gl.VERTEX_SHADER, VERT_SRC, 'safe');
    const fs = compileShader(gl.FRAGMENT_SHADER, frag, 'safe');
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
    copyPositionLoc = gl.getAttribLocation(prog, 'position');
    copyUniformCache = {
        uCopyTex: gl.getUniformLocation(prog, 'uCopyTex'),
        uCopyResolution: gl.getUniformLocation(prog, 'uCopyResolution')
    };
    return prog;
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
    bindPosition(posLoc);

    cacheUniforms([
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
    const sampler = gl.getUniformLocation(program, 'iChannel0');
    if (sampler) gl.uniform1i(sampler, 0);
    const feedbackSampler = gl.getUniformLocation(program, 'iFrame1');
    if (feedbackSampler) gl.uniform1i(feedbackSampler, 1);
    return true;
};

const initGL = (c: OffscreenCanvas) => {
    canvas = c;
    gl = canvas.getContext('webgl', { preserveDrawingBuffer: false, alpha: false });
    if (!gl) return false;
    lastVideoSize = { w: 0, h: 0 };
    const b = gl.createBuffer();
    positionBuffer = b;
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
    feedbackTexture = createTexture(1, 1);
    outputTexture = createTexture(1, 1);
    framebuffer = gl.createFramebuffer();
    copyProgram = createCopyProgram();
    return true;
};

const resize = (w: number, h: number) => {
    if (!gl || !canvas) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    ensureFeedbackTarget(w, h);
};

const drawFrame = (bitmap: ImageBitmap, time: number, fx: FxPacket, videoSize: { w: number; h: number }) => {
    if (!gl || !program || !canvas || !tex) return;
    const u = uniformCache;
    if (!u['iTime']) return;

    if (currentProgram !== program) {
        gl.useProgram(program);
        currentProgram = program;
    }
    const posLoc = gl.getAttribLocation(program, 'position');
    if (!bindPosition(posLoc)) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    currentTexture = tex;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, feedbackTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const needsResize = videoSize.w !== lastVideoSize.w || videoSize.h !== lastVideoSize.h;
    if (needsResize) {
        lastVideoSize = videoSize;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    }

    const needsFeedback = fx.main_id === 140 || fx.fx1_id === 140 || fx.fx2_id === 140 || fx.fx3_id === 140 || fx.fx4_id === 140 || fx.fx5_id === 140;
    const feedbackReady = needsFeedback && !!(copyProgram && framebuffer && feedbackTexture && outputTexture);
    if (feedbackReady) {
        ensureFeedbackTarget(canvas.width, canvas.height);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, feedbackTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (feedbackReady) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);

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

    if (feedbackReady) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(copyProgram);
        currentProgram = copyProgram;
        if (!bindPosition(copyPositionLoc)) return;
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, outputTexture);
        if (copyUniformCache.uCopyTex) gl.uniform1i(copyUniformCache.uCopyTex, 2);
        if (copyUniformCache.uCopyResolution) gl.uniform2f(copyUniformCache.uCopyResolution, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        const prev = feedbackTexture;
        feedbackTexture = outputTexture;
        outputTexture = prev;
        currentTexture = null;
    }
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
