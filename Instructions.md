# Instructions - strojenie FX/VU (stan 0.1.0)

Cel: potwierdzi? nowe strojenie audio-reactive; overlay/log wy??czony.

1) Czu?o??/mapowanie
- FX: pow(0.7) + smoothing 35%, sufit 24; VU: pow(0.8) + smoothing 45%, sufit 10. Sprawd? na Bass/Mid/High i ewentualnie skoryguj mno?nik/alpha/clamp.

2) Filtry/FFT
- Bandpass (sync1/2/3) z analyserem 256, smoothing 0.55 + wewn?trzne wyg?adzanie (35%). FFT fallback: ?rednia pasma z clamp do 1; fallback u?ywany gdy pasma z filtr?w s? puste albo dope?niaj? max(). Przetestuj r??ne freq/width.

3) Testy
- Manual: tryb Experimental, routing FX na Bass/Mid/High, obserwacja VU/Depth; upewnij si?, ?e smoothing nie laguje UI.
- Przed releasem: `npm run build` + kr?tki smoke nagrywania (MediaRecorder/WebCodecs).
