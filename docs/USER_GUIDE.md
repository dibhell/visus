# VISUS - Podrecznik Uzytkownika (v0.2.7)

Przewodnik po uruchomieniu, miksie AV, nagrywaniu i pracy mobilnej.

## 1. Start
- Wymagania: Chrome/Edge 118+, GPU z WebGL, mikrofon/kamera opcjonalnie.
- Uruchomienie: `npm install`, `npm run dev` (lokalnie) lub wejscie na hostowany build.
- Uprawnienia: przy pierwszym uruchomieniu zezwol na kamere/mikrofon (ikona klodki w pasku adresu).

## 2. Interfejs
- Panel boczny (L): zrodla (video/music/mic), nagrywanie, FX, geometry.
- Podglad (P): canvas z efektem koncowym; na mobile canvas jest nad panelem (FX live).
- Pasek statusu (P): FPS (wygladzony), rozdzielczosc canvasu, skala renderu.

## 3. Zrodla
- **Video**: plik (ikona folderu), kamera (ikona kamery), URL (ikona globu). Front/Back na mobile przez przyciski w selektorze.
- **Music**: plik lub katalog (folder/glob). Domyslnie loop + crossOrigin.
- **Mic**: wlacz kanal Mic i przyznaj uprawnienie; audio trafia do miksu (brak feedbacku na glosniki).

## 4. Miks i geometria
- Fadery: glosnosc kanalow (video/music/mic). Mute to przelacznik na gorze.
- Geometry: Scale / Pan X / Pan Y; Mirror - odbicie w poziomie.
- Aspect: Native, 16:9, 9:16, 4:5, 1:1, Fit. Canvas skaluje sie do dostepnej przestrzeni (uwzglednia panel).

## 5. FX i audio-reactive
- FX glowny + 5 warstw addytywnych. Kazdy slot: shader, routing (off/bpm/sync1/2/3), gain, mix.
- Sync1/2/3: pasma z filtrow Biquad (analyser 256, smoothing 0.45 + ~50% wygladzania); parametry w sekcji Spectrum/Bands.
- Spectrum: hi-res FFT 16384 z biasem na bas, sampler max w oknie log-freq, auto-gain bez twardego progu, fallback na bands; panel Auto gain/Shape zawsze widoczny.
- Mapowanie: FX pow(0.7) + smoothing 35% (sufit 24), VU pow(0.8) + smoothing 45% (sufit 10).
- BPM/Offset: zegar do routingu BPM (faza).

## 6. Nagrywanie
- Przycisk **REC VIDEO (WEBM/MP4)** zapisuje canvas + miks audio (master VIDEO/MUSIC/MIC). Brak aktywnych torow przerywa nagrywanie z alertem.
- MIME: preferencja WebM/Opus; MP4 tylko jesli wspierane. WebCodecs moze byc video-only gdy audio niewspierane.
- Wydajnosc nagrywania: Recording FPS domyslnie 45 (clamp do 30 przy capture), bitrate wideo domyslnie 8 Mbps; audio 192 kbps.

## 7. Performance Lab
- Render Scale: Low/Medium/High/Ultra Low (35%) + blokada rozdzielczosci 0.5x dla slabszych GPU.
- Frame Cap: wartosci manualne lub tryb Auto (60->30->24 przy spadkach FPS).
- Performance Mode: High/Medium/Low ustawia stride FFT co 1/2/3 klatki.
- UI Limit: ogranicza odswiezanie UI/VU (domyslnie 20 FPS).
- Auto Scale (LOD): adaptuje renderScale do FPS; respektuje blokade rozdzielczosci.
- WebCodecs: preferuj hardware video (gdy audio niewspierane, fallback MediaRecorder).

## 8. Mobile
- UI schowasz gestem (drag handle), by odslonic pelny podglad.
- Canvas jest nad panelem, wiec efekty widac na zywo podczas strojenia ustawien.
- FacingMode: w selektorze kamery wybierz Front/Back.

## 9. Rozwiazywanie problemow
- Brak audio w nagraniu: upewnij sie, ze kanal Music/Video/Mic jest aktywny; sprawdz log `Recording tracks` (audioTracks > 0). W Chrome uzywaj WebM/Opus.
- Kamera na mobile: jesli obraz pojawia sie dopiero po zamknieciu menu, sprawdz uprawnienia i tryb Facing (Front/Back).
- Niskie FPS: obniz Render Scale, Frame Cap do 30, wylacz zbedne FX.
- Blad uprawnien: sprawdz ustawienia klodki (kamera/mic), odswiez strone po przyznaniu.

## 10. Hotkeys (desktop)
- Spacja: start/stop video (jesli aktywne).
- M: mute/unmute muzyka.
- R: toggle nagrywanie.
- F: przelacz panel boczny.

## 11. Eksport / pliki
- Nagrania zapisywane jako `VISUS_<ISO-datetime>.(webm|mp4)`.
- Playlisty: dodawaj klipy video do listy (Add to Playlist), tryb Sequential/Random, opcja Avoid repeats; widoczny Current/Next i lista pozycji z mozliwoscia usuniecia/clear.

## 12. Kontakt
- Autor: Studio Poploch / Pan Grzyb - ptr@o2.pl
- Wersja: 0.2.7

---

> PDF: plik mozna skonwertowac lokalnie: `npx tailwindcss -i ./index.css -o /tmp/visus.css && pandoc docs/USER_GUIDE.md -c /tmp/visus.css -o visus_user_guide.pdf` (wymaga pandoc).
