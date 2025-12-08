# TODO - VISUS Experimental

1) Strojenie FX audio-reactive
   - Aktualne mapowanie: pow(0.4)*14 + 0.4 (routing != off), clamp 18; VU pow(0.5) clamp 1.5; VU tick ~200 ms, UI/FPS tick ~250 ms. Zweryfikowac czulosc Bass/Mid/High/BPM i gainy (0-200).
   - Upewnic sie, ze rzadsze ticki nie spowalniaja wrazenia z UI.

2) AudioEngine / FFT
   - Filtry bandpass (sync1/2/3): analyser 256, smoothing 0.45 + wygladzanie bandow (~50%). Przetestowac na roznych freq/width vs FFT/time-domain fallback (clamp do 1) i potwierdzic stabilne bandLevels.
   - Ewentualnie doprecyzowac fftSize/smoothing po testach live.

3) Render/perf
   - Clamp render resolution do 1920x1080 (aspect zachowany) - sprawdz 4K/ultra-wide, czy ostrosc na canvasku ok i czy nie trzeba osobnego limitu dla preview/record.
   - GLService cache uniform/attrib; potwierdz brak null w shaderach custom.

4) Nagrywanie WebM
   - Default `captureStream` 24 fps; sprawdz jak wyglada motion i synchro audio przy 12 Mbps / 192 kbps.
   - Brak sciezki audio w nagraniach `REC VIDEO` dla niektorych zrodel - sprawdz strumienie audio (recDest/captureStream fallback) i potwierdz obecnosc audio trackow w output.

5) Dokumentacja/porzadek
   - Utrzymac README/Instructions/User Guide zgodnie z biezacym strojeniem; notka o clampie 1080p i 24 fps.
   - `npm run build` + krotki smoke (nagrywanie/FX na pasmach) przed releasem.
