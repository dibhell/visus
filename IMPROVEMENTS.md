# VISUS Experimental - Status i kierunki prac

## Co zostalo zrobione
- Render przeniesiony do workera z OffscreenCanvas (RenderWorker + FastGLService) z fallbackiem.
- Adaptacyjne LOD (renderScale) zalezne od FPS.
- Nagrywanie WebCodecs (prefer HW) + fallback MediaRecorder (WebM).
- Audio: osobny izAnalyser, tap-y prefader, filtry pasmowe sync1/2/3 z analyserem 256 i smoothingiem 0.55 + wygladzanie bandLevels (35%), FFT fallback clamp 1, szybkie VU (getLevelsFast).
- Spektrum: hi-res FFT (16384) z biasem na bas, sampler max w oknie log-freq, auto-gain bez progu, fallback na bands; drag punktow stabilny, blokada globalnego scrolla przy kreceniu width/Q.
- Sterowanie FX: routing Bass/Mid/High/BPM/manual, Wet/Dry w pakiecie FX do renderera/worker; debug overlay/log wylaczony.
- Performance: dynamiczny frame cap (auto 60->30->24), Performance Mode (FFT co 1/2/3 klatki), limiter UI/VU (20 FPS), Ultra Low renderScale + lock 0.5x, HUD z dt/mode/cap.
- UI: Performance Lab uporzadkowane (Pipeline checkboxy z naglowkami), panel Auto gain/Shape w spektrum stale widoczny; nowa ikona + favicon.
- Startup: flagi diagnostyczne debug_nogl/debug_noaudio/debug_noworker, logi [VISUS] init ..., Error Boundary dla ExperimentalAppFull, tworzenie FastGL/Audio w useEffect.

## Obecne problemy
- Do potwierdzenia live: czulosc audio-reactive (FX sufit 24, VU 10, smoothing 30/35%) na Bass/Mid/High; mozliwe drobne korekty mnoznikow/alpha/clamp.
- Sprawdzic, czy smoothing bandow/fftSize 256 (smoothing 0.45, wygladzanie ~50%) jest optymalny przy roznych freq/width i zrodlach; ewentualnie doprecyzowac.
- Potwierdzic nagrywanie (audio w WebM) i wydajnosc po zmianach mapowania/smoothingu.
- WebGL: zbic liczbe wywolan uniformow (tablice uFX + uniform1fv/2fv), kompilowac shadery tylko przy zmianie presetow.

## Plan naprawy FX/spectrum (kolejnosc)
1) Test manualny: muzyka z wyraznym Bass/Mid/High, routing slotow Bass/Mid/High, obserwacja VU i efektow.
2) Sprawdzic nowe spektrum (FFT max sampler) na glosnym basie/hi-hat; w razie potrzeby stroic boostExp/boostMult w panelu.
3) Ewentualne korekty mapowania (multiplier/alpha/clamp) i band analyserow po testach.
4) Build + smoke nagrywania.

## Zadania do patcha (skrot)
- Zestroic czulosc po testach live (FX/VU smoothing, clamp 24/10).
- Zweryfikowac bandpass vs. FFT fallback na roznych freq/width.
- 
pm run build po finalnym strojeniu.

## Test wydajnosci / profilowanie
- Zaladuj dlugi klip 1080p i wlacz kilka FX.
- Ustaw Performance Mode na medium/low, Auto Scale on; obserwuj HUD (FPS, dt, renderScale, cap).
- Loguj FPS/scale przez 30-60 s; sprawdz czy FPS nie spada katastrofalnie i skala nie oscyluje agresywnie.
- Sprawdz lock resolution 0.5x na slabym GPU oraz dynamiczny frame cap (60->30->24).

## Tryby renderowania (diagnostyka)
- webgl-worker - preferowany w trybie auto; OffscreenCanvas + worker, gdy host pozwala.
- webgl-fastgl - glowny watek z FastGLService, uzywany gdy worker jest wylaczony (
ender=webgl lub worker=0) albo worker init sie nie powiedzie.
- canvas2d - fallback lub wymuszenie (
ender=canvas albo x=0/isus_fx=off); brak prob WebGL.
- Parametry:
  - 
ender=auto|webgl|canvas (URL lub localStorage.visus_render),
  - worker=0/1 (URL lub localStorage.visus_worker) - wylacza worker w trybie auto,
  - x=0/1 lub localStorage.visus_fx=off/on - wymusza Canvas2D lub WebGL/FX.
- Startup/diag:
  - debug_nogl=1, debug_noaudio=1, debug_noworker=1 (kombinacje) do izolacji modulu powodujacego OOM/freeze.
- Dev overlay (dev=1 lub localStorage.visus_dev=1) pokazuje renderMode, wynik probe webgl2/webgl, przyczyne fallbacku i ostatni blad shadera.
