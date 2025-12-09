import React, { useEffect, useRef, useState } from 'react';

const WebGLTest: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<string>('waiting');
    const [probe, setProbe] = useState<{ webgl2: boolean; webgl: boolean }>({ webgl2: false, webgl: false });
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const tryWebGL = () => {
            try {
                const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
                const gl1 = canvas.getContext('webgl') as WebGLRenderingContext | null;
                setProbe({ webgl2: !!gl2, webgl: !!gl1 });
                console.info('[VISUS][test] webgl2 available:', !!gl2);
                console.info('[VISUS][test] webgl available:', !!gl1);

                const gl = (gl2 as unknown as WebGLRenderingContext) || gl1;
                if (!gl) {
                    setStatus('No WebGL context (webgl/webgl2 both null)');
                    return;
                }

                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.clearColor(0.1, 0.2, 0.5, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                setStatus(`WebGL OK (${gl2 ? 'webgl2' : 'webgl'})`);
            } catch (err: any) {
                console.error('[VISUS][test] WebGL exception:', err);
                setError(err?.message || String(err));
                setStatus('Exception while initializing WebGL');
            }
        };

        tryWebGL();
    }, []);

    return (
        <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black tracking-tight">VISUS WebGL Test</h1>
                <p className="text-sm text-slate-400">Standalone check: webgl2 / webgl availability and simple clear color.</p>
                <div className="text-xs font-mono text-slate-300 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
                    <div>webgl2: {probe.webgl2 ? 'true' : 'false'}</div>
                    <div>webgl: {probe.webgl ? 'true' : 'false'}</div>
                    <div>status: {status}</div>
                    {error && <div className="text-red-300">error: {error}</div>}
                </div>
            </div>
            <canvas ref={canvasRef} width={640} height={360} className="border border-white/10 rounded-xl shadow-2xl bg-black" />
        </div>
    );
};

export default WebGLTest;
