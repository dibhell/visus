(function () {
  const runBenchmark = (opts = {}) => {
    const durationSec = opts.durationSec || 30;
    const metrics = window.__VISUS_METRICS__;
    if (!metrics) {
      console.warn('[VISUS] benchmark: __VISUS_METRICS__ hook not found. Load ExperimentalApp first.');
      return;
    }

    const samples = [];
    const start = performance.now();
    let last = start;

    const tick = (now) => {
      const dt = now - last;
      last = now;
      samples.push({
        t: Number((now - start).toFixed(2)),
        dt: Number(dt.toFixed(3)),
        fps: Number((1000 / Math.max(1, dt)).toFixed(2)),
        renderScale: metrics.renderScaleRef?.current,
        performanceMode: metrics.performanceModeRef?.current,
        renderMode: metrics.renderModeRef?.current,
        autoScale: metrics.autoScaleRef?.current,
        quality: metrics.qualityRef?.current
      });

      if (now - start < durationSec * 1000) {
        requestAnimationFrame(tick);
      } else {
        const fpsAvg = samples.reduce((acc, s) => acc + s.fps, 0) / Math.max(1, samples.length);
        const summary = {
          avgFps: Number(fpsAvg.toFixed(2)),
          minFps: Math.min(...samples.map((s) => s.fps)),
          maxFps: Math.max(...samples.map((s) => s.fps)),
          durationMs: Number((now - start).toFixed(0)),
          samples: samples.length,
          renderMode: metrics.renderModeRef?.current,
          performanceMode: metrics.performanceModeRef?.current
        };
        const report = { summary, samples };
        console.log('[VISUS] benchmark summary', summary);
        try {
          localStorage.setItem('visus_benchmark', JSON.stringify(report));
        } catch (err) {
          console.warn('Unable to persist benchmark report', err);
        }
      }
    };

    requestAnimationFrame(tick);
  };

  window.runVisusBenchmark = runBenchmark;
})();
