# VISUS Experimental — Status i kierunki prac

## Co zostało zrobione
- Render przeniesiony do workera z OffscreenCanvas (`RenderWorker` + `FastGLService`) z fallbackiem.
- Adaptacyjne LOD (renderScale) zależne od FPS.
- Nagrywanie WebCodecs (prefer HW) + fallback MediaRecorder (WebM).
- Audio: osobny `vizAnalyser`, tap-y prefader, filtry pasmowe sync1/2/3, szybkie VU (`getLevelsFast`).
- Sterowanie FX: routing Bass/Mid/High/BPM/manual, Wet/Dry w pakiecie FX do renderera/worker.

## Obecne problemy
- Czułość FX/VU jest mocno podbita (mapowanie liniowe *60/*12); trzeba dostroić multiplier/clamp i ewentualnie smoothing.
- Debug overlay/log włączony; trzeba go usunąć po walidacji działania.
- BandLevels zależą od FFT fallbacku – sprawdzić filtry bandpass i docelowe parametry freq/width/smoothing.

## Plan naprawy FX (kolejność)
1) Strojenie mapowania: zmniejszyć multiplier/clamp, ewentualnie dodać lekkie smoothing VU po potwierdzeniu reakcji.
2) Usunąć debug overlay/log po walidacji bandLevels/FxVu.
3) Zweryfikować filtry bandpass vs. FFT fallback (freq/width/smoothing) i ustalić docelowe parametry.
4) Test manualny: muzyka z wyraźnym Bass/Mid/High, routing slotów Bass/Mid/High, obserwacja VU i efektów.

## Zadania do patcha (skrót)
- Instrumentacja bandLevels/fxVuLevels (overlay/log).
- Naprawa zamrożonego VU: upewnić się, że state/ref się aktualizują, brak zbędnego throttlingu.
- Strojenie mapowania FX (pow/multiplier/clamp) po odblokowaniu VU.
- `npm run build` po fixie.
