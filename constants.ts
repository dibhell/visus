
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

    vec2 getUV(vec2 fragCoord) {
        vec2 uv = fragCoord / iResolution.xy;
        vec2 center = vec2(0.5);
        
        // Zoom/Pulse Logic could be injected here via uFX modulation if needed globally
        
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
        if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) return vec4(0,0,0,1);
        
        if(iVideoResolution.x < 2.0) { // Fallback plasma/noise if no video
            float t = iTime; vec2 p = uv*10.0;
            float v = sin(p.x+t*0.5) + sin(p.y+t*0.7) + sin(p.x+p.y+t*0.9);
            return vec4(vec3(0.1)+vec3(0.5*sin(v), 0.2*sin(v+2.0), 0.8*sin(v+4.0)), 1.0);
        }
        return texture2D(iChannel0, uv);
    }
    
    vec4 applySingleFX(vec4 baseCol, vec2 uv, float fxLevel, int fxID) {
        // Threshold to save performance, but keep it low
        if (fxLevel < 0.001 || fxID == 0) return baseCol; 
        
        vec4 resultCol = baseCol;
        
        // FIX: Removed the * 0.2 damper. Now fxLevel (0.0 to ~2.0) maps directly to intensity.
        // Users should use the Gain slider to reduce intensity.
        float amt = fxLevel; 

        // 1. RGB Shift 
        if (fxID == 1) { 
            resultCol.r = getVideo(uv + vec2(amt * 0.05, 0.0)).r; 
            resultCol.b = getVideo(uv - vec2(amt * 0.05, 0.0)).b; 
            return resultCol;
        }
        // 2. Invert
        if (fxID == 2) {
            vec4 inverted = vec4(1.0 - baseCol.rgb, 1.0);
            return mix(baseCol, inverted, amt); // Full mix possible
        }
        // 3. Glitch Lines
        if (fxID == 3) {
            float shift = step(0.90, sin(uv.y * 80.0 + iTime * 30.0)) * amt * 0.3;
            resultCol = getVideo(uv + vec2(shift, 0.0));
            return mix(baseCol, resultCol, 0.9); // Glitch is usually opaque
        }
        // 4. Pixelate
        if (fxID == 4) {
            float t = 200.0 - (amt * 190.0); // Range from 200 (fine) to 10 (blocky)
            if (t < 1.0) t = 1.0;
            vec2 p = floor(uv * t) / t;
            return getVideo(p);
        }
        // 5. Bright Flash (Strobe)
        if (fxID == 5) {
            resultCol.rgb += amt; 
            return resultCol;
        }
        // 6. Kaleidoscope
        if (fxID == 6) {
            vec2 p = abs(uv * 2.0 - 1.0);
            // Spin logic
            float angle = amt * 3.14;
            float s = sin(angle);
            float c = cos(angle);
            p = mat2(c, -s, s, c) * p;
            return mix(baseCol, getVideo(p * 0.5 + 0.5), amt);
        }
        return baseCol;
    }
    
    vec4 applyAdditiveFX(vec4 baseCol, vec2 uv) {
        vec4 col = baseCol;
        
        // Apply slots sequentially (Additive pipeline)
        col = applySingleFX(col, uv, uFX1, uFX1_ID);
        col = applySingleFX(col, uv, uFX2, uFX2_ID); 
        col = applySingleFX(col, uv, uFX3, uFX3_ID); 
        col = applySingleFX(col, uv, uFX4, uFX4_ID);
        col = applySingleFX(col, uv, uFX5, uFX5_ID);

        return col;
    }
`;

const BASE_SHADER_BODY = `void main(){ gl_FragColor=applyAdditiveFX(getVideo(getUV(gl_FragCoord.xy)), getUV(gl_FragCoord.xy)); }`;

// IDs 1-9 are Simple (Additive)
// IDs 10+ are Complex (Main)
export const SHADER_LIST: ShaderList = {
    '00_NONE': { id: 0, src: BASE_SHADER_BODY },
    
    // Simple (Additive Safe)
    '1_RGB_SHIFT': { id: 1, src: BASE_SHADER_BODY },
    '2_INVERT_COLOR': { id: 2, src: BASE_SHADER_BODY },
    '3_GLITCH_LINES': { id: 3, src: BASE_SHADER_BODY },
    '4_PIXELATE': { id: 4, src: BASE_SHADER_BODY },
    '5_BRIGHT_FLASH': { id: 5, src: BASE_SHADER_BODY },
    '6_KALEIDO_4X': { id: 6, src: BASE_SHADER_BODY },
    
    // Complex (Main Only) - Using uMainFXGain to modulate intensity
    '10_GLITCH_SCENE': { id: 10, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); float s=step(0.8,sin(iTime*15.))*uMainFXGain*0.3; vec4 c=getVideo(uv+vec2(s,0)); c.g=getVideo(uv+vec2(s*1.5,0)).g; gl_FragColor=applyAdditiveFX(mix(c, getVideo(uv), 1.0-iMix), uv); }` },
    '11_TUNNEL_WARP': { id: 11, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 p=(uv*2.-1.)*(1.0 + uMainFXGain*0.8); float r=length(p); float a=atan(p.y,p.x); a+=sin(r*20.0-iTime*5.0)*uMainFXGain*0.5; p=r*vec2(cos(a),sin(a)); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(p*0.5+0.5), iMix), uv); }` },
    '12_NEON_EDGES': { id: 12, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 d=1./iResolution; vec4 c=getVideo(uv); float e=distance(c,getVideo(uv+vec2(d.x,0)))+distance(c,getVideo(uv+vec2(0,d.y))); e=smoothstep(0.1,0.4,e)*iMix*5.*uMainFXGain; gl_FragColor=applyAdditiveFX(mix(c,vec4(vec3(e)*vec3(1,0.2,1),1),0.5), uv); }` },
    '13_COLOR_SHIFT': { id: 13, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec4 c=getVideo(uv); float hueShift = sin(iTime*0.5)*uMainFXGain; c.rgb = mod(c.rgb + hueShift, 1.0); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), c, iMix), uv); }` },
    '14_MIRROR_X': { id: 14, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 m=abs(uv*2.-1.); gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(m*0.5+0.5), iMix * clamp(uMainFXGain+0.5, 0.0, 1.0)), uv); }` },
    '15_WAVE_VERT': { id: 15, src: `void main(){ vec2 uv=getUV(gl_FragCoord.xy); vec2 distUv = uv; distUv.x += sin(uv.y * 30.0 + iTime * 5.0) * 0.05 * uMainFXGain; gl_FragColor=applyAdditiveFX(mix(getVideo(uv), getVideo(distUv), iMix), uv); }` },
};

export const VERT_SRC = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
