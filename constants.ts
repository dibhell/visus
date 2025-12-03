export interface SyncParam {

  bpm: number;

  offset: number;

  freq: number;

  width: number;

  gain: number;

}



export type RoutingType = 'off' | 'bpm' | 'sync1' | 'sync2' | 'sync3';



export type AspectRatioMode = 'native' | 'fit' | '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | 'manual';



export interface TransformConfig {

  x: number;

  y: number;

  scale: number;

}



export interface FxConfig {

  shader: string;

  routing: RoutingType;

  gain: number;

  mix?: number; 

}



export interface FxState {

  main: FxConfig;

  fx1: FxConfig;

  fx2: FxConfig;

  fx3: FxConfig;

  fx4: FxConfig;

  fx5: FxConfig;

}



export interface ShaderDefinition {

  id: number;

  src: string;

}



export interface ShaderList {

  [key: string]: ShaderDefinition;

}



export interface FilterBand {

  name: string;

  bandpass: BiquadFilterNode;

  analyser: AnalyserNode;

  data: any; // Relaxed type to prevent build errors with Uint8Array mismatches

}



export interface BandsData {

  sync1: number;

  sync2: number;

  sync3: number;

  [key: string]: number;

}



export interface MusicTrack {

  trackId: number;

  artistName: string;

  trackName: string;

  previewUrl: string;

  artworkUrl100: string;

}



export const GLSL_HEADER = `

    precision mediump float;

    uniform float iTime;

    uniform vec2 iResolution;

    uniform vec2 iVideoResolution;

    uniform sampler2D iChannel0;

    

    // Transform Uniforms

    uniform vec2 uTranslate; 

    uniform float uScale;    

    uniform float uMirror; // 0.0 = normal, 1.0 = flipped

    

    // Uniforms for FX slots

    uniform float uMainFXGain; // Gain for Main (Layer 0)

    uniform int uMainFX_ID;    // ID for Main (Layer 0)

    uniform float uMainMix;    // Wet/Dry for Main



    uniform float uFX1; uniform float uFX2; uniform float uFX3; uniform float uFX4; uniform float uFX5;

    uniform int uFX1_ID; uniform int uFX2_ID; uniform int uFX3_ID; uniform int uFX4_ID; uniform int uFX5_ID;

    uniform float uFX1Mix; uniform float uFX2Mix; uniform float uFX3Mix; uniform float uFX4Mix; uniform float uFX5Mix;

    

    // Master control for additive chain

    uniform float uAdditiveMasterGain;



    // --- UTILS ---

    float rand(vec2 co){

        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);

    }



    vec2 getUV(vec2 fragCoord) {

        vec2 uv = fragCoord / iResolution.xy;

        

        // Mirror Flip Logic

        if(uMirror > 0.5) {

            uv.x = 1.0 - uv.x;

        }



        if(iVideoResolution.x < 1.0) return uv;

        

        float sR = iResolution.x / iResolution.y;

        float vR = iVideoResolution.x / iVideoResolution.y;

        vec2 scale = vec2(1.0); 

        vec2 offset = vec2(0.0);



        if(sR > vR) { 

            scale.x = sR / vR; 

            offset.x = (1.0 - scale.x) * 0.5; 

        } else { 

            scale.y = vR / sR; 

            offset.y = (1.0 - scale.y) * 0.5; 

        }

        

        vec2 correctedUV = (uv - offset) / scale;

        vec2 p = correctedUV - 0.5;

        p /= max(0.1, uScale);

        p -= uTranslate;

        return p + 0.5;

    }



    vec4 getVideo(vec2 uv) {
        if(iVideoResolution.x < 2.0 || iVideoResolution.y < 2.0) {
            // Lightweight visual fallback to confirm pipeline is drawing
            return vec4(uv, 0.5 + 0.5 * sin(iTime * 2.0), 1.0);
        }
        vec2 p = vec2(clamp(uv.x, 0.0, 1.0), clamp(uv.y, 0.0, 1.0));
        p.y = 1.0 - p.y; // flip vertically to keep video upright
        return texture2D(iChannel0, p);
    }

    


    // Small helper utils for SDF overlays and text-like labels
    vec2 rotate2D(vec2 p, float a) {
        float c = cos(a), s = sin(a);
        return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    }

    float sdBox(vec2 p, vec2 b) {
        vec2 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    float sdHex(vec2 p, float r) {
        p = abs(p);
        return max(p.x * 0.866025 + p.y * 0.5, p.y) - r;
    }

    float sdTriangle(vec2 p) {
        const float k = 1.7320508075688772;
        p.x = abs(p.x) - 0.5;
        p.y = p.y + 0.288675;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
        p.x -= clamp(p.x, -1.0, 0.0);
        return -length(p) * sign(p.y);
    }

    float lineSegment(vec2 p, vec2 a, vec2 b, float w) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / max(0.0001, dot(ba, ba)), 0.0, 1.0);
        return length(pa - ba * h) - w;
    }

    bool segOn(int d, int idx) {
        if (idx == 0) return (d==0||d==2||d==3||d==5||d==6||d==7||d==8||d==9||d==10||d==14||d==15);
        else if (idx == 1) return (d==0||d==1||d==2||d==3||d==4||d==7||d==8||d==9||d==10||d==13);
        else if (idx == 2) return (d==0||d==1||d==3||d==4||d==5||d==6||d==7||d==8||d==9||d==10||d==11||d==13);
        else if (idx == 3) return (d==0||d==2||d==3||d==5||d==6||d==8||d==9||d==11||d==12||d==13||d==14);
        else if (idx == 4) return (d==0||d==2||d==6||d==8||d==10||d==11||d==12||d==13||d==14||d==15);
        else if (idx == 5) return (d==0||d==4||d==5||d==6||d==8||d==9||d==10||d==11||d==12||d==14||d==15);
        return (d==2||d==3||d==4||d==5||d==6||d==8||d==9||d==10||d==11||d==13||d==14||d==15);
    }

    float sevenSeg(float digit, vec2 p) {
        int d = int(clamp(floor(digit + 0.5), 0.0, 15.0));
        float w = 0.06;
        float m = 0.0;
        vec2 pa = vec2(-0.32, 0.45), pb = vec2(0.32, 0.45);
        vec2 pb1 = vec2(0.35, 0.42), pb2 = vec2(0.35, 0.0);
        vec2 pc1 = vec2(0.35, 0.0), pc2 = vec2(0.35, -0.42);
        vec2 pd1 = vec2(-0.32, -0.45), pd2 = vec2(0.32, -0.45);
        vec2 pe1 = vec2(-0.35, -0.42), pe2 = vec2(-0.35, 0.0);
        vec2 pf1 = vec2(-0.35, 0.42), pf2 = vec2(-0.35, 0.0);
        vec2 pg1 = vec2(-0.32, 0.0), pg2 = vec2(0.32, 0.0);
        if (segOn(d, 0)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pa, pb, 0.01)));
        if (segOn(d, 1)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pb1, pb2, 0.01)));
        if (segOn(d, 2)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pc1, pc2, 0.01)));
        if (segOn(d, 3)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pd1, pd2, 0.01)));
        if (segOn(d, 4)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pe1, pe2, 0.01)));
        if (segOn(d, 5)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pf1, pf2, 0.01)));
        if (segOn(d, 6)) m = max(m, smoothstep(w, 0.0, lineSegment(p, pg1, pg2, 0.01)));
        return m;
    }

    float morphShape(vec2 p, float t) {
        float ph = fract(t);
        float dBox = sdBox(p, vec2(0.85));
        float dHex = sdHex(p, 0.95);
        float dTri = sdTriangle(p * 0.95);
        float a = mix(dBox, dHex, smoothstep(0.05, 0.6, ph));
        float b = mix(dHex, dTri, smoothstep(0.4, 1.0, ph));
        return mix(a, b, smoothstep(0.35, 0.85, ph));
    }


    // --- UNIFIED LAYER LOGIC ---

    // Contains ALL effects (Main & Post) in one switch for maximum flexibility

    

    vec4 applyLayer(vec4 bg, vec2 uv, float rawAmt, int id) {

        // Apply Master Gain only if it's NOT the main layer (id < 100 usually implies additives, but here we control via uniforms)

        // Actually, rawAmt passed here is already specific to the slot.

        
        
        if (iVideoResolution.x < 1.0 || iVideoResolution.y < 1.0) return bg;

        float amt = rawAmt; 

        if (amt < 0.001 || id == 0) return bg;



        // --- DISTORTIONS & GEOMETRY ---



        if (id == 1) { // RGB SHIFT

             float off = amt * 0.05;

             float r = getVideo(uv + vec2(off, 0.0)).r;

             float b = getVideo(uv - vec2(off, 0.0)).b;

             return mix(bg, vec4(r, bg.g, b, 1.0), amt);

        }

        else if (id == 3) { // GLITCH LINES

            float shift = step(0.90, sin(uv.y * 50.0 + iTime * 20.0)) * amt * 0.2;

            return mix(bg, getVideo(uv + vec2(shift, 0.0)), amt);

        }

        else if (id == 4) { // PIXELATE

            float pixels = 300.0 - (amt * 290.0);

            if (pixels < 1.0) pixels = 1.0;

            vec2 p = floor(uv * pixels) / pixels;

            return mix(bg, getVideo(p), amt);

        }

        else if (id == 6) { // KALEIDOSCOPE

            vec2 p = uv * 2.0 - 1.0;

            float angle = amt * 3.14;

            float s = sin(angle); float c = cos(angle);

            p = mat2(c, -s, s, c) * p;

            p = abs(p);

            return mix(bg, getVideo(p * 0.5 + 0.5), amt);

        }

        else if (id == 7) { // VHS RETRO

             float yOff = amt * 0.03;

             float drift = sin(uv.y * 10.0 + iTime * 2.0) * amt * 0.1;

             vec4 vhsCol = bg;

             vhsCol.r = bg.r + (rand(uv + vec2(0.0, iTime)) * amt * 0.6); 

             vhsCol.g = getVideo(uv + vec2(0.0, yOff)).g; 

             vhsCol.rgb += drift;

             return mix(bg, vhsCol, amt);

        }

        else if (id == 22) { // FISHEYE

            vec2 p = uv * 2.0 - 1.0;

            float d = length(p);

            float bind = max(0.0, amt * 0.5);

            vec2 uv2 = uv + (p * pow(d, 2.0) * bind);

            vec4 fishCol = getVideo(uv2);

            fishCol.rgb *= 1.0 - (dot(p, p) * bind * 0.5);

            return mix(bg, fishCol, amt);

        }

        else if (id == 23) { // ZOOM PULSE

            vec2 pivot = vec2(0.5);

            float pulse = sin(iTime * 10.0) * 0.1 * amt;

            float zoom = amt * 0.5 + pulse;

            vec2 zoomedUV = (uv - pivot) * (1.0 - zoom) + pivot;

            return mix(bg, getVideo(zoomedUV), amt);

        }

        else if (id == 24) { // GLITCH DIGITAL

             float blocks = 10.0;

             vec2 blockUV = floor(uv * blocks) / blocks;

             float r = rand(blockUV + floor(iTime * 15.0));

             if (r < amt * 0.5) {

                 float shift = (r - 0.5) * 0.5;

                 vec4 gCol = getVideo(uv + vec2(shift, 0.0));

                 gCol.rgb += 0.2;

                 return mix(bg, gCol, 0.8); 

             }

             return bg;

        }

        else if (id == 25) { // GLITCH ANALOG

             float y = floor(uv.y * 50.0);

             float shift = sin(y * 13.2 + iTime * 20.0) * amt * 0.1;

             shift *= step(0.8, sin(iTime * 5.0 + y));

             vec4 c = getVideo(uv + vec2(shift, 0.0));

             c.r = getVideo(uv + vec2(shift + amt*0.02, 0.0)).r;

             c.b = getVideo(uv + vec2(shift - amt*0.02, 0.0)).b;

             return mix(bg, c, amt);

        }

        else if (id == 26) { // MIRROR QUAD

            vec2 p = abs(uv * 2.0 - 1.0);

            return mix(bg, getVideo(p), amt);

        }

        

        // --- PREVIOUSLY "MAIN" SCENES (Now Universal) ---



        else if (id == 100) { // GLITCH SCENE

            float s = step(0.8, sin(iTime * 15.0)) * amt * 0.5;

            vec4 c = getVideo(uv + vec2(s, 0.0));

            c.g = getVideo(uv + vec2(s * 1.5, 0.0)).g;

            return mix(bg, c, amt);

        }

        else if (id == 101) { // TUNNEL WARP

            vec2 p = (uv * 2.0 - 1.0) * (1.0 + amt * 1.5);

            float r = length(p);

            float a = atan(p.y, p.x);

            a += sin(r * 20.0 - iTime * 5.0) * amt;

            p = r * vec2(cos(a), sin(a));

            return mix(bg, getVideo(p * 0.5 + 0.5), amt);

        }

        else if (id == 102) { // NEON EDGES

            vec2 d = 1.0 / iResolution;

            vec4 c = getVideo(uv);

            float e = distance(c, getVideo(uv + vec2(d.x, 0.0))) + distance(c, getVideo(uv + vec2(0.0, d.y)));

            e = smoothstep(0.1, 0.4, e) * amt * 8.0;

            return mix(bg, mix(c, vec4(vec3(e) * vec3(1.0, 0.2, 1.0), 1.0), 0.5), amt);

        }

        else if (id == 103) { // COLOR SHIFT

            vec4 c = getVideo(uv);

            float hueShift = sin(iTime * 0.5) * amt * 2.0;

            c.rgb = mod(c.rgb + hueShift, 1.0);

            return mix(bg, c, amt);

        }

        else if (id == 104) { // MIRROR X

            vec2 m = abs(uv * 2.0 - 1.0);

            return mix(bg, getVideo(m * 0.5 + 0.5), amt);

        }

        else if (id == 105) { // WAVE VERT

            vec2 distUv = uv;

            distUv.x += sin(uv.y * 30.0 + iTime * 5.0) * 0.1 * amt;

            return mix(bg, getVideo(distUv), amt);

        }

        else if (id == 106) { // STEAM ENGINE

            vec4 c = getVideo(uv);

            float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));

            vec3 bronze = vec3(gray * 1.3, gray * 1.0, gray * 0.7);

            float noise = fract(sin(dot(uv + iTime*0.1, vec2(12.9898,78.233)))*43758.5453);

            float smoke = smoothstep(0.4, 0.8, noise) * amt;

            vec3 final = mix(c.rgb, bronze, amt) + vec3(smoke * amt);

            return mix(bg, vec4(final, 1.0), amt);

        }

        else if (id == 107) { // CYBER FAILURE

            float blocks = floor(uv.y * 10.0);

            float displace = step(0.5, sin(iTime * 20.0 + blocks)) * amt * 0.2;

            vec2 dUV = uv + vec2(displace, 0.0);

            float r = getVideo(dUV + vec2(amt*0.05, 0)).r;

            float g = getVideo(dUV).g;

            float b = getVideo(dUV - vec2(amt*0.05, 0)).b;

            return mix(bg, vec4(r,g,b,1.0), amt);

        }

        else if (id == 108) { // BIO HAZARD

            vec4 c = getVideo(uv);

            vec2 d = 2.0/iResolution;

            float edge = length(getVideo(uv+d).rgb - c.rgb);

            vec3 toxic = vec3(0.0, 1.0, 0.2) * edge * 8.0 * amt;

            return mix(bg, c + vec4(toxic, 0.0), amt);

        }

        else if (id == 109) { // ZOOM TOP

            vec2 pivot = vec2(0.5, 0.9);

            float z = 0.5 * amt;

            vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;

            return mix(bg, getVideo(mix(uv, zoomedUV, amt)), amt); // Mix UV for smooth transition

        }

        else if (id == 110) { // ZOOM BTM

            vec2 pivot = vec2(0.5, 0.1);

            float z = 0.5 * amt;

            vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;

            return mix(bg, getVideo(mix(uv, zoomedUV, amt)), amt);

        }

        else if (id == 111) { // ZOOM CTR

            vec2 pivot = vec2(0.5, 0.5);

            float z = 0.4 * amt;

            vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;

            float rot = sin(iTime * 10.0) * 0.05 * amt;

            vec2 p = zoomedUV - pivot;

            float s = sin(rot); float c_rot = cos(rot);

            p = mat2(c_rot, -s, s, c_rot) * p;

            zoomedUV = p + pivot;

            return mix(bg, getVideo(mix(uv, zoomedUV, amt)), amt);

        }

        else if (id == 112) { // ASCII MATRIX

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

        else if (id == 113) { // WATER RIPPLE

            vec2 p = uv * 2.0 - 1.0;

            float len = length(p);

            float rip = sin(len * 20.0 - iTime * 10.0) * 0.05 * amt;

            vec2 d = (p/len) * rip;

            return mix(bg, getVideo(uv + d), amt);

        }

        else if (id == 114) { // PIXEL SORT

            float t = 0.4; 

            float dist = 0.0;

            for(float i=0.0; i<10.0; i++){

                 vec4 s = getVideo(uv + vec2(-i*0.02*amt, 0.0));

                 float l = dot(s.rgb, vec3(0.333));

                 if(l > t) dist = i*0.02*amt;

            }

            return mix(bg, getVideo(uv - vec2(dist, 0.0)), amt);

        }

        else if (id == 115) { // HEX PIXELATE

            vec2 r = vec2(1.0, 1.73);

            vec2 h = r * 0.5;

            float scale = 20.0 + (1.0-amt)*50.0;

            vec2 a = mod(uv * scale, r) - h;

            vec2 b = mod(uv * scale - h, r) - h;

            vec2 gv = dot(a, a) < dot(b, b) ? a : b;

            vec2 id_hex = uv * scale - gv;

            vec2 hexUV = id_hex / scale;

            return mix(bg, getVideo(hexUV), amt);

        }

        else if (id == 116) { // AUDIO SHAKE

            float shake = amt * 0.1; 

            vec2 off = vec2(rand(vec2(iTime, 0.0)), rand(vec2(iTime, 1.0))) * shake - (shake*0.5);

            float r = getVideo(uv + off).r;

            float g = getVideo(uv + off * 0.5).g;

            float b = getVideo(uv).b;

            return mix(bg, vec4(r,g,b,1.0), amt);

        }

        else if (id == 117) { // BARANORAMA

            vec2 p = uv * 2.0 - 1.0;

            float r = length(p);

            float a = atan(p.y, p.x);

            vec2 polarUV = vec2(a / 3.14159, r);

            polarUV = polarUV * 0.5 + 0.5;

            polarUV.x += iTime * 0.2 * amt;

            return mix(bg, getVideo(polarUV), amt);

        }



        // --- COLOR & STYLE FILTERS ---



        else if (id == 2) { // INVERT

            return mix(bg, 1.0 - bg, amt);

        }

        else if (id == 5) { // FLASH

            return bg + (amt * 1.2);

        }

        else if (id == 8) { // STEAM COLOR

            float gray = dot(bg.rgb, vec3(0.299, 0.587, 0.114));

            vec3 sepia = vec3(gray * 1.2, gray * 1.0, gray * 0.8) * vec3(1.1, 0.8, 0.5);

            vec3 vig = bg.rgb * (1.0 - length(uv - 0.5) * amt * 1.2);

            return mix(vec4(vig, 1.0), vec4(sepia, 1.0), amt);

        }

        else if (id == 9) { // SCANLINES

            float lines = sin(uv.y * 800.0) * 0.5 + 0.5;

            vec3 lined = bg.rgb * (1.0 - lines * clamp(amt, 0.0, 0.9));

            return vec4(lined, 1.0);

        }

        else if (id == 27) { // HALFTONE

            float freq = 80.0;

            vec2 nearest = 2.0 * fract(freq * uv) - 1.0;

            float dist = length(nearest);

            float gray = dot(bg.rgb, vec3(0.299, 0.587, 0.114));

            float radius = sqrt(gray) * 1.0; 

            vec3 dotCol = vec3(step(dist, radius)); 

            return mix(bg, vec4(dotCol, 1.0), amt);

        }

        else if (id == 28) { // GAMEBOY

             float pix = 4.0;

             vec2 dUV = floor(uv * iResolution / pix) * pix / iResolution;

             float gray = dot(getVideo(dUV).rgb, vec3(0.299, 0.587, 0.114));

             float dither = mod(gl_FragCoord.x, 2.0) + mod(gl_FragCoord.y, 2.0)*2.0;

             dither = (dither / 4.0) * 0.3; 

             float q = floor(gray * 4.0 + dither) / 3.0;

             vec3 col = mix(vec3(0.06, 0.22, 0.06), vec3(0.61, 0.73, 0.06), q);

             return mix(bg, vec4(col, 1.0), amt);

        }

        else if (id == 29) { // THERMAL

            float lum = dot(bg.rgb, vec3(0.299, 0.587, 0.114));

            vec3 thermal;

            if (lum < 0.25) thermal = mix(vec3(0,0,1), vec3(0,1,1), lum*4.0);

            else if (lum < 0.5) thermal = mix(vec3(0,1,1), vec3(0,1,0), (lum-0.25)*4.0);

            else if (lum < 0.75) thermal = mix(vec3(0,1,0), vec3(1,1,0), (lum-0.5)*4.0);

            else thermal = mix(vec3(1,1,0), vec3(1,0,0), (lum-0.75)*4.0);

            return mix(bg, vec4(thermal, 1.0), amt);

        }

        else if (id == 30) { // DUOTONE

             float lum = dot(bg.rgb, vec3(0.299, 0.587, 0.114));

             vec3 c1 = vec3(0.2, 0.0, 0.4); 

             vec3 c2 = vec3(0.0, 1.0, 0.9); 

             vec3 duo = mix(c1, c2, lum);

             return mix(bg, vec4(duo, 1.0), amt);

        }

        else if (id == 31) { // THRESHOLD

             float lum = dot(bg.rgb, vec3(0.299, 0.587, 0.114));

             float bw = step(0.5, lum);

             return mix(bg, vec4(vec3(bw), 1.0), amt);

        }

        else if (id == 118) { // CHROMA FRACTURE
             vec2 grid = floor(uv * (8.0 + amt * 24.0));
             float rnd = rand(grid + iTime);
             float shift = (rnd - 0.5) * 0.08 * amt;
             float shear = sin(iTime * 2.0 + grid.y) * 0.02 * amt;
             vec2 rUV = uv + vec2(shift + shear, 0.0);
             vec2 gUV = uv + vec2(-shift, shift * 0.5);
             vec2 bUV = uv + vec2(shift * 0.5, -shift);
             vec3 col;
             col.r = getVideo(rUV).r;
             col.g = getVideo(gUV).g;
             col.b = getVideo(bUV).b;
             return mix(bg, vec4(col, 1.0), amt);
        }

        else if (id == 119) { // LIQUID VHS
             float yOff = (sin(iTime * 2.0 + uv.y * 30.0) * 0.01 + rand(uv + iTime) * 0.01) * amt;
             float xDrift = sin(iTime * 6.0 + uv.y * 80.0) * 0.02 * amt;
             vec2 wobble = vec2(xDrift, yOff);
             vec4 vhs = getVideo(uv + wobble);
             float line = step(0.94, fract(uv.y * (40.0 + amt * 80.0) + iTime * 4.0));
             vhs.rgb += line * 0.2 * amt;
             return mix(bg, vhs, amt);
        }

        else if (id == 120) { // VORONOI MELT (noisy warp)
             float n = sin(uv.x * 30.0 + iTime * 1.3) + cos(uv.y * 25.0 - iTime * 1.7);
             vec2 warp = vec2(n, sin(n + iTime * 0.7)) * 0.02 * amt;
             vec2 wobble = uv + warp;
             vec4 col = getVideo(wobble);
             col.rgb = mix(col.rgb, vec3(length(col.rgb)), 0.2 * amt);
             return mix(bg, col, amt);
        }

        else if (id == 121) { // FEEDBACK ECHO (multi zoom taps)
             vec2 pivot = vec2(0.5);
             vec2 p = uv - pivot;
             vec4 acc = vec4(0.0);
             float total = 0.0;
             for (int i = 0; i < 4; i++) {
                 float s = 1.0 - float(i) * 0.1 * amt;
                 vec2 tuv = pivot + p * s;
                 float w = 1.0 - float(i) * 0.2;
                 acc += getVideo(tuv) * w;
                 total += w;
             }
             acc /= max(0.001, total);
             return mix(bg, acc, amt);
        }

        else if (id == 122) { // HEX GLASS
             vec2 q = uv;
             q.x += q.y * 0.57735;
             float scale = mix(12.0, 60.0, amt);
             vec2 cell = floor(q * scale);
             vec2 f = fract(q * scale) - 0.5;
             vec2 nearest = cell;
             float minD = 10.0;
             for (int j = -1; j <= 1; j++) {
                 for (int i = -1; i <= 1; i++) {
                     vec2 c = cell + vec2(float(i), float(j));
                     vec2 r = f - vec2(float(i), float(j));
                     float d = dot(r, r);
                     if (d < minD) { minD = d; nearest = c; }
                 }
             }
             vec2 hexUV = (nearest + 0.5) / scale;
             vec4 refr = getVideo(hexUV + (uv - hexUV) * (0.2 * amt));
             return mix(bg, refr, amt);
        }

        else if (id == 123) { // VISC_GLITCH
             float n = sin(uv.y * 40.0 + iTime * 6.0) + cos(uv.x * 35.0 - iTime * 4.0);
             vec2 warp = vec2(n, sin(n + iTime * 1.5)) * 0.012 * amt;
             vec4 smeared = getVideo(uv + warp);
             float stripes = step(0.85, fract(uv.y * (25.0 + amt * 40.0) + iTime * 3.0));
             smeared.rgb = mix(smeared.rgb, smeared.rgb.bgr, stripes * 0.6 * amt);
             return mix(bg, smeared, amt);
        }

        else if (id == 124) { // MELT_SHIFT
             float melt = (sin(uv.x * 18.0 + iTime * 2.5) + rand(uv + iTime)) * 0.08 * amt;
             vec2 mUV = uv + vec2(0.0, melt);
             vec4 c = getVideo(mUV);
             float drip = step(0.92, fract(uv.x * 30.0 + iTime * 5.0));
             c.rgb -= drip * 0.2 * amt;
             return mix(bg, c, amt);
        }

        else if (id == 125) { // DRIP_CHROMA
             float drip = (fract(uv.x * 20.0 + iTime * 0.8) - 0.5) * 0.3 * amt;
             vec2 rUV = uv + vec2(0.0, drip);
             vec2 gUV = uv + vec2(0.0, -drip * 0.6);
             vec2 bUV = uv + vec2(0.0, drip * 0.3);
             vec3 col;
             col.r = getVideo(rUV).r;
             col.g = getVideo(gUV).g;
             col.b = getVideo(bUV).b;
             return mix(bg, vec4(col, 1.0), amt);
        }

        else if (id == 126) { // FLUID_PIXEL_SMEAR
             float pixels = 180.0 - amt * 140.0;
             vec2 grid = floor(uv * pixels) / pixels;
             vec2 dir = vec2(sin(iTime + grid.y * 10.0), cos(iTime * 0.7 + grid.x * 9.0)) * 0.01 * amt;
             vec4 smear = getVideo(grid + dir);
             smear.rgb = mix(smear.rgb, vec3(dot(smear.rgb, vec3(0.333))), 0.2 * amt);
             return mix(bg, smear, amt);
        }

        else if (id == 127) { // WAVE_SLICE
             float amp = 0.06 * amt;
             float freq = 30.0 + amt * 40.0;
             vec2 wUV = uv;
             wUV.x += sin(uv.y * freq + iTime * 8.0) * amp;
             vec4 warped = getVideo(wUV);
             return mix(bg, warped, amt);
        }

        else if (id == 128) { // LIQUID_ECHO
             vec2 pivot = vec2(0.5);
             vec2 p = uv - pivot;
             vec4 acc = vec4(0.0);
             float total = 0.0;
             for (int i = 0; i < 5; i++) {
                 float s = 1.0 - float(i) * 0.08 * amt;
                 float rot = sin(iTime * 0.8 + float(i)) * 0.05 * amt;
                 vec2 q = p;
                 float cs = cos(rot), sn = sin(rot);
                 q = mat2(cs, -sn, sn, cs) * q;
                 vec2 tuv = pivot + q * s;
                 float w = 1.0 - float(i) * 0.18;
                 acc += getVideo(tuv) * w;
                 total += w;
             }
             acc /= max(0.001, total);
             return mix(bg, acc, amt);
        }

        else if (id == 129) { // FLUID_FEEDBACK
             vec2 flow = vec2(
                 sin(iTime * 0.9 + uv.y * 20.0),
                 cos(iTime * 1.2 + uv.x * 18.0)
             ) * 0.02 * amt;
             vec4 a = getVideo(uv + flow);
             vec4 b = getVideo(uv - flow * 0.6);
             vec4 mixd = mix(a, b, 0.5);
             mixd.rgb += (rand(uv + iTime) - 0.5) * 0.1 * amt;
             return mix(bg, mixd, amt);
        }

        else if (id == 130) { // GEL_TRAIL
             float trail = 0.015 * amt;
             vec4 acc = vec4(0.0);
             float total = 0.0;
             for (int i = 0; i < 6; i++) {
                 float t = float(i) / 5.0;
                 vec2 shift = vec2(t * trail, t * trail * sin(iTime + uv.y * 10.0));
                 float w = 1.0 - t * 0.8;
                 acc += getVideo(uv - shift) * w;
                 total += w;
             }
             acc /= max(0.001, total);
             return mix(bg, acc, amt);
        }

        else if (id == 131) { // VISC_RIPPLE
             vec2 p = uv * 2.0 - 1.0;
             float r = length(p);
             float ripple = sin(r * 25.0 - iTime * 8.0) * 0.03 * amt;
             vec2 d = (p / max(0.001, r)) * ripple;
             vec4 c = getVideo(uv + d);
             return mix(bg, c, amt);
        }

        else if (id == 132) { // CHROMA_WASH
             float flow = sin(iTime * 0.7 + uv.y * 12.0) * 0.03 * amt;
             vec3 col;
             col.r = getVideo(uv + vec2(flow, 0.0)).r;
             col.g = getVideo(uv + vec2(-flow * 0.6, flow * 0.4)).g;
             col.b = getVideo(uv + vec2(flow * 0.3, -flow * 0.8)).b;
             return mix(bg, vec4(col, 1.0), amt);
        }

        else if (id == 133) { // NEURAL_BLOOM
             float lum = dot(bg.rgb, vec3(0.299, 0.587, 0.114));
             float glow = smoothstep(0.4, 1.0, lum) * amt;
             vec3 col = bg.rgb + vec3(glow * 0.8, glow * 0.5, glow);
             return mix(bg, vec4(col, 1.0), amt);
        }

        else if (id == 134) { // DATA_STREAM
             float colIdx = floor(uv.x * 60.0);
             float speed = 2.5 + amt * 4.0;
             float flow = fract(uv.y * 40.0 - iTime * speed + colIdx * 0.13);
             float mask = step(flow, 0.15);
             vec3 tint = mix(bg.rgb, vec3(0.1, 0.8, 0.5), mask * amt);
             tint.r += rand(vec2(colIdx, iTime)) * 0.1 * amt;
             return vec4(tint, 1.0);
        }

        else if (id == 135) { // SLIT_SCAN
             float offset = (uv.y - 0.5) * 0.3 * amt;
             vec2 sampleUV = vec2(uv.x + offset, uv.y);
             sampleUV.x = fract(sampleUV.x);
             return mix(bg, getVideo(sampleUV), amt);
        }

        else if (id == 136) { // ANAGLYPH_DRIFT
             float drift = sin(iTime * 1.5 + uv.y * 15.0) * 0.02 * amt;
             vec2 rUV = uv + vec2(drift, 0.0);
             vec2 bUV = uv - vec2(drift, 0.0);
             vec3 col;
             col.r = getVideo(rUV).r;
             col.g = bg.g;
             col.b = getVideo(bUV).b;
             return mix(bg, vec4(col, 1.0), amt);
        }

        else if (id == 137) { // ASCII_PLASMA
             float pix = 90.0 - amt * 60.0;
             vec2 block = floor(uv * pix) / pix;
             float plasma = sin(block.x * 10.0 + iTime) + sin(block.y * 10.0 + iTime * 1.3);
             plasma = 0.5 + 0.5 * plasma;
             float gray = dot(getVideo(block).rgb, vec3(0.333));
             float charMask = step(0.6, gray + plasma * 0.3);
             vec3 c = mix(vec3(0.1, 0.2, 0.4), vec3(0.8, 0.9, 1.0), plasma);
             return mix(bg, vec4(c * charMask, 1.0), amt);
        }

        else if (id == 138) { // FRACTAL_FLAMES (simple turbulence tint)
             vec2 p = uv * 3.0;
             float t = iTime * 0.6;
             float n = sin(p.x + t) + sin(p.y * 1.3 - t) + sin((p.x + p.y) * 0.7 + t * 1.5);
             n = 0.5 + 0.5 * n;
             vec3 flame = mix(vec3(0.2, 0.0, 0.4), vec3(1.0, 0.5, 0.1), n);
             return mix(bg, vec4(flame, 1.0), amt);
        }

        else if (id == 139) { // POLAR_GLITCH
             vec2 p = uv * 2.0 - 1.0;
             float r = length(p);
             float a = atan(p.y, p.x);
             a += (rand(vec2(floor(a * 10.0), iTime)) - 0.5) * 0.3 * amt;
             r += (rand(vec2(floor(r * 40.0), iTime * 0.5)) - 0.5) * 0.1 * amt;
             vec2 pol = vec2(r * cos(a), r * sin(a));
             vec2 wuv = pol * 0.5 + 0.5;
             return mix(bg, getVideo(wuv), amt);
        }
        else if (id == 140) { // DATA MOSHER
            vec2 block = floor(uv * vec2(48.0, 32.0));
            float r = rand(block + floor(iTime * 2.0));
            vec2 jitter = (vec2(rand(block * 2.3), rand(block * 3.7)) - 0.5) * vec2(0.12, 0.05) * amt;
            vec2 moshedUV = uv + jitter;
            float line = step(0.85, fract(block.y * 0.17 + iTime * 0.5));
            moshedUV.x += line * 0.08 * amt;
            vec4 frozen = getVideo(clamp(uv + vec2(0.05 * sin(iTime * 2.0) * amt, 0.0), 0.0, 1.0));
            vec4 c = mix(getVideo(moshedUV), frozen, step(0.9, r) * 0.7);
            return mix(bg, c, amt);
        }
        else if (id == 141) { // VOXELIZER 3D
            float vox = mix(12.0, 64.0, amt);
            vec2 q = floor(uv * vox) / vox;
            vec4 c = getVideo(q);
            float h = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            float shade = 0.6 + 0.4 * clamp(h * 1.4, 0.0, 1.0);
            vec2 lightDir = normalize(vec2(0.6, 0.8));
            float rim = max(0.1, dot(normalize(vec2(h) + lightDir), lightDir));
            vec3 col = c.rgb * shade * rim;
            return mix(bg, vec4(col, c.a), amt);
        }
        else if (id == 142) { // TUNNEL SDF
            vec2 p = uv * 2.0 - 1.0;
            float r = length(p);
            float a = atan(p.y, p.x);
            float wave = sin(a * 6.0 + iTime * 2.0) * 0.05 * amt;
            float rad = r + wave;
            vec2 tuv = vec2(fract(rad * 1.2 - iTime * 0.5), fract(a / (2.0 * 3.14159)));
            vec4 col = getVideo(tuv * 0.5 + 0.25);
            float ao = smoothstep(1.0, 0.2, r);
            return mix(bg, col * ao, amt);
        }
        else if (id == 143) { // NORMAL + SPECULAR
            vec2 d = vec2(1.0 / max(iVideoResolution.x, 1.0), 1.0 / max(iVideoResolution.y, 1.0));
            vec3 c = getVideo(uv).rgb;
            vec3 cx = getVideo(uv + vec2(d.x, 0.0)).rgb - getVideo(uv - vec2(d.x, 0.0)).rgb;
            vec3 cy = getVideo(uv + vec2(0.0, d.y)).rgb - getVideo(uv - vec2(0.0, d.y)).rgb;
            vec3 n = normalize(vec3(cx.r + cx.g + cx.b, cy.r + cy.g + cy.b, 0.1));
            vec3 lightDir = normalize(vec3(0.6 + sin(iTime)*0.2, 0.7, 0.5));
            float diff = max(0.0, dot(n, lightDir));
            float spec = pow(max(0.0, dot(reflect(-lightDir, n), vec3(0.0,0.0,1.0))), 16.0) * amt;
            vec3 lit = c * (0.4 + 0.6 * diff) + vec3(spec);
            return mix(bg, vec4(lit, 1.0), amt);
        }

        else if (id == 144) { // DESZYFRATOR (bright/dark tracker)
             float power = clamp(amt / 14.0, 0.08, 1.2);
             float t = iTime * (3.0 + power * 3.5);
             vec2 brightUV = vec2(0.42, 0.42);
             vec2 darkUV = vec2(0.58, 0.58);
             float brightLum = -1.0;
             float darkLum = 4.0;

             for (int i = 0; i < 12; i++) {
                 float fi = float(i);
                 vec2 seed = vec2(fi * 12.9898 + t * 0.77, fi * 78.233 + t * 1.13);
                 vec2 base = vec2(fract(sin(seed.x) * 43758.5453), fract(sin(seed.y) * 24634.6345));
                 vec2 spread = vec2(sin(fi * 0.9 + t * 0.7), cos(fi * 1.3 - t * 0.6)) * (0.05 + power * 0.03);
                 vec2 suv = clamp(base + spread, 0.01, 0.99);
                 vec3 sc = getVideo(suv).rgb;
                 float lum = dot(sc, vec3(0.299, 0.587, 0.114));
                 if (lum > brightLum) { brightLum = lum; brightUV = suv; }
                 if (lum < darkLum) { darkLum = lum; darkUV = suv; }
             }

             vec3 samples[2];
             samples[0] = getVideo(brightUV).rgb;
             samples[1] = getVideo(darkUV).rgb;
             vec2 targets[2];
             targets[0] = brightUV;
             targets[1] = darkUV;
             vec3 accents[2];
             accents[0] = mix(vec3(0.22, 0.8, 1.0), vec3(0.55, 1.0, 0.9), clamp(brightLum, 0.0, 1.0));
             accents[1] = mix(vec3(1.0, 0.42, 0.28), vec3(1.0, 0.68, 0.38), clamp(1.0 - darkLum, 0.0, 1.0));

             vec3 outCol = bg.rgb;
             float overlayMix = 0.0;
             float shapeScale = 0.02 + power * 0.015;

             for (int m = 0; m < 2; m++) {
                 vec2 markUV = targets[m];
                 vec3 sampleCol = samples[m];
                 vec3 accent = accents[m];
                 float dir = (m == 0) ? 1.0 : -1.0;

                 vec2 labelOffset = vec2(dir * (0.12 + 0.02 * sin(t + markUV.x * 4.0)), (markUV.y > 0.5 ? -1.0 : 1.0) * (0.08 + 0.015 * cos(t * 1.2 + markUV.y * 3.0)));
                 vec2 labelPos = clamp(markUV + labelOffset, vec2(0.05), vec2(0.95));

                 float lineMask = smoothstep(0.005, 0.0, lineSegment(uv, markUV, labelPos, 0.0015 + power * 0.0008));

                 vec2 sp = (uv - markUV) / (shapeScale + 0.0001);
                 float dShape = morphShape(rotate2D(sp, t * 4.0 + float(m) * 1.2), t * 1.5 + float(m) * 0.3);
                 float shapeCore = smoothstep(0.12, 0.0, dShape);
                 float shapeGlow = smoothstep(0.22, 0.0, abs(dShape)) * 0.6;
                 float ring = smoothstep(0.01, 0.0, abs(length(uv - markUV) - shapeScale * 1.6));
                 vec3 shapeCol = mix(sampleCol, accent, 0.6);
                 float sAlpha = clamp((shapeCore * 0.65 + shapeGlow * 0.25 + ring * 0.2) * power, 0.0, 0.65);
                 outCol = mix(outCol, shapeCol, sAlpha);
                 overlayMix = max(overlayMix, sAlpha);

                 vec3 lineCol = mix(accent, sampleCol, 0.3);
                 outCol = mix(outCol, lineCol, lineMask * (0.18 + 0.22 * power));
                 overlayMix = max(overlayMix, lineMask * 0.2);

                 float box = sdBox(uv - labelPos, vec2(0.09, 0.045));
                 float labelMask = smoothstep(0.0, 0.02, -box);
                 float border = smoothstep(0.015, 0.0, abs(box) - 0.004);
                 vec3 labelCol = mix(accent, sampleCol, 0.4);
                 outCol = mix(outCol, labelCol, (labelMask * 0.22 + border * 0.18) * power);
                 overlayMix = max(overlayMix, labelMask * 0.2);

                 float maxX = max(iResolution.x, 1.0);
                 float maxY = max(iResolution.y, 1.0);
                 float cx = floor(markUV.x * maxX);
                 float cy = floor((1.0 - markUV.y) * maxY);
                 float dx0 = floor(cx / 100.0);
                 float dx1 = floor(mod(cx / 10.0, 10.0));
                 float dx2 = floor(mod(cx, 10.0));
                 float dy0 = floor(cy / 100.0);
                 float dy1 = floor(mod(cy / 10.0, 10.0));
                 float dy2 = floor(mod(cy, 10.0));

                 vec3 hexv = clamp(sampleCol * 255.0, vec3(0.0), vec3(255.0));
                 float rh = floor(hexv.r / 16.0);
                 float rl = floor(mod(hexv.r, 16.0));
                 float gh = floor(hexv.g / 16.0);
                 float gl = floor(mod(hexv.g, 16.0));
                 float bh = floor(hexv.b / 16.0);
                 float bl = floor(mod(hexv.b, 16.0));

                 vec2 local = uv - labelPos;
                 float textMask = 0.0;
                 if (max(abs(local.x), abs(local.y)) < 0.12) {
                     float gs = 0.028;
                     float space = 0.032;
                     vec2 row1 = vec2(-0.08, 0.014);
                     vec2 row2 = vec2(-0.08, -0.018);
                     textMask = max(textMask, sevenSeg(dx0, (local - row1) / gs));
                     textMask = max(textMask, sevenSeg(dx1, (local - row1 - vec2(space, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(dx2, (local - row1 - vec2(space * 2.0, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(dy0, (local - row1 - vec2(space * 3.4, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(dy1, (local - row1 - vec2(space * 4.4, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(dy2, (local - row1 - vec2(space * 5.4, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(rh, (local - row2) / gs));
                     textMask = max(textMask, sevenSeg(rl, (local - row2 - vec2(space, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(gh, (local - row2 - vec2(space * 2.3, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(gl, (local - row2 - vec2(space * 3.3, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(bh, (local - row2 - vec2(space * 4.6, 0.0)) / gs));
                     textMask = max(textMask, sevenSeg(bl, (local - row2 - vec2(space * 5.6, 0.0)) / gs));
                 }
                 vec3 textCol = mix(accent, sampleCol, 0.2);
                 outCol = mix(outCol, textCol, textMask * (0.3 + 0.35 * power));
                 overlayMix = max(overlayMix, textMask * 0.25);
             }

             vec3 blended = mix(bg.rgb, outCol, clamp(0.45 + overlayMix * 0.4, 0.0, 0.85));
             return vec4(blended, 1.0);
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

`;



// Updated Body: Apply Main Layer (Layer 0) first, then additive chain

const BASE_SHADER_BODY = `void main(){ 
    vec2 uv = getUV(gl_FragCoord.xy);
    gl_FragColor = getVideo(uv); 
}`;



// Unified List - All effects now use the same BASE_SHADER_BODY

export const SHADER_LIST: ShaderList = {

    '00_NONE': { id: 0, src: BASE_SHADER_BODY },

    

    // Additive

    '1_RGB_SHIFT': { id: 1, src: BASE_SHADER_BODY },

    '2_INVERT_COLOR': { id: 2, src: BASE_SHADER_BODY },

    '3_GLITCH_LINES': { id: 3, src: BASE_SHADER_BODY },

    '4_PIXELATE': { id: 4, src: BASE_SHADER_BODY },

    '5_BRIGHT_FLASH': { id: 5, src: BASE_SHADER_BODY },

    '6_KALEIDO_4X': { id: 6, src: BASE_SHADER_BODY },

    '7_VHS_RETRO': { id: 7, src: BASE_SHADER_BODY },

    '8_STEAM_COLOR': { id: 8, src: BASE_SHADER_BODY },

    '9_SCANLINES': { id: 9, src: BASE_SHADER_BODY },

    '22_FISHEYE_LENS': { id: 22, src: BASE_SHADER_BODY },

    '23_ZOOM_PULSE': { id: 23, src: BASE_SHADER_BODY },

    '24_GLITCH_DIGITAL': { id: 24, src: BASE_SHADER_BODY },

    '25_GLITCH_ANALOG': { id: 25, src: BASE_SHADER_BODY },

    '26_MIRROR_QUAD': { id: 26, src: BASE_SHADER_BODY },

    '27_HALFTONE': { id: 27, src: BASE_SHADER_BODY },

    '28_GAMEBOY': { id: 28, src: BASE_SHADER_BODY },

    '29_THERMAL': { id: 29, src: BASE_SHADER_BODY },

    '30_DUOTONE': { id: 30, src: BASE_SHADER_BODY },

    '31_THRESHOLD': { id: 31, src: BASE_SHADER_BODY },



    // Main Scenes (Now usable anywhere)

    '100_GLITCH_SCENE': { id: 100, src: BASE_SHADER_BODY },

    '101_TUNNEL_WARP': { id: 101, src: BASE_SHADER_BODY },

    '102_NEON_EDGES': { id: 102, src: BASE_SHADER_BODY },

    '103_COLOR_SHIFT': { id: 103, src: BASE_SHADER_BODY },

    '104_MIRROR_X': { id: 104, src: BASE_SHADER_BODY },

    '105_WAVE_VERT': { id: 105, src: BASE_SHADER_BODY },

    '106_STEAM_ENGINE': { id: 106, src: BASE_SHADER_BODY },

    '107_CYBER_FAILURE': { id: 107, src: BASE_SHADER_BODY },

    '108_BIO_HAZARD': { id: 108, src: BASE_SHADER_BODY },

    '109_ZOOM_TOP': { id: 109, src: BASE_SHADER_BODY },

    '110_ZOOM_BTM': { id: 110, src: BASE_SHADER_BODY },

    '111_ZOOM_CTR': { id: 111, src: BASE_SHADER_BODY },

    '112_ASCII_MATRIX': { id: 112, src: BASE_SHADER_BODY },

    '113_WATER_RIPPLE': { id: 113, src: BASE_SHADER_BODY },

    '114_PIXEL_SORT': { id: 114, src: BASE_SHADER_BODY },

    '115_HEX_PIXELATE': { id: 115, src: BASE_SHADER_BODY },

    '116_AUDIO_SHAKE': { id: 116, src: BASE_SHADER_BODY },

    '117_BARANORAMA': { id: 117, src: BASE_SHADER_BODY },

    '118_CHROMA_FRACTURE': { id: 118, src: BASE_SHADER_BODY },
    '119_LIQUID_VHS': { id: 119, src: BASE_SHADER_BODY },
    '120_VORONOI_MELT': { id: 120, src: BASE_SHADER_BODY },
    '121_FEEDBACK_ECHO': { id: 121, src: BASE_SHADER_BODY },
    '122_HEX_GLASS': { id: 122, src: BASE_SHADER_BODY },
    '123_VISC_GLITCH': { id: 123, src: BASE_SHADER_BODY },
    '124_MELT_SHIFT': { id: 124, src: BASE_SHADER_BODY },
    '125_DRIP_CHROMA': { id: 125, src: BASE_SHADER_BODY },
    '126_FLUID_PIXEL_SMEAR': { id: 126, src: BASE_SHADER_BODY },
    '127_WAVE_SLICE': { id: 127, src: BASE_SHADER_BODY },
    '128_LIQUID_ECHO': { id: 128, src: BASE_SHADER_BODY },
    '129_FLUID_FEEDBACK': { id: 129, src: BASE_SHADER_BODY },
    '130_GEL_TRAIL': { id: 130, src: BASE_SHADER_BODY },
    '131_VISC_RIPPLE': { id: 131, src: BASE_SHADER_BODY },
    '132_CHROMA_WASH': { id: 132, src: BASE_SHADER_BODY },
    '133_NEURAL_BLOOM': { id: 133, src: BASE_SHADER_BODY },
    '134_DATA_STREAM': { id: 134, src: BASE_SHADER_BODY },
    '135_SLIT_SCAN': { id: 135, src: BASE_SHADER_BODY },
    '136_ANAGLYPH_DRIFT': { id: 136, src: BASE_SHADER_BODY },
    '137_ASCII_PLASMA': { id: 137, src: BASE_SHADER_BODY },
    '138_FRACTAL_FLAMES': { id: 138, src: BASE_SHADER_BODY },
    '139_POLAR_GLITCH': { id: 139, src: BASE_SHADER_BODY },
    '140_DATA_MOSHER': { id: 140, src: BASE_SHADER_BODY },
    '141_VOXELIZER_3D': { id: 141, src: BASE_SHADER_BODY },
    '142_TUNNEL_SDF': { id: 142, src: BASE_SHADER_BODY },
    '143_NORMAL_SPECULAR': { id: 143, src: BASE_SHADER_BODY },
    '144_DESZYFRATOR': { id: 144, src: BASE_SHADER_BODY },

};



export const VERT_SRC = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
