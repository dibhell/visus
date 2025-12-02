# VISUS — Podręcznik Użytkownika (v0.2.3)

Przewodnik po uruchomieniu, miksie AV, nagrywaniu i pracy mobilnej.

## 1. Start
- Wymagania: Chrome/Edge 118+, GPU z WebGL, mikrofon/kamera opcjonalnie.
- Uruchom: `npm install`, `npm run dev` (lokalnie) lub wejdź na hostowany build.
- Uprawnienia: przy pierwszym użyciu zezwól na kamerę/mikrofon (ikona kłódki w pasku adresu).

## 2. Interfejs
- Panel boczny (L): źródła (video/music/mic), nagrywanie, FX, geometry.
- Podgląd (P): canvas z efektem końcowym; na mobile canvas jest widoczny nad panelem (FX live).
- Pasek statusu (P↑): FPS (wygładzony), rozdzielczość canvasu, skala renderu.

## 3. Źródła
- **Video**: plik (ikona folderu), kamera (ikona kamery), URL (ikona globu). Front/Back na mobile przez przyciski w selektorze.
- **Music**: plik lub katalog (ikona folderu/globu). Domyślnie loop + crossOrigin.
- **Mic**: włącz kanał Mic i przyznaj uprawnienie; audio idzie do miksu, nie na głośniki (brak feedbacku).

## 4. Miks i geometria
- Fadery: głośności kanałów (video/music/mic). Mute = przełącznik na górze.
- Geometry: Scale / Pan X / Pan Y; Mirror — odbicie w poziomie.
- Aspect: Native, 16:9, 9:16, 4:5, 1:1, Fit. Canvas skaluje się do wolnej przestrzeni (uwzględnia panel).

## 5. FX i audio-reactive
- FX główny + 5 warstw addytywnych. Każdy slot: wybór shaderu, routing (off/bpm/sync1/2/3), gain, mix.
- Sync1/2/3 to pasma z filtrów Biquad; parametry w sekcji Spectrum/Bands.
- BPM/Offset: zegar do routingu BPM (faza).

## 6. Nagrywanie
- Przycisk **REC VIDEO (WEBM/MP4)**: zapisuje canvas + miks audio.
- Audio w pliku: wybierany jest jeden żywy tor audio (priorytet: `captureStream` audio elementu → miks AudioContext → `captureStream` wideo).
- MIME: preferencja WebM/Opus; MP4 tylko jeśli wspierane.
- Wydajność nagrywania: Recording FPS domyślnie 45 (clamp do 30 przy capture), bitrate wideo domyślnie 8 Mbps; audio 192 kbps.

## 7. Performance Lab
- **Render Scale**: 55% domyślnie; zmniejsz przy dropach FPS.
- **Frame Cap**: limituje pętlę renderu (np. 60/45/30).
- **Auto Scale (LOD)**: adaptuje renderScale do FPS (on domyślnie).
- **WebCodecs**: preferuj wideo hardware (gdy audio unsupported).

## 8. Mobile
- UI schowaj gestem (drag handle) by odsłonić pełny podgląd.
- Canvas jest nad panelem, więc efekty widać na żywo nawet podczas strojenia ustawień.
- FacingMode: w selektorze kamery wybierz Front/Back.

## 9. Rozwiązywanie problemów
- Brak audio w nagraniu: upewnij się, że kanał Music/Video/Mic jest aktywny; zobacz log `Recording tracks` w konsoli (audioTracks > 0). W Chrome używaj WebM/Opus.
- Kamera na mobile: jeśli obraz pojawia się dopiero po zamknięciu menu, sprawdź uprawnienia i tryb Facing (Front/Back).
- Niskie FPS: obniż Render Scale, Frame Cap do 30, wyłącz zbędne FX.
- Błąd uprawnień: sprawdź ustawienia kłódki (kamera/mic), odśwież stronę po przyznaniu.

## 10. Hotkeys (desktop)
- Spacja: start/stop wideo (jeśli aktywne).
- M: mute/unmute muzyka.
- R: toggle nagrywanie.
- F: przełącz panel boczny.

## 11. Eksport / pliki
- Nagrania zapisywane jako `VISUS_<ISO-datetime>.(webm|mp4)`.
- Presety/playlisty — planowane; na razie ustawienia w pamięci sesji.

## 12. Kontakt
- Autor: Studio Popłoch / Pan Grzyb — ptr@o2.pl
- Wersja: 0.2.3

---

> PDF: plik można przekonwertować lokalnie poleceniem `npx tailwindcss -i ./index.css -o /tmp/visus.css && pandoc docs/USER_GUIDE.md -c /tmp/visus.css -o visus_user_guide.pdf` (wymaga pandoc).
