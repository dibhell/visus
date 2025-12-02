<div align="center">
<img width="220" height="220" alt="VISUS Experimental Engine" src="./public/icon.png" />
</div>

# VISUS Experimental Engine

VISUS to przeglądarkowy silnik VJ/AV: miksuje wideo (pliki, kamera), audio (pliki, mic), nakłada shadery WebGL jako efekty, reaguje na pasma audio i potrafi nagrywać output do WebM (MediaRecorder lub WebCodecs). UI umożliwia sterowanie geometrią, proporcjami, łańcuchem FX (Depth/Wet), routingiem FX na pasma (Bass/Mid/High) lub BPM, a także adaptacyjne skalowanie jakości pod FPS.

## Jak jest zbudowana
- **Frontend:** React + TypeScript + Vite.
- **Render:** WebGL (GLSL fragment shader) z OffscreenCanvas w workerze (`RenderWorker`) i fallbackiem na główny wątek; `FastGLService` zarządza teksturą wideo i uniformami FX.
- **Audio:** Web Audio API (AnalyserNode, BiquadFilter) z dedykowanym `ExperimentalAudioEngine`, tap-analyserami prefader, filtrami pasm (sync1/2/3), FFT fallbackiem dla bandLevels oraz szybkim VU (`getLevelsFast`).
- **Nagrywanie:** MediaRecorder oraz ścieżka WebCodecs (`MediaStreamTrackProcessor + VideoEncoder`) z preferencją akceleracji HW; zapis do WebM.
- **Adaptacja jakości:** pętla FPS zmienia `renderScale` (LOD) zależnie od wydajności.

## Wersjonowanie (bieżący stan)
- **Branch:** `main`
- **Wersja:** 0.2.3 (patrz `CHANGELOG.md`)
- **Ostatnie zmiany:** mobile canvas nad panelem (FX widoczne podczas strojenia), usunięty mini-podgląd; poprawione skalowanie canvasu; preferencje audio nagrywania (jeden żywy tor, WebM/Opus).
- **Znane problemy:** wymaga testu live czułości Bass/Mid/High (ew. korekta mnożników/smoothing), potwierdzenia nagrywania i wydajności po zmianach.

## Uruchomienie lokalne
**Wymagania:** Node.js 18+

1. Instalacja zależności:  
   `npm install`
2. Dev server:  
   `npm run dev`
3. Build produkcyjny (sprawdzenie przed push):  
   `npm run build`

> Uwaga: aplikacja korzysta wyłącznie z zasobów lokalnych (brak zewnętrznych kluczy/API).
