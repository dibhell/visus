<div align="center">
<img width="220" height="220" alt="VISUS Experimental Engine" src="./public/icon.png" />
</div>

# VISUS Experimental Engine

VISUS to przeglądarkowy silnik VJ/AV: miksuje wideo (pliki, kamera), audio (pliki, mic), nakłada shadery WebGL jako efekty, reaguje na pasma audio i potrafi nagrywać output do WebM (MediaRecorder lub WebCodecs). UI umożliwia sterowanie geometrią, proporcjami, łańcuchem FX (Depth/Wet), routingiem FX na pasma (Bass/Mid/High) lub BPM, a także adaptacyjne skalowanie jakości pod FPS.

## Jak jest zbudowana
- **Frontend:** React + TypeScript + Vite.
- **Render:** WebGL (GLSL fragment shader) z OffscreenCanvas w workerze (`RenderWorker`) i fallbackiem na główny wątek; `FastGLService` zarządza teksturą wideo i uniformami FX.
- **Audio:** Web Audio API (AnalyserNode, BiquadFilter) z dedykowanym `ExperimentalAudioEngine`, tap-analyserami prefader, filtrowaniem pasm (sync1/2/3) i FFT do widma/sterowania FX.
- **Nagrywanie:** MediaRecorder oraz ścieżka WebCodecs (`MediaStreamTrackProcessor + VideoEncoder`) z preferencją akceleracji HW; zapis do WebM.
- **Adaptacja jakości:** pętla FPS zmienia `renderScale` (LOD) zależnie od wydajności.

## Wersjonowanie (bieżący stan)
- **Branch:** `main`
- **Wersja:** 0.1.0 (patrz `CHANGELOG.md`)
- **Ostatnie zmiany:** FFT fallback dla bandLevels (Bass/Mid/High) → FX reagują na pasma; mocne, liniowe mapowanie FX/VU; aktualizacja VU co klatkę; UI gain/threshold wyłączone.
- **Znane problemy:** potrzeba strojenia czułości (pow/multiplier/clamp) i usunięcia debug overlay po walidacji; docelowo przywrócić lekkie smoothing po potwierdzeniu reakcji.

## Uruchomienie lokalne
**Wymagania:** Node.js 18+

1. Instalacja zależności:  
   `npm install`
2. Dev server:  
   `npm run dev`
3. Build produkcyjny (sprawdzenie przed push):  
   `npm run build`

> Uwaga: aplikacja korzysta wyłącznie z zasobów lokalnych (brak zewnętrznych kluczy/API).
