# TODO — VISUS Experimental

1) FX audio-reactive & VU (pilne)
   - Naprawić zamrożone VU w FX Chain: zweryfikować przepływ bandLevels → setFxVuLevels → FxSlot; dodać logging/overlay debug w pętli renderowej (wartości band/VU na ekranie).
   - Upewnić się, że bandLevels (Bass/Mid/High) są aktualne co klatkę i trafiają do computeFxVu/computeFxVal bez dodatkowych offsetów.
   - Dostroić mapowanie (pow/multiplier/clamp) i smoothing tak, by VU/Depth realnie pulsowały w rytm pasma; Depth jako max, pasmo jako bieżące sterowanie.
   - Test: tryb Experimental, FX na Bass/Mid/High, wyraźne widmo — paski VU i efekty muszą reagować.

2) Diagnostyka
   - Dodać tymczasowy overlay/console log dla bandLevels i fxVuLevels w pętli renderowej.
   - Sprawdzić, czy setFxVuLevels jest wywoływane po zmianie bandLevels (brak throttlingu, brak podmiany przez stare wartości).

3) Dokumentacja/porządek
   - Zaktualizować instrukcje po naprawie VU/FX i usunięciu UI gain/threshold (w tej chwili wyłączone).
   - Po fixie: `npm run build`.
