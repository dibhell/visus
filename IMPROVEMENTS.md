# VISUS Experimental - Status i kierunki prac

## Co zostało zrobione
- Render przeniesiony do workera z OffscreenCanvas (`RenderWorker` + `FastGLService`) z fallbackiem.
- Adaptacyjne LOD (renderScale) zależne od FPS.
- Nagrywanie WebCodecs (prefer HW) + fallback MediaRecorder (WebM).
- Audio: osobny `vizAnalyser`, tap-y prefader, filtry pasmowe sync1/2/3 z analyserem 256 i smoothingiem 0.55 + wygładzanie bandLevels (35%), FFT fallback clamp 1, szybkie VU (`getLevelsFast`).
- Spektrum: hi-res FFT (16384) z biasem na bas, sampler max w oknie log-freq, auto-gain bez progu, fallback na bands; drag punktów stabilny, blokada globalnego scrolla przy kręceniu width/Q.
- Sterowanie FX: routing Bass/Mid/High/BPM/manual, Wet/Dry w pakiecie FX do renderera/worker; debug overlay/log wyłączony.
- Performance: dynamiczny frame cap (auto 60→30→24), Performance Mode (FFT co 1/2/3 klatki), limiter UI/VU (20 FPS), Ultra Low renderScale + lock 0.5x, HUD z dt/mode/cap.
- UI: Performance Lab uporządkowane (Pipeline checkboxy z nagłówkami), panel Auto gain/Shape w spektrum stale widoczny; nowa ikona + favicon.
- Startup: flagi diagnostyczne `debug_nogl`/`debug_noaudio`/`debug_noworker`, logi `[VISUS] init ...`, Error Boundary dla `ExperimentalAppFull`, tworzenie FastGL/Audio w `useEffect`.

## Obecne problemy
- Do potwierdzenia live: czułość audio-reactive (FX sufit 24, VU 10, smoothing 30/35%) na Bass/Mid/High; możliwe drobne korekty mnożników/alpha/clamp.
- Sprawdzić, czy smoothing bandów/fftSize 256 (smoothing 0.45, wygładzanie ~50%) jest optymalne przy różnych freq/width i źródłach; ewentualnie doprecyzować.
- Potwierdzić nagrywanie (audio w WebM) i wydajność po zmianach mapowania/smoothingu.
- WebGL: zbić liczbę wywołań uniformów (tablice uFX + uniform1fv/2fv), kompilować shadery tylko przy zmianie presetów.

## Plan naprawy FX/spectrum (kolejność)
1) Test manualny: muzyka z wyraźnym Bass/Mid/High, routing slotów Bass/Mid/High, obserwacja VU i efektów.
2) Sprawdzić nowe spektrum (FFT max sampler) na głośnym basie/hi-hat; w razie potrzeby stroić boostExp/boostMult w panelu.
3) Ewentualne korekty mapowania (multiplier/alpha/clamp) i band analyserów po testach.
4) Build + smoke nagrywania.

## Zadania do patcha (skrót)
- Zestroić czułość po testach live (FX/VU smoothing, clamp 24/10).
- Zweryfikować bandpass vs. FFT fallback na różnych freq/width.
- `npm run build` po finalnym strojeniu.

## Test wydajno?ci / profilowanie
- Za?aduj d?ugi klip 1080p i w??cz kilka FX.
- Ustaw Performance Mode na medium/low, Auto Scale on; obserwuj HUD (FPS, dt, renderScale, cap).
- Loguj FPS/scale przez 30?60 s; sprawd? czy FPS nie spada katastrofalnie i skala nie oscyluje agresywnie.
- Sprawd? lock resolution 0.5x na s?abym GPU oraz dynamiczny frame cap (60?30?24).

## Tryby renderowania (diagnostyka)
- `webgl-worker` – preferowany w trybie auto; OffscreenCanvas + worker, gdy host pozwala.
- `webgl-fastgl` – główny wątek z FastGLService, używany gdy worker jest wyłączony (`render=webgl` lub `worker=0`) albo worker init się nie powiedzie.
- `canvas2d` – fallback lub wymuszenie (`render=canvas` albo `fx=0`/`visus_fx=off`); żadnych prób WebGL.
- Parametry:
- `render=auto|webgl|canvas` (URL lub `localStorage.visus_render`),
- `worker=0/1` (URL lub `localStorage.visus_worker`) – wyłącza worker w trybie auto,
- `fx=0/1` lub `localStorage.visus_fx=off/on` – wymusza Canvas2D lub WebGL/FX.
- Startup/diag:
  - `debug_nogl=1`, `debug_noaudio=1`, `debug_noworker=1` (kombinacje) do izolacji modułu powodującego OOM/freeze.
- Dev overlay (`dev=1` lub `localStorage.visus_dev=1`) pokazuje renderMode, wynik probe webgl2/webgl, przyczynę fallbacku i ostatni błąd shadera.
