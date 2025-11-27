# Usprawnienia w wersji eksperymentalnej

- **Render (GPU/worker)**: render przeniesiony na `OffscreenCanvas` w workerze (`RenderWorker` + `FastGLService`), z automatycznym fallbackiem na główny wątek oraz zabezpieczeniem przed zawieszeniem kolejki bitmap (timeout na inflight).
- **Adaptacyjna jakość**: pętla FPS z wygładzaniem dostosowuje `renderScale` (LOD) do bieżącej wydajności, wraca do wyższej jakości gdy jest zapas klatek.
- **Nagrywanie WebCodecs**: ścieżka `MediaStreamTrackProcessor + VideoEncoder` z akceleracją sprzętową i fallbackiem do `MediaRecorder`; klatki kodowane w tle, buforowane i zrzucane do WebM.
- **Audio / analizator**: osobny `vizAnalyser` spięty z głównym miksem, wymuszony przepływ (cichy sink) i automatyczne `AudioContext.resume()`; filtry pasmowe (sync1–3) mają własne analizery do routingu efektów; FFT ma fallback z kanałów i z bufora czasowego, żeby widmo nie zanikało przy starcie.
- **Szybkie VU**: `ExperimentalAudioEngine` udostępnia zbuforowaną ścieżkę VU (`getLevelsFast`) dla pętli rendera bez dodatkowych alokacji.
- **Sterowanie efektami**: routing FX korzysta z pasm `sync1–3` (średnia z filtrów) lub z BPM/phasera; Wet/Dry per slot (parametr `mix`) obsługiwany w pakiecie FX przekazywanym do renderera/worker.
