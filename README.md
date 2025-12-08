<div align="center">
<img width="220" height="220" alt="VISUS Experimental Engine" src="./public/icon.png" />
</div>

# VISUS Experimental Engine

VISUS to przegladarkowy silnik VJ/AV: miksuje wideo (pliki, kamera), audio (pliki, mic), naklada shadery WebGL jako efekty, reaguje na pasma audio i potrafi nagrywac output do WebM (MediaRecorder lub WebCodecs). UI umozliwia sterowanie geometria, proporcjami, lancuchem FX (Depth/Wet), routingiem FX na pasma (Bass/Mid/High) lub BPM, a takze adaptacyjne skalowanie jakosci pod FPS.

## Jak jest zbudowana
- **Frontend:** React + TypeScript + Vite.
- **Render:** WebGL (GLSL fragment shader) z OffscreenCanvas w workerze (`RenderWorker`) i fallbackiem na glowny watek; `FastGLService` zarzadza tekstura wideo i uniformami FX.
- **Audio:** Web Audio API (AnalyserNode, BiquadFilter) z dedykowanym `ExperimentalAudioEngine`, tap-analyserami prefader, filtrami pasm (sync1/2/3), FFT fallbackiem dla bandLevels oraz szybkim VU (`getLevelsFast`).
- **Nagrywanie:** MediaRecorder oraz sciezka WebCodecs (`MediaStreamTrackProcessor + VideoEncoder`) z preferencja akceleracji HW; zapis do WebM.
- **Adaptacja jakosci:** petla FPS zmienia `renderScale` (LOD) zalezne od wydajnosci.

## Wersjonowanie (biezacy stan)
- **Branch:** `main`
- **Wersja:** 0.2.3 (patrz `CHANGELOG.md`)
- **Ostatnie zmiany:** clamp renderu do 1920x1080 (utrzymuje aspect, mniej obciazenia GPU na 4K/ultra-wide), rzadsze ticki UI (VU co ~200 ms, FPS/visual co ~250 ms) i kesz uniformow w `GLService` dla mniejszego CPU, nagrywanie `captureStream` na 24 fps (stabilniejsze WebM/MP4).
- **Znane problemy:** wymaga testu live czulosci Bass/Mid/High (ew. korekta mnoznikow/smoothing), potwierdzenia nagrywania i wydajnosci po clampie 1080p i 24 fps capture.

## Uruchomienie lokalne
**Wymagania:** Node.js 18+

1. Instalacja zaleznosci:  
   `npm install`
2. Dev server:  
   `npm run dev`
3. Build produkcyjny (sprawdzenie przed push):  
   `npm run build`

> Uwaga: aplikacja korzysta wylacznie z zasobow lokalnych (brak zewnetrznych kluczy/API).
