# TODO - VISUS Experimental

1) Strojenie FX audio-reactive
   - Nowe mapowanie: pow(0.7) + smoothing 35% z sufitem FX 24; VU pow(0.8) + smoothing 45% z sufitem 10. Zweryfikowa? na Bass/Mid/High czy czu?o?? jest wystarczaj?ca; w razie potrzeby skorygowa? mno?nik/limit.
   - Sprawdzi?, czy smoothing VU nie spowalnia UI wzgl?dem pasma.

2) AudioEngine / FFT
   - Filtry bandpass (sync1/2/3): analyser 256, smoothing 0.55 + wyg?adzanie band?w (35%). Przetestowa? na r??nych freq/width vs FFT fallback (?rednia z okna, clamp 1) i potwierdzi? stabilne bandLevels.
   - Ewentualnie doprecyzowa? fftSize/smoothing po testach live.

3) Dokumentacja/porz?dek
   - README/Instructions zaktualizowane do nowego strojenia; debug overlay/log wy??czony.
   - Przed releasem: `npm run build` + kr?tki smoke (nagrywanie/FX na pasmach).

4) Nagrywanie WebM
   - Brak ?cie?ki audio w nagraniach `REC VIDEO` dla niekt?rych ?r?de?. Sprawdzi? strumienie audio (recDest/captureStream fallback) i potwierdzi? obecno?? audio track?w w output.
