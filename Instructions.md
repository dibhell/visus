# Instructions - strojenie FX/VU (stan 0.2.7)

Cel: potwierdzić nowe strojenie audio-reactive i hi-res spectrum; overlay/log wyłączony.

0) Startup debug (INITIALIZE/OOM)
- Jeśli występuje zawieszenie po INITIALIZE, użyj flag: `debug_nogl=1`, `debug_noaudio=1`, `debug_noworker=1` (kombinacje) i sprawdź logi `[VISUS] init start ...` (GL/Audio/Worker) oraz Error Boundary.

1) Czułość/mapowanie
- FX: pow(0.7) + smoothing 35%, sufit 24; VU: pow(0.8) + smoothing 45%, sufit 10. Sprawdź na Bass/Mid/High i ewentualnie skoryguj mnożnik/alpha/clamp.
- Spektrum: hi-res FFT (16384) z biasem na bas, sampler max w oknie log-freq, auto-gain bez progu; fallback używa bands. Panel Auto gain/Shape stale widoczny.
- Spektrum (Auto gain – default):
  targetPeak = 1.0
  minPeak = 0.30
  maxGain = 20.0
  boostExp = 2.0
  boostMult = 0.6
  minHeightFrac = 0.0
  maxHeightFrac = 0.81

2) Filtry/FFT
- Bandpass (sync1/2/3) z analyserem 256, smoothing 0.45 + wewnętrzne wygładzanie (~50%). Przetestuj różne freq/width vs FFT fallback; upewnij się, że pk > 0 i linia reaguje.

3) Testy
- Manual: tryb Experimental, routing FX na Bass/Mid/High, obserwacja VU/Depth + spektrum; upewnij się, że smoothing nie laguje UI.
- Przed releasem: `npm run build` + krótki smoke nagrywania (MediaRecorder/WebCodecs) z weryfikacją ścieżki audio w WebM.
