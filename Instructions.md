# Instructions — naprawa FX/VU (stan bieżący)

Cel: odblokować audio-reactive FX w trybie Experimental (VU w slotach i modulacja Depth muszą reagować na Bass/Mid/High).

1) Debug przepływu
- Dodaj tymczasowy overlay/log w pętli renderowej z bieżącymi `bandLevels` i `fxVuLevels` (Bass/Mid/High), odświeżany ~30 ms.
- Zweryfikuj, że `bandLevels` pochodzą z filtrów sync1/2/3 (bez offsetów) i trafiają do `setFxVuLevels` oraz `computeFxVal`.

2) Naprawa VU
- Upewnij się, że `setFxVuLevels` jest wywoływane po każdej zmianie bandLevels (brak zamrożenia refs/state).
- W `FxSlot` pasek używa `vuLevel` — sprawdź, że props dochodzi (main, fx1..fx5).
- Zmniejsz/wyłącz smoothing jeśli VU stoi; ewentualnie podbij multiplier/clamp dla VU.

3) Modulacja FX
- Depth traktuj jako max; bandLevels sterują bieżącą wartością. Dostrajać pow/multiplier/clamp, gdy VU ruszy.
- Test manualny: muzyka z wyraźnym Bass/Mid/High, routing slotów Bass/Mid/High, obserwacja VU i efektów.

4) Porządek
- UI gain/threshold dla spectrum jest wyłączone; strojenie czułości rób w kodzie (bandLevels → computeFxVal/VU).
- Po fixie: `npm run build`.
