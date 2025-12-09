# TODO - VISUS Experimental

1) Strojenie FX audio-reactive
   - Nowe mapowanie: pow(0.7) + smoothing 35% z sufitem FX 24; VU pow(0.8) + smoothing 45% z sufitem 10. Zweryfikowa? na Bass/Mid/High czy czu?o?? jest wystarczaj?ca; w razie potrzeby skorygowa? mno?nik/limit.
   - Sprawdzi?, czy smoothing VU nie spowalnia UI wzgl?dem pasma.

2) AudioEngine / FFT
   - Filtry bandpass (sync1/2/3): analyser 256, smoothing 0.45 + wyg?adzanie band?w (~50%). Przetestowa? na r??nych freq/width vs FFT fallback (?rednia z okna, clamp 1) i potwierdzi? stabilne bandLevels.
   - Ewentualnie doprecyzowa? fftSize/smoothing po testach live.

3) Dokumentacja/porz?dek
   - README/Instructions zaktualizowane do nowego strojenia; debug overlay/log wy??czony.
   - Przed releasem: `npm run build` + kr?tki smoke (nagrywanie/FX na pasmach).

4) Nagrywanie WebM
   - Potwierdzi?, ?e nagrywanie master mix (VIDEO/MUSIC/MIC) dzia?a stabilnie; brak miksu powinien przerwa? nagranie z alertem.

5) Test obci??eniowy
   - Klip 1080p + kilka FX, Performance Mode medium/low, Auto Scale on, HUD: FPS/dt/renderScale/cap.
   - Rejestrowa? FPS/scale 30?60 s; sprawdzi? lock resolution 0.5x i auto frame cap (60?30?24).

6) Memory leak watch (10 min)
   - Klip 1080p, Performance Mode=medium, Auto Scale ON, rVFC ON.
   - Monitor: usedJSHeapSize, liczba AudioNode/WebGLTexture, kolejka worker?w.
   - Je?li ro?nie liniowo: sprawdzi? czy MediaStream/AudioSource s? zwalniane (stop tracks + disconnect), ewentualnie WeakRef/cleanup na listenerach.
