# VISUS Experimental – Status i kierunki prac (ASCII)

## Co zostało zrobione
- Render przeniesiony do workera z OffscreenCanvas (`RenderWorker` + `FastGLService`) z fallbackiem na główny wątek i timeoutem na bitmapy in‑flight.
- Adaptacyjne LOD: pętla FPS skaluje `renderScale` zależnie od wydajności i wraca do wyższej jakości przy zapasie klatek.
- Nagrywanie WebCodecs: ścieżka `MediaStreamTrackProcessor + VideoEncoder` z preferencją HW, fallback do MediaRecorder; zrzut do WebM.
- Audio: osobny `vizAnalyser`, cichy sink wymuszający przepływ, automatyczne `AudioContext.resume()`, filtry pasmowe dla sync1/2/3, FFT fallback z kanałów i z bufora czasowego. Prefader tap-analyzers na video/music/mic dla VU/FFT.
- Szybkie VU: `ExperimentalAudioEngine.getLevelsFast` bez dodatkowych alokacji.
- Sterowanie FX: routing na pasma `sync1–3`/BPM/manual, obsługa Wet/Dry (mix) w pakiecie FX do renderera/worker.

## Obecne problemy
- FX reagują bardzo słabo lub wcale na audio; modulacja wygląda na stałą.
- Wskaźnik VU w slotach FX (pionowy pasek) bywa zamrożony i nie podąża za pasmem.
- Widmo działa, VU kanałów działa, ale FX dynamiczność jest niewystarczająca.

## Stos technologiczny
- Frontend: React + Vite, TypeScript.
- Render: WebGL (GLSL fragment shader) + OffscreenCanvas + worker.
- Audio: Web Audio API (AnalyserNode, BiquadFilter), WebCodecs dla nagrywania.

## Plan naprawy FX (kolejność)
1) Stan i referencje VU dla FX: dodać `fxVuLevels` + `fxVuLevelsRef` w ExperimentalApp.
2) Wyliczanie poziomu na slot: w pętli renderowej obliczyć `computeFxVu(config)` z band level * gain, z lekkim powermappingiem i clampem; trzymać w `fxVuLevels`.
3) Wstrzyknięcie do UI: przekazać `vuLevel` do `FxSlot` (prop już obsługuje render paska), tak by pasek odzwierciedlał live poziom pasma/routingu.
4) Wzmocnienie modulacji: `computeFxVal` nieliniowo (pow <1) + offset dla routingu band/BPM, limit np. 20–24; używać band gain * band level.
5) Smoothing: ewentualnie na `fxVuLevels` dodać prosty smoothing (np. lerp 0.3–0.5), żeby pasek był płynny.
6) Test: tryb Experimental, włączyć muzykę, ustawić FX (np. Mirror/Glitch/Neon), routing Bass/Mid/High, obserwować zmianę obrazu i VU w slocie; sprawdzić też brak routingu (manual/off) – powinien być stały.

## Zadania do patcha (skrót)
- ExperimentalApp: dodać `fxVuLevels` state + ref; w pętli renderowej wyliczyć `fxVuLevels` i `visualLevels`, ustawiać oba co ~80ms.
- ExperimentalApp: przekazać `vuLevel` do `FxSlot` dla main i wszystkich layerów.
- Wzmocnić `computeFxVal` (pow 0.3–0.4, mnożnik ~20, offset ~0.6–0.9 dla band/BPM); clamp do sensownej granicy.
- Upewnić się, że `getActivationLevel` mnoży band level przez band gain (już jest, ale warto zweryfikować).
- Test lokalny `npm run build` + manualne sprawdzenie reakcji FX na muzykę i ruch VU w slotach FX.
