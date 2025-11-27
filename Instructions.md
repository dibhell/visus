# Instructions — strojenie FX/VU (stan 0.1.0)

Cel: utrwalić działanie audio-reactive FX; zlikwidować debug overlay/log i wyważyć czułość.

1) Czułość/mapowanie
- Obecnie mocne mapowanie (FX *60 clamp 60, VU *12 clamp 12). Dostosuj multiplier/clamp (i ewentualnie lekkie smoothing) po testach live.

2) Overlay/log
- Aktualny overlay/log bandLevels/VU jest tymczasowy; usuń go po potwierdzeniu, że pasma i VU reagują.

3) Filtry/FFT
- BandLevels biorą max z filtrów bandpass i FFT fallbacku (freq/width). Ustal docelowe parametry filtra (fftSize/smoothing) i sprawdź, czy fallback jest jeszcze potrzebny.

4) Test i build
- Test manualny: muzyka z wyraźnym Bass/Mid/High, routing slotów Bass/Mid/High, obserwacja VU/efektów.
- Przed releasem: `npm run build`.
