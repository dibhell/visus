# Instructions - strojenie FX/VU (stan 0.2.7)

Cel: potwierdzic nowe strojenie audio-reactive i hi-res spectrum; overlay/log wylaczony.

0) Startup debug (INITIALIZE/OOM)
- Jesli pojawia sie freeze po INITIALIZE, uzyj flag: `debug_nogl=1`, `debug_noaudio=1`, `debug_noworker=1` (kombinacje) i sprawdz logi `[VISUS] init start ...` (GL/Audio/Worker) oraz Error Boundary.

1) Czulosc/mapowanie
- FX: pow(0.7) + smoothing 35%, sufit 24; VU: pow(0.8) + smoothing 45%, sufit 10. Sprawdz na Bass/Mid/High; w razie potrzeby skoryguj mnoznik/alpha/clamp.
- Spektrum: hi-res FFT (16384) z biasem na bas, sampler max w oknie log-freq, auto-gain bez progu; fallback uzywa bands. Panel Auto gain/Shape stale widoczny.
- Spektrum (Auto gain default):
  targetPeak = 1.0  
  minPeak = 0.30  
  maxGain = 20.0  
  boostExp = 2.0  
  boostMult = 0.6  
  minHeightFrac = 0.0  
  maxHeightFrac = 0.81

2) Filtry/FFT
- Bandpass (sync1/2/3) z analyserem 256, smoothing 0.45 + ~50% wygladzania. Przetestuj rozne freq/width vs FFT fallback; upewnij sie, ze pk > 0 i linia reaguje.

3) Testy
- Manual: tryb Experimental, routing FX na Bass/Mid/High, obserwacja VU/Depth + spektrum; upewnij sie, ze smoothing nie laguje UI.
- Przed releasem: `npm run build` + krotki smoke nagrywania (MediaRecorder/WebCodecs) z weryfikacja sciezki audio w WebM.
