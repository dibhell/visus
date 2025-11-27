# VISUS Experimental — Status i kierunki prac

## Co zostało zrobione
- Render przeniesiony do workera z OffscreenCanvas (`RenderWorker` + `FastGLService`) z fallbackiem.
- Adaptacyjne LOD (renderScale) zależne od FPS.
- Nagrywanie WebCodecs (prefer HW) + fallback MediaRecorder (WebM).
- Audio: osobny `vizAnalyser`, tap-y prefader, filtry pasmowe sync1/2/3, szybkie VU (`getLevelsFast`).
- Sterowanie FX: routing Bass/Mid/High/BPM/manual, Wet/Dry w pakiecie FX do renderera/worker.

## Obecne problemy
- VU w FX Chain nadal potrafi być zamrożone; bandLevels nie zawsze dochodzą do slotów.
- Modulacja Depth per pasmo jest niewiarygodna/stała mimo ruchu widma.
- UI gain/threshold dla spectrum zostało wyłączone; czułość pasm trzeba stroić w kodzie.

## Plan naprawy FX (kolejność)
1) Debug przepływu: bandLevels (Bass/Mid/High) → setFxVuLevels → FxSlot (vuLevel) i computeFxVal.
2) Dodać tymczasowy overlay/logi bandLevels i fxVuLevels w pętli renderowej, z częstym odświeżaniem (~30 ms).
3) Dostrajać mapowanie: pow < 1, multiplier i clamp tak, by VU/Depth realnie pulsowały; Depth jako max, pasmo jako bieżące sterowanie.
4) Zweryfikować, że `getActivationLevel` zwraca bieżące bandLevels (bez offsetów) oraz że setFxVuLevels jest wywoływane po każdej zmianie.
5) Test manualny: muzyka z wyraźnym Bass/Mid/High, routing slotów Bass/Mid/High, obserwacja VU i efektów.

## Zadania do patcha (skrót)
- Instrumentacja bandLevels/fxVuLevels (overlay/log).
- Naprawa zamrożonego VU: upewnić się, że state/ref się aktualizują, brak zbędnego throttlingu.
- Strojenie mapowania FX (pow/multiplier/clamp) po odblokowaniu VU.
- `npm run build` po fixie.
