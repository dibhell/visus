# VISUS Experimental - Status i kierunki prac

## Co zosta?o zrobione
- Render przeniesiony do workera z OffscreenCanvas (`RenderWorker` + `FastGLService`) z fallbackiem.
- Adaptacyjne LOD (renderScale) zale?ne od FPS.
- Nagrywanie WebCodecs (prefer HW) + fallback MediaRecorder (WebM).
- Audio: osobny `vizAnalyser`, tap-y prefader, filtry pasmowe sync1/2/3 z analyserem 256 i smoothingiem 0.55 + wyg?adzanie bandLevels (35%), FFT fallback clamp 1, szybkie VU (`getLevelsFast`).
- Sterowanie FX: routing Bass/Mid/High/BPM/manual, Wet/Dry w pakiecie FX do renderera/worker; debug overlay/log wy??czony.

## Obecne problemy
- Do potwierdzenia live: czułość audio-reactive (FX sufit 24, VU 10, smoothing 30/35%) na Bass/Mid/High; możliwe drobne korekty mnożników/alpha/clamp.
- Sprawdzić, czy smoothing bandów/fftSize 256 (smoothing 0.45, wygładzanie ~50%) jest optymalne przy różnych freq/width i źródłach; ewentualnie doprecyzować.
- Potwierdzić nagrywanie (audio w WebM) i wydajność po zmianach mapowania/smoothingu.

## Plan naprawy FX (kolejno??)
1) Test manualny: muzyka z wyra?nym Bass/Mid/High, routing slot?w Bass/Mid/High, obserwacja VU i efekt?w.
2) Ewentualne korekty mapowania (multiplier/alpha/clamp) i band analyser?w po testach.
3) Build + smoke nagrywania.

## Zadania do patcha (skrót)
- Zestroić czułość po testach live (FX/VU smoothing, clamp 24/10).
- Zweryfikować bandpass vs. FFT fallback na różnych freq/width.
- `npm run build` po finalnym strojeniu.

## Tryby renderowania (diagnostyka)
- `webgl-worker` – preferowany w trybie auto; OffscreenCanvas + worker, gdy host pozwala.
- `webgl-fastgl` – główny wątek z FastGLService, używany gdy worker jest wyłączony (`render=webgl` lub `worker=0`) albo worker init się nie powiedzie.
- `canvas2d` – fallback lub wymuszenie (`render=canvas` albo `fx=0`/`visus_fx=off`); żadnych prób WebGL.
- Parametry:
  - `render=auto|webgl|canvas` (URL lub `localStorage.visus_render`),
  - `worker=0/1` (URL lub `localStorage.visus_worker`) – wyłącza worker w trybie auto,
  - `fx=0/1` lub `localStorage.visus_fx=off/on` – wymusza Canvas2D lub WebGL/FX.
- Dev overlay (`dev=1` lub `localStorage.visus_dev=1`) pokazuje renderMode, wynik probe webgl2/webgl, przyczynę fallbacku i ostatni błąd shadera.
