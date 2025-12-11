# TODO - VISUS Experimental

0) Startup debug (OOM/INITIALIZE)
   - Uruchom scenariusze: `?debug_nogl=1&debug_noaudio=1&debug_noworker=1`, `?debug_nogl=1&debug_noaudio=1`, `?debug_nogl=1`, `?debug_nogl=0&debug_noworker=1`; zapisz w konsoli które moduły startują i czy pojawia się OOM/render error.

1) Strojenie FX audio-reactive
   - Nowe mapowanie: pow(0.7) + smoothing 35% z sufitem FX 24; VU pow(0.8) + smoothing 45% z sufitem 10. Zweryfikować na Bass/Mid/High; w razie potrzeby skorygować mnożnik/limit.
   - Sprawdzić, czy smoothing VU nie spowalnia UI względem pasma.

2) AudioEngine / FFT / Spectrum
   - Filtry bandpass (sync1/2/3): analyser 256, smoothing 0.45 + wygładzanie bandów (~50%). Przetestować na różnych freq/width vs FFT fallback.
   - Spektrum: hi-res FFT (16384) bias bas, sampler max w oknie log-freq, auto-gain bez progu; potwierdzić pk > 0 i ruch linii (w razie potrzeby stroić boostExp/boostMult/min/maxH).

3) Dokumentacja/porządek
   - README/Instructions/Changelog/Improvements zaktualizowane do nowego strojenia; debug overlay/log wyłączony.
   - Przed releasem: `npm run build` + krótki smoke (nagrywanie/FX na pasmach).

4) Nagrywanie WebM
   - Potwierdzi?, ?e nagrywanie master mix (VIDEO/MUSIC/MIC) dzia?a stabilnie; brak miksu powinien przerwa? nagranie z alertem.

5) Test obci??eniowy
   - Klip 1080p + kilka FX, Performance Mode medium/low, Auto Scale on, HUD: FPS/dt/renderScale/cap.
   - Rejestrowa? FPS/scale 30?60 s; sprawdzi? lock resolution 0.5x i auto frame cap (60?30?24).

6) Memory leak watch (10 min)
   - Klip 1080p, Performance Mode=medium, Auto Scale ON, rVFC ON.
   - Monitor: usedJSHeapSize, liczba AudioNode/WebGLTexture, kolejka worker?w.
   - Je?li ro?nie liniowo: sprawdzi? czy MediaStream/AudioSource s? zwalniane (stop tracks + disconnect), ewentualnie WeakRef/cleanup na listenerach.
