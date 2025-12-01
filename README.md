<div align="center">
<img width="220" height="220" alt="VISUS Experimental Engine" src="./public/icon.png" />
</div>

# VISUS Experimental Engine

VISUS to przegl?darkowy silnik VJ/AV: miksuje wideo (pliki, kamera), audio (pliki, mic), nak?ada shadery WebGL jako efekty, reaguje na pasma audio i potrafi nagrywa? output do WebM (MediaRecorder lub WebCodecs). UI umo?liwia sterowanie geometri?, proporcjami, ?a?cuchem FX (Depth/Wet), routingiem FX na pasma (Bass/Mid/High) lub BPM, a tak?e adaptacyjne skalowanie jako?ci pod FPS.

## Jak jest zbudowana
- **Frontend:** React + TypeScript + Vite.
- **Render:** WebGL (GLSL fragment shader) z OffscreenCanvas w workerze (`RenderWorker`) i fallbackiem na g??wny w?tek; `FastGLService` zarz?dza tekstur? wideo i uniformami FX.
- **Audio:** Web Audio API (AnalyserNode, BiquadFilter) z dedykowanym `ExperimentalAudioEngine`, tap-analyserami prefader, filtrami pasm (sync1/2/3), FFT fallbackiem dla bandLevels oraz szybkim VU (`getLevelsFast`).
- **Nagrywanie:** MediaRecorder oraz ?cie?ka WebCodecs (`MediaStreamTrackProcessor + VideoEncoder`) z preferencj? akceleracji HW; zapis do WebM.
- **Adaptacja jako?ci:** p?tla FPS zmienia `renderScale` (LOD) zale?nie od wydajno?ci.

## Wersjonowanie (bie??cy stan)
- **Branch:** `main`
- **Wersja:** 0.1.0 (patrz `CHANGELOG.md`)
- **Ostatnie zmiany:** strojenie audio-reactive (pow+smoothing, sufit FX 24 / VU 10), stabilniejsze band analysers (fftSize 256, smoothing 0.55 + wyg?adzanie), FFT fallback clamp 1, wy??czony debug overlay/log.
- **Znane problemy:** wymaga testu live czu?o?ci Bass/Mid/High (ew. korekta mno?nik?w/smoothing), potwierdzenia nagrywania i wydajno?ci po zmianach.

## Uruchomienie lokalne
**Wymagania:** Node.js 18+

1. Instalacja zale?no?ci:  
   `npm install`
2. Dev server:  
   `npm run dev`
3. Build produkcyjny (sprawdzenie przed push):  
   `npm run build`

> Uwaga: aplikacja korzysta wy??cznie z zasob?w lokalnych (brak zewn?trznych kluczy/API).
