# TODO – VISUS Experimental

1) Naprawa FX audio-reactive
   - Usuń duplikaty `fxVuLevels` / refów w `App.tsx` i `ExperimentalApp.tsx` (konflikt TS “Cannot redeclare…”).
   - W ExperimentalApp: dodać `fxVuLevels` state+ref, w pętli renderowej liczyć `computeFxVu` (band level * band gain, pow < 1, clamp) i ustawiać razem z `visualLevels`.
   - Przekazać `vuLevel` do `FxSlot` (dla main i layerów) – pasek ma odzwierciedlać bieżące pasmo.
   - Wzmocnić `computeFxVal` (pow 0.3–0.4, mnożnik ~20–24, offset dla routingu band/BPM), clamp.
   - Smoothing (opcjonalnie) na `fxVuLevels` żeby pasek był płynny.
   - Test: tryb Experimental, FX na Bass/Mid/High, Depth/Wet na górze – ma pulsować w rytm muzyki, VU slotów ma żyć.

2) Porządek w buildzie
   - Po usunięciu duplikatów w App/ExperimentalApp uruchomić `npm run build`.

3) Dalsze optymalizacje (opcjonalne po powyższym)
   - Regulacja czułości FX (globalny slider “FX Sensitivity”).
   - Dodatkowy fallback analyser bezpośrednio na elemencie audio tylko dla FX (low smoothing).
   - Wizualne podbicie VU (kolor, blur) po stronie UI jeśli nadal za mało czytelne.
