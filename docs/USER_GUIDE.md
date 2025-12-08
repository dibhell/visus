# VISUS - Podrecznik Uzytkownika (v0.2.3)

Przewodnik po uruchomieniu, miksie AV, nagrywaniu i pracy mobilnej.

## 1. Start
- Wymagania: Chrome/Edge 118+, GPU z WebGL, mikrofon/kamera opcjonalnie.
- Uruchom: `npm install`, `npm run dev` (lokalnie) lub otworz hostowany build.
- Uprawnienia: przy pierwszym uzyciu zezwol na kamere/mikrofon (ikona klodki w pasku adresu).

## 2. Interfejs
- Panel boczny (L): zrodla (video/music/mic), nagrywanie, FX, geometry.
- Podglad (P): canvas z efektem koncowym; na mobile canvas jest widoczny nad panelem (FX live).
- Pasek statusu (P): FPS (wygladzony, odswiezany co ok. 0.25 s), rozdzielczosc canvasu (render clamped do 1920x1080), skala renderu.

## 3. Zrodla
- **Video**: plik (ikona folderu), kamera (ikona kamery), URL (ikona globu). Front/Back na mobile przez przyciski w selektorze.
- **Music**: plik lub katalog (ikona folderu/globu). Domyslnie loop + crossOrigin.
- **Mic**: wlacz kanal Mic i przyznaj uprawnienie; audio idzie do miksu, nie na glosniki (brak feedbacku).

## 4. Miks i geometria
- Fadery: glosnosci kanalow (video/music/mic). Mute = przelacznik na gorze.
- Geometry: Scale / Pan X / Pan Y; Mirror - odbicie w poziomie.
- Aspect: Native, 16:9, 9:16, 4:5, 1:1, Fit, 21:9. Canvas skaluje sie do wolnej przestrzeni (uwzglednia panel); render ograniczony do 1920x1080 dla wydajnosci GPU.

## 5. FX i audio-reactive
- FX glowny + 5 warstw addytywnych. Kazdy slot: wybor shaderu, routing (off/bpm/sync1/2/3), gain, mix.
- Sync1/2/3 to pasma z filtrow Biquad; parametry w sekcji Spectrum/Bands.
- BPM/Offset: zegar do routingu BPM (faza).

## 6. Nagrywanie
- Przycisk **REC VIDEO (WEBM/MP4)**: zapisuje canvas + miks audio.
- Audio w pliku: wybierany jest jeden zywy tor audio (priorytet: `captureStream` audio elementu -> miks AudioContext -> `captureStream` wideo).
- MIME: preferencja WebM/Opus; MP4 tylko jesli wspierane.
- Wydajnosc nagrywania: `canvas.captureStream(24)` (24 fps) dla MediaRecorder, bitrate wideo 12 Mbps, audio 192 kbps.

## 7. Performance Lab
- **Render Scale**: 55% domyslnie; zmniejsz przy dropach FPS.
- **Frame Cap**: limituje petle renderu (np. 60/45/30).
- **Auto Scale (LOD)**: adaptuje renderScale do FPS (on domyslnie). Render clamp do 1920x1080 chroni GPU na 4K/ultra-wide.
- **WebCodecs**: preferuj wideo hardware (gdy audio unsupported).

## 8. Mobile
- UI schowaj gestem (drag handle) by odslnic pelny podglad.
- Canvas jest nad panelem, wiec efekty widac na zywo nawet podczas strojenia ustawien.
- FacingMode: w selektorze kamery wybierz Front/Back.

## 9. Rozwiazywanie problemow
- Brak audio w nagraniu: upewnij sie, ze kanal Music/Video/Mic jest aktywny; zobacz log `Recording tracks` w konsoli (audioTracks > 0). W Chrome uzywaj WebM/Opus.
- Kamera na mobile: jesli obraz pojawia sie dopiero po zamknieciu menu, sprawdz uprawnienia i tryb Facing (Front/Back).
- Niskie FPS: obniaz Render Scale, Frame Cap do 30, wylacz zbedne FX; na 4K render jest automatycznie ograniczony do 1080p.
- Blad uprawnien: sprawdz ustawienia klodki (kamera/mic), odswiez strone po przyznaniu.

## 10. Hotkeys (desktop)
- Spacja: start/stop wideo (jesli aktywne).
- M: mute/unmute muzyka.
- R: toggle nagrywanie.
- F: przelacz panel boczny.

## 11. Eksport / pliki
- Nagrania zapisywane jako `VISUS_<ISO-datetime>.(webm|mp4)`.
- Presety/playlisty - planowane; na razie ustawienia w pamieci sesji.

## 12. Kontakt
- Autor: Studio Poploch / Pan Grzyb - ptr@o2.pl
- Wersja: 0.2.3

---

> PDF: plik mozna przekonwertowac lokalnie poleceniem `npx tailwindcss -i ./index.css -o /tmp/visus.css && pandoc docs/USER_GUIDE.md -c /tmp/visus.css -o visus_user_guide.pdf` (wymaga pandoc).
