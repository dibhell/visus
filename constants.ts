
import { ShaderList } from './types';

export const GLSL_HEADER = `
    precision mediump float;
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec2 iVideoResolution;
    uniform sampler2D iChannel0;
    uniform float iMix;
    uniform float uMainFXGain;
    
    // Uniforms for 5 Additive FX slots
    uniform float uFX1; uniform float uFX2; uniform float uFX3; uniform float uFX4; uniform float uFX5;
    uniform int uFX1_ID; uniform int uFX2_ID; uniform int uFX3_ID; uniform int uFX4_ID; uniform int uFX5_ID;

    // --- UTILS ---
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
        return rand(p); // Placeholder for simple noise
    }

    vec2 getUV(vec2 fragCoord) {
        vec2 uv = fragCoord / iResolution.xy;
        
        if(iVideoResolution.x < 1.0) return uv;
        
        // Crop / Cover logic
        float sR = iResolution.x / iResolution.y;
        float vR = iVideoResolution.x / iResolution.y;
        vec2 scale = vec2(1.0); 
        vec2 offset = vec2(0.0);

        if(sR > vR) { scale.x = sR / vR; offset.x = (1.0 - scale.x) * 0.5; } 
        else { scale.y = vR / sR; offset.y = (1.0 - scale.y) * 0.5; }
        
        return (uv - offset) / scale;
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
    
    // --- ADDITIVE FX PIPELINE ---
    // Now respects baseCol to allow stacking
    vec4 applySingleFX(vec4 baseCol, vec2 uv, float fxLevel, int fxID) {
        if (fxLevel < 0.001 || fxID == 0) return baseCol; 
        
        // Amount is direct fxLevel (0.0 to 2.0)
        float amt = fxLevel; 
        vec4 outCol = baseCol;

        // --- GROUP 1: DISTORTIONS (Must sample video, but try to blend) ---
        
        // 1. RGB Shift (Glitch)
        if (fxID == 1) { 
            float off = amt * 0.05;
            float r = getVideo(uv + vec2(off, 0.0)).r; 
            float b = getVideo(uv - vec2(off, 0.0)).b; 
            // We preserve the Green from the incoming baseCol to keep previous color fx
            outCol = vec4(r, baseCol.g, b, 1.0);
        }
        // 3. Glitch Lines (Glitch)
        else if (fxID == 3) {
            float shift = step(0.90, sin(uv.y * 50.0 + iTime * 20.0)) * amt * 0.2;
            vec4 glitchSample = getVideo(uv + vec2(shift, 0.0));
            // Mix based on intensity - BOOSTED
            outCol = mix(baseCol, glitchSample, clamp(0.5 + amt * 0.5, 0.0, 1.0)); 
        }
        // 4. Pixelate (Digital)
        else if (fxID == 4) {
            float pixels = 300.0 - (amt * 290.0); // 300 -> 10
            if (pixels < 1.0) pixels = 1.0;
            vec2 p = floor(uv * pixels) / pixels;
            // Force replace because pixelation obscures detail
            outCol = getVideo(p); 
            // Apply previous color tint to the pixelated result
            outCol.rgb *= (baseCol.rgb + 0.2); 
        }
        // 6. Kaleidoscope (Psychedelic)
        else if (fxID == 6) {
            vec2 p = uv * 2.0 - 1.0;
            float angle = amt * 3.14;
            float s = sin(angle); float c = cos(angle);
            p = mat2(c, -s, s, c) * p;
            p = abs(p);
            outCol = mix(baseCol, getVideo(p * 0.5 + 0.5), clamp(amt * 1.5, 0.0, 1.0));
        }
        // 7. VHS Retro (Glitch/Steampunk)
        else if (fxID == 7) {
            // Increased noise intensity
            float noise = rand(uv + vec2(0.0, iTime)) * amt * 0.6;
            // Chromatic aberration vertical
            float yOff = amt * 0.03;
            outCol.r = baseCol.r + noise;
            outCol.b = baseCol.b; 
            outCol.g = texture2D(iChannel0, uv + vec2(0.0, yOff)).g;
            
            // Add subtle scanline drift
            float drift = sin(uv.y * 10.0 + iTime * 2.0) * amt * 0.1;
            outCol.rgb += drift;
        }

        // --- NEW ADDITIONS (22+) ---

        // 22. FISHEYE LENS
        else if (fxID == 22) {
            vec2 p = uv * 2.0 - 1.0;
            float d = length(p);
            float bind = max(0.0, amt * 0.5); // Strength
            // Barrel distortion
            vec2 uv2 = uv + (p * pow(d, 2.0) * bind);
            outCol = getVideo(uv2);
            // Vignette for fisheye
            outCol.rgb *= 1.0 - (dot(p, p) * bind * 0.5);
        }

        // 23. ZOOM PULSE (Dynamic)
        else if (fxID == 23) {
            // Zoom centered
            vec2 pivot = vec2(0.5);
            // Pulse effect based on amount
            float pulse = sin(iTime * 10.0) * 0.1 * amt;
            float zoom = amt * 0.5 + pulse; // Base zoom + pulse
            vec2 zoomedUV = (uv - pivot) * (1.0 - zoom) + pivot;
            outCol = getVideo(zoomedUV);
        }

        // 24. GLITCH DIGITAL (Blocky)
        else if (fxID == 24) {
             float blocks = 10.0;
             vec2 blockUV = floor(uv * blocks) / blocks;
             float r = rand(blockUV + floor(iTime * 15.0));
             if (r < amt * 0.5) {
                 float shift = (r - 0.5) * 0.5;
                 outCol = getVideo(uv + vec2(shift, 0.0));
                 outCol.rgb += 0.2; // flash
             }
        }

        // 25. GLITCH ANALOG (Tearing)
        else if (fxID == 25) {
             float y = floor(uv.y * 50.0); // Scanlines
             float shift = sin(y * 13.2 + iTime * 20.0) * amt * 0.1;
             shift *= step(0.8, sin(iTime * 5.0 + y)); // Random bursts
             vec4 c = getVideo(uv + vec2(shift, 0.0));
             c.r = getVideo(uv + vec2(shift + amt*0.02, 0.0)).r;
             c.b = getVideo(uv + vec2(shift - amt*0.02, 0.0)).b;
             outCol = c;
        }

        // 26. MIRROR QUAD
        else if (fxID == 26) {
            vec2 p = abs(uv * 2.0 - 1.0);
            outCol = mix(baseCol, getVideo(p), clamp(amt, 0.0, 1.0));
        }

        // --- GROUP 2: COLOR FILTERS (Operate on outCol directly) ---

        // 2. Invert
        if (fxID == 2) {
            outCol.rgb = mix(outCol.rgb, 1.0 - outCol.rgb, amt);
        }
        // 5. Bright Flash / Strobe
        else if (fxID == 5) {
            outCol.rgb += amt * 1.2; // Boosted brightness
        }
        // 8. Steam Color (Steampunk)
        else if (fxID == 8) {
            // Sepia / Bronze tint
            float gray = dot(outCol.rgb, vec3(0.299, 0.587, 0.114));
            vec3 sepia = vec3(gray * 1.2, gray * 1.0, gray * 0.8) * vec3(1.1, 0.8, 0.5); // Bronze
            // Aggressive mixing
            outCol.rgb = mix(outCol.rgb, sepia, clamp(amt * 1.2, 0.0, 1.0));
            // Vignette
            float vig = 1.0 - length(uv - 0.5) * amt * 1.2;
            outCol.rgb *= vig;
        }
        // 9. Scanlines (Cyber/Steampunk)
        else if (fxID == 9) {
            float lines = sin(uv.y * 800.0) * 0.5 + 0.5;
            // Make lines darker based on amt
            outCol.rgb *= (1.0 - lines * clamp(amt, 0.0, 0.9));
        }

        return outCol;
    }
    
    vec4 applyAdditiveFX(vec4 baseCol, vec2 uv) {
        vec4 col = baseCol;
        
        // Additive Pipeline - Order matters!
        col = applySingleFX(col, uv, uFX1, uFX1_ID);
        col = applySingleFX(col, uv, uFX2, uFX2_ID); 
        col = applySingleFX(col, uv, uFX3, uFX3_ID); 
        col = applySingleFX(col, uv, uFX4, uFX4_ID);
        col = applySingleFX(col, uv, uFX5, uFX5_ID);

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
    // New Additive
    '7_VHS_RETRO': { id: 7, src: BASE_SHADER_BODY },
    '8_STEAM_COLOR': { id: 8, src: BASE_SHADER_BODY },
    '9_SCANLINES': { id: 9, src: BASE_SHADER_BODY },
    // NEW BATCH (User Request)
    '22_FISHEYE_LENS': { id: 22, src: BASE_SHADER_BODY },
    '23_ZOOM_PULSE': { id: 23, src: BASE_SHADER_BODY },
    '24_GLITCH_DIGITAL': { id: 24, src: BASE_SHADER_BODY },
    '25_GLITCH_ANALOG': { id: 25, src: BASE_SHADER_BODY },
    '26_MIRROR_QUAD': { id: 26, src: BASE_SHADER_BODY },

    
    // --- MAIN SCENES (COMPLEX - ID > 100 for safety/logic separation, though logic uses ID check) ---
    '100_GLITCH_SCENE': { id: 100, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); float s=step(0.8,sin(iTime*15.))*uMainFXGain*0.5; vec4 c=getVideo(uv+vec2(s,0)); c.g=getVideo(uv+vec2(s*1.5,0)).g; gl_FragColor=applyAdditiveFX(mix(c, getVideo(uv), 1.0-iMix), uv); }` },
    '101_TUNNEL_WARP': { id: 101, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 p=(uv*2.-1.)*(1.0 + uMainFXGain*1.5); float r=length(p); float a=atan(p.y,p.x); a+=sin(r*20.0-iTime*5.0)*uMainFXGain; p=r*vec2(cos(a),sin(a)); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(p*0.5+0.5), iMix), uv); }` },
    '102_NEON_EDGES': { id: 102, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 d=1./iResolution; vec4 c=getVideo(uv); float e=distance(c,getVideo(uv+vec2(d.x,0)))+distance(c,getVideo(uv+vec2(0,d.y))); e=smoothstep(0.1,0.4,e)*iMix*8.*uMainFXGain; gl_FragColor=applyAdditiveFX(mix(c,vec4(vec3(e)*vec3(1,0.2,1),1),0.5), uv); }` },
    '103_COLOR_SHIFT': { id: 103, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec4 c=getVideo(uv); float hueShift = sin(iTime*0.5)*uMainFXGain*2.0; c.rgb = mod(c.rgb + hueShift, 1.0); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), c, iMix), uv); }` },
    '104_MIRROR_X': { id: 104, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 m=abs(uv*2.-1.); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(m*0.5+0.5), iMix * clamp(uMainFXGain+0.5, 0.0, 1.0)), uv); }` },
    '105_WAVE_VERT': { id: 105, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 distUv = uv; distUv.x += sin(uv.y * 30.0 + iTime * 5.0) * 0.1 * uMainFXGain; gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(distUv), iMix), uv); }` },
    
    // Complex V2
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

    // --- ZOOM FX SCENES ---
    '109_ZOOM_TOP': { id: 109, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        // Pivot at Top Center (0.5, 0.9) to focus on face
        vec2 pivot = vec2(0.5, 0.9);
        // Zoom Factor based on beat
        float z = 0.5 * uMainFXGain; // Max zoom 50%
        vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;
        
        // Mix between original and zoomed based on mix
        vec4 c = getVideo(mix(uv, zoomedUV, iMix));
        gl_FragColor = applyAdditiveFX(c, uv);
    }` },
    '110_ZOOM_BTM': { id: 110, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        // Pivot at Bottom Center (0.5, 0.1) to focus on legs/shoes
        vec2 pivot = vec2(0.5, 0.1);
        float z = 0.5 * uMainFXGain;
        vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;
        vec4 c = getVideo(mix(uv, zoomedUV, iMix));
        gl_FragColor = applyAdditiveFX(c, uv);
    }` },
    '111_ZOOM_CTR': { id: 111, src: `void main(){ 
        vec2 uv=getUV(gl_FragCoord.xy);
        // Pivot Center (0.5, 0.5)
        vec2 pivot = vec2(0.5, 0.5);
        float z = 0.4 * uMainFXGain;
        vec2 zoomedUV = (uv - pivot) * (1.0 - z) + pivot;
        
        // Add a bit of rotation for 'Center' style
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
