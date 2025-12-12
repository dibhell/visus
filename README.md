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
- **Adaptacja jakosci:** petla FPS zmienia `renderScale` (LOD) w zaleznosci od wydajnosci.

## Wersjonowanie (biezacy stan)
- **Branch:** `main`
- **Wersja:** 0.2.7 (patrz `CHANGELOG.md`)
- **Ostatnie zmiany:** hi-res spectrum (FFT 16384, bias na bas, sampler max, auto-gain bez progu, fallback na bands), stabilniejszy drag punktow + blokada scrolla przy width/Q, panel Auto gain/Shape stale widoczny, uporzadkowany Performance Lab (Pipeline), nowa ikona + favicon. Wczesniej: diagnostyczne flagi startowe, dynamiczny frame cap, Performance Mode (FFT co 1/2/3), limiter UI 20 FPS, Ultra Low 35% + lock 0.5x, HUD z dt/mode/cap, nagrywanie z miksu master.
- **Znane problemy:** do potwierdzenia live: czulosc Bass/Mid/High vs nowe spektrum; wydajnosc na slabszych GPU (1080p + FX); batchowanie uniformow WebGL w toku.

## Uruchomienie lokalne
**Wymagania:** Node.js 18+

1. Instalacja zaleznosci:  
   `npm install`
2. Dev server:  
   `npm run dev`
3. Build produkcyjny (sprawdzenie przed push):  
   `npm run build`

> Uwaga: aplikacja korzysta wylacznie z zasobow lokalnych (brak zewnetrznych kluczy/API).
