# TODO - VISUS Experimental

0) Startup debug (OOM/INITIALIZE)
   - Uruchom scenariusze: ?debug_nogl=1&debug_noaudio=1&debug_noworker=1, ?debug_nogl=1&debug_noaudio=1, ?debug_nogl=1, ?debug_nogl=0&debug_noworker=1; zapisz w konsoli ktore moduly startuja i czy pojawia sie OOM/render error.

1) Strojenie FX audio-reactive
   - Nowe mapowanie: pow(0.7) + smoothing 35% z sufitem FX 24; VU pow(0.8) + smoothing 45% z sufitem 10. Zweryfikowac na Bass/Mid/High; w razie potrzeby skorygowac mnoznik/limit.
   - Sprawdzic, czy smoothing VU nie spowalnia UI wzgledem pasma.

2) AudioEngine / FFT / Spectrum
   - Filtry bandpass (sync1/2/3): analyser 256, smoothing 0.45 + wygladzanie bandow (~50%). Przetestowac na roznych freq/width vs FFT fallback.
   - Spektrum: hi-res FFT (16384) bias bas, sampler max w oknie log-freq, auto-gain bez progu; potwierdzic pk > 0 i ruch linii (w razie potrzeby stroic boostExp/boostMult/min/maxH).

3) Dokumentacja/porzadek
   - README/Instructions/Changelog/Improvements zaktualizowane do nowego strojenia; debug overlay/log wylaczony.
   - Przed releasem: 
pm run build + krotki smoke (nagrywanie/FX na pasmach).

4) Nagrywanie WebM
   - Potwierdzic, ze nagrywanie master mix (VIDEO/MUSIC/MIC) dziala stabilnie; brak miksu powinien przerwac nagranie z alertem.

5) Test obciazeniowy
   - Klip 1080p + kilka FX, Performance Mode medium/low, Auto Scale on, HUD: FPS/dt/renderScale/cap.
   - Rejestrowac FPS/scale 30-60 s; sprawdzic lock resolution 0.5x i auto frame cap (60->30->24).

6) Memory leak watch (10 min)
   - Klip 1080p, Performance Mode=medium, Auto Scale ON, rVFC ON.
   - Monitor: usedJSHeapSize, liczba AudioNode/WebGLTexture, kolejka workerow.
   - Jesli rosnie liniowo: sprawdz czy MediaStream/AudioSource sa zwalniane (stop tracks + disconnect), ewentualnie WeakRef/cleanup na listenerach.
