# TODO — VISUS Experimental

1) Strojenie FX audio-reactive
   - Skala/klamra: zmniejszyć multiplier/clamp po potwierdzeniu działania (obecnie mocne *60/*12); ewentualnie przywrócić lekkie smoothing VU.
   - Usunąć debug overlay/log po walidacji.
   - Test: tryb Experimental, FX na Bass/Mid/High — VU/Depth mają reagować w rytm pasma.

2) AudioEngine / FFT
   - Zweryfikować, czy filtry bandpass (sync1/2/3) dają sygnał i czy FFT fallback jest OK przy różnych ustawieniach freq/width.
   - Dobrać smoothing/fftSize dla band analyserów, żeby bandLevels były stabilne, ale responsywne.

3) Dokumentacja/porządek
   - Zaktualizować instrukcje po finalnym strojeniu; usunąć debug overlay.
   - Build: `npm run build` przed release.
