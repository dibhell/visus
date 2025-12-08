# Instructions - strojenie FX/VU (stan 0.2.3)

Cel: potwierdzic aktualne strojenie audio-reactive + nowe ticki UI/nagrywania; overlay/log wylaczony.

1) Czulosc/mapowanie
- FX: pow(0.4) * 14 + 0.4 (gdy routing != off), clamp 18; gain z UI (0-200). VU: pow(0.5), clamp 1.5. VU sample co ~200 ms, update UI (FPS/visual) co ~250 ms. Sprawdz Bass/Mid/High/BPM czy reakcja nie jest zbyt leniwa.

2) Filtry/FFT
- Bandpass (sync1/2/3) z analyserem 256, smoothing 0.45 + wewnetrzne wygladzanie bandLevels ~50%. FFT/time-domain fallback gdy pasma sa puste. Przetestuj freq/width i blending bandow.

3) Testy
- Manual: tryb Experimental, routing FX na Bass/Mid/High/BPM, obserwacja VU/Depth; upewnij sie, ze 200/250 ms tick nie laguje feedbacku.
- Nagrywanie: MediaRecorder z `captureStream(24)`; sprawdz audio track (log `Recording tracks` i plik). Przed releasem: `npm run build` + krotki smoke WebM/Opus lub MP4 (jesli wspierane).
