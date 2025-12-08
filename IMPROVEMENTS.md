# VISUS Experimental - Status i kierunki prac

## Co zostalo zrobione
- Render przeniesiony do workera z OffscreenCanvas (`RenderWorker` + `FastGLService`) z fallbackiem.
- Adaptacyjne LOD (`renderScale`) zalezne od FPS.
- Nagrywanie WebCodecs (prefer HW) + fallback MediaRecorder (WebM).
- Audio: osobny `vizAnalyser`, tap-y prefader, filtry pasmowe sync1/2/3 z analyserem 256 i smoothingiem 0.45 + wygladzanie bandLevels (50%), FFT/time-domain fallback, szybkie VU (`getLevelsFast`).
- Sterowanie FX: routing Bass/Mid/High/BPM/manual, Wet/Dry w pakiecie FX do renderera/worker; debug overlay/log wylaczony.
- Perf renderu: clamp canvasu do 1920x1080 (zachowuje aspect) + kesz uniform/attrib w `GLService` (mniej `getUniformLocation` per frame, flip ustawiony w init).
- Perf UI/nagrywania: VU tick co ~200 ms, FPS/visual co ~250 ms, `canvas.captureStream(24)` w nagrywaniu (MediaRecorder 12 Mbps / 192 kbps).

## Obecne problemy
- Do potwierdzenia live: czulosc audio-reactive (mapa FX: pow 0.4 * 14 + 0.4 offset, clamp 18; VU: pow 0.5, clamp 1.5) na Bass/Mid/High i BPM; ewentualna korekta gainow/alpha.
- Sprawdzic smoothing bandow/analyser (256, smoothing 0.45, blending 50%) vs FFT/time fallback przy roznych freq/width; doprecyzowac jesli pasma sa zbyt leniwe.
- Potwierdzic nagrywanie (audio w WebM) i wydajnosc po clampie 1080p i 24 fps capture na 4K/ultra-wide.

## Plan naprawy FX (kolejnosc)
1) Test manualny: muzyka z wyraznym Bass/Mid/High, routing slotow Bass/Mid/High/BPM, obserwacja VU i efektow.
2) Korekty mapowania (multiplier/alpha/clamp) i band analyserow po testach.
3) Build + smoke nagrywania (MediaRecorder/WebCodecs) z potwierdzeniem audio tracku.

## Zadania do patcha (skrot)
- Zestroic czulosc po testach live (FX mapowanie pow 0.4, clamp 18; VU pow 0.5, clamp 1.5; tick 200/250 ms).
- Zweryfikowac bandpass vs FFT fallback na roznych freq/width.
- Sprawdzic clamp 1080p na 4K/ultra-wide i 24 fps capture (stabilnosc bitrate).
- `npm run build` po finalnym strojeniu.
