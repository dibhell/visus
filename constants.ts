
import { ShaderList } from './types';

export const GLSL_HEADER = `
    precision mediump float;
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec2 iVideoResolution;
    uniform sampler2D iChannel0;
    uniform float iMix;
    uniform float uMainFXGain;
    
    // Transform Uniforms
    uniform vec2 uTranslate; // X, Y panning
    uniform float uScale;    // Zoom
    
    // Uniforms for 5 Additive FX slots
    uniform float uFX1; uniform float uFX2; uniform float uFX3; uniform float uFX4; uniform float uFX5;
    uniform int uFX1_ID; uniform int uFX2_ID; uniform int uFX3_ID; uniform int uFX4_ID; uniform int uFX5_ID;
    
    // Master control for additive chain
    uniform float uAdditiveMasterGain;

    // --- UTILS ---
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
        return rand(p); 
    }

    vec2 getUV(vec2 fragCoord) {
        vec2 uv = fragCoord / iResolution.xy;
        
        if(iVideoResolution.x < 1.0) return uv;
        
        // 1. Aspect Ratio Correction (Cover Mode)
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
        
        // Base UV with aspect correction
        vec2 correctedUV = (uv - offset) / scale;
        
        // 2. Apply User Transforms (Pan/Zoom)
        // Center pivot
        vec2 p = correctedUV - 0.5;
        
        // Scale (Zoom) - Inverse logic: smaller scale value = bigger image
        // We invert uScale so higher knob value = zoom in
        p /= max(0.1, uScale);
        
        // Translate (Pan)
        p -= uTranslate;
        
        return p + 0.5;
    }

    vec4 getVideo(vec2 uv) {
        // Mirror repeat to avoid black edges on heavy distortion
        vec2 p = abs(fract(uv * 0.5 + 0.5) * 2.0 - 1.0);
        
        if(iVideoResolution.x < 2.0) { // Fallback plasma
            float t = iTime; 
            float v = sin(p.x*10.+t) + sin(p.y*10.+t);
            return vec4(0.5 + 0.5*sin(v), 0.2, 0.2, 1.0);
        }
        return texture2D(iChannel0, p);
    }
    
    // --- LAYERING SYSTEM ---
    // Each effect operates as a layer that blends on top of the previous result (bg)
    
    vec4 applyLayer(vec4 bg, vec2 uv, float rawAmt, int id) {
        // Global Chain Intensity
        float amt = rawAmt * uAdditiveMasterGain; 

        if (amt < 0.001 || id == 0) return bg;

        vec4 fg = bg; // The 'Foreground' layer result

        // --- DISTORTION LAYERS (Sample Video at new coords) ---
        // Since we are single-pass, distortions sample the raw video and mix over the background.
        // This creates a "Fade to effect" look which allows stacking.

        if (id == 1) { // RGB SHIFT
             float off = amt * 0.05;
             float r = getVideo(uv + vec2(off, 0.0)).r;
             float b = getVideo(uv - vec2(off, 0.0)).b;
             vec4 shiftCol = vec4(r, bg.g, b, 1.0);
             return mix(bg, shiftCol, amt);
        }
        else if (id == 3) { // GLITCH LINES
            float shift = step(0.90, sin(uv.y * 50.0 + iTime * 20.0)) * amt * 0.2;
            vec4 glitchSample = getVideo(uv + vec2(shift, 0.0));
            return mix(bg, glitchSample, amt);
        }
        else if (id == 4) { // PIXELATE
            float pixels = 300.0 - (amt * 290.0);
            if (pixels < 1.0) pixels = 1.0;
            vec2 p = floor(uv * pixels) / pixels;
            vec4 pixCol = getVideo(p);
            // Enhance: Multiply original color to keep some previous fx logic if desired, 
            // but purely mixing is cleaner for layering.
            return mix(bg, pixCol, amt);
        }
        else if (id == 6) { // KALEIDOSCOPE
            vec2 p = uv * 2.0 - 1.0;
            float angle = amt * 3.14;
            float s = sin(angle); float c = cos(angle);
            p = mat2(c, -s, s, c) * p;
            p = abs(p);
            vec4 kCol = getVideo(p * 0.5 + 0.5);
            return mix(bg, kCol, amt);
        }
        else if (id == 7) { // VHS RETRO
             // Distortion part
             float yOff = amt * 0.03;
             float drift = sin(uv.y * 10.0 + iTime * 2.0) * amt * 0.1;
             vec4 vhsCol = bg;
             vhsCol.r = bg.r + (rand(uv + vec2(0.0, iTime)) * amt * 0.6); // Noise
             vhsCol.g = getVideo(uv + vec2(0.0, yOff)).g; // Chromatic abberation
             vhsCol.rgb += drift;
             return mix(bg, vhsCol, amt);
        }
        else if (id == 22) { // FISHEYE
            vec2 p = uv * 2.0 - 1.0;
            float d = length(p);
            float bind = max(0.0, amt * 0.5);
            vec2 uv2 = uv + (p * pow(d, 2.0) * bind);
            vec4 fishCol = getVideo(uv2);
            // Vignette
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
                 return mix(bg, gCol, 0.8); // Hard mix for glitch
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

        // --- COLOR FILTERS (Modify the background directly) ---
        // These are truly independent adjustment layers.

        if (id == 2) { // INVERT
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

        return bg;
    }
    
    vec4 applyAdditiveFX(vec4 baseCol, vec2 uv) {
        vec4 col = baseCol;
        
        // Stack Layers (Order 1 -> 5)
        // Each layer blends on top of the previous result
        
        col = applyLayer(col, uv, uFX1, uFX1_ID);
        col = applyLayer(col, uv, uFX2, uFX2_ID); 
        col = applyLayer(col, uv, uFX3, uFX3_ID); 
        col = applyLayer(col, uv, uFX4, uFX4_ID);
        col = applyLayer(col, uv, uFX5, uFX5_ID);

        return col;
    }
`;

const BASE_SHADER_BODY = `void main(){ gl_FragColor=applyAdditiveFX(getVideo(getUV(gl_FragCoord.xy)), getUV(gl_FragCoord.xy)); }`;

export const SHADER_LIST: ShaderList = {
    '00_NONE': { id: 0, src: BASE_SHADER_BODY },
    
    // --- ADDITIVE FX (SLOTS 1-5) ---
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

    
    // --- MAIN SCENES (COMPLEX - ID > 100) ---
    '100_GLITCH_SCENE': { id: 100, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); float s=step(0.8,sin(iTime*15.))*uMainFXGain*0.5; vec4 c=getVideo(uv+vec2(s,0)); c.g=getVideo(uv+vec2(s*1.5,0)).g; gl_FragColor=applyAdditiveFX(mix(c, getVideo(uv), 1.0-iMix), uv); }` },
    '101_TUNNEL_WARP': { id: 101, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 p=(uv*2.-1.)*(1.0 + uMainFXGain*1.5); float r=length(p); float a=atan(p.y,p.x); a+=sin(r*20.0-iTime*5.0)*uMainFXGain; p=r*vec2(cos(a),sin(a)); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(p*0.5+0.5), iMix), uv); }` },
    '102_NEON_EDGES': { id: 102, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 d=1./iResolution; vec4 c=getVideo(uv); float e=distance(c,getVideo(uv+vec2(d.x,0)))+distance(c,getVideo(uv+vec2(0,d.y))); e=smoothstep(0.1,0.4,e)*iMix*8.*uMainFXGain; gl_FragColor=applyAdditiveFX(mix(c,vec4(vec3(e)*vec3(1,0.2,1),1),0.5), uv); }` },
    '103_COLOR_SHIFT': { id: 103, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec4 c=getVideo(uv); float hueShift = sin(iTime*0.5)*uMainFXGain*2.0; c.rgb = mod(c.rgb + hueShift, 1.0); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), c, iMix), uv); }` },
    '104_MIRROR_X': { id: 104, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 m=abs(uv*2.-1.); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(m*0.5+0.5), iMix * clamp(uMainFXGain+0.5, 0.0, 1.0)), uv); }` },
    '105_WAVE_VERT': { id: 105, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 distUv = uv; distUv.x += sin(uv.y * 30.0 + iTime * 5.0) * 0.1 * uMainFXGain; gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(distUv), iMix), uv); }` },
    '106_STEAM_ENGINE': { id: 106, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        vec4 c = getVideo(uv);
        float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        vec3 bronze = vec3(gray * 1.3, gray * 1.0, gray * 0.7);
        float noise = fract(sin(dot(uv + iTime*0.1, vec2(12.9898,78.233)))*43758.5453);
        float smoke = smoothstep(0.4, 0.8, noise) * uMainFXGain;
        vec3 final = mix(c.rgb, bronze, iMix) + vec3(smoke);
        gl_FragColor = applyAdditiveFX(vec4(final, 1.0), uv);
    }` },
    '107_CYBER_FAILURE': { id: 107, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        float blocks = floor(uv.y * 10.0);
        float displace = step(0.5, sin(iTime * 20.0 + blocks)) * uMainFXGain * 0.2;
        vec2 dUV = uv + vec2(displace, 0.0);
        float r = getVideo(dUV + vec2(uMainFXGain*0.05, 0)).r;
        float g = getVideo(dUV).g;
        float b = getVideo(dUV - vec2(uMainFXGain*0.05, 0)).b;
        gl_FragColor = applyAdditiveFX(mix(getVideo(uv), vec4(r,g,b,1.0), iMix), uv);
    }` },
    '108_BIO_HAZARD': { id: 108, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        vec4 c = getVideo(uv);
        vec2 d = 2.0/iResolution;
        float edge = length(getVideo(uv+d).rgb - c.rgb);
        vec3 toxic = vec3(0.0, 1.0, 0.2) * edge * 8.0 * uMainFXGain;
        gl_FragColor = applyAdditiveFX(mix(c, c + vec4(toxic, 0.0), iMix), uv);
    }` },
    '109_ZOOM_TOP': { id: 109, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        vec2 pivot = vec2(0.5, 0.9);
        float z = 0.5 * uMainFXGain; // Max zoom 50%
        vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;
        vec4 c = getVideo(mix(uv, zoomedUV, iMix));
        gl_FragColor = applyAdditiveFX(c, uv);
    }` },
    '110_ZOOM_BTM': { id: 110, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        vec2 pivot = vec2(0.5, 0.1);
        float z = 0.5 * uMainFXGain;
        vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;
        vec4 c = getVideo(mix(uv, zoomedUV, iMix));
        gl_FragColor = applyAdditiveFX(c, uv);
    }` },
    '111_ZOOM_CTR': { id: 111, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        vec2 pivot = vec2(0.5, 0.5);
        float z = 0.4 * uMainFXGain;
        vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;
        float rot = sin(iTime * 10.0) * 0.05 * uMainFXGain;
        vec2 p = zoomedUV - pivot;
        float s = sin(rot); float c_rot = cos(rot);
        p = mat2(c_rot, -s, s, c_rot) * p;
        zoomedUV = p + pivot;
        vec4 c = getVideo(mix(uv, zoomedUV, iMix));
        gl_FragColor = applyAdditiveFX(c, uv);
    }` },
};

export const VERT_SRC = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;