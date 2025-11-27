<div align="center">
<img width="1200" height="475" alt="VISUS Experimental Engine" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
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
- **Repo branch:** `main`
- **Ostatnie commit-y:** sprawdź `git log --oneline` (np. `2db9b4a` i późniejsze) – zawierają poprawki FFT, tap analyserów, wzmocnienie modulacji FX i dokumentację usprawnień.
- **TODO / plan (skrót):**
  - Dynamiczne VU dla slotów FX (`fxVuLevels`), mocniejsza modulacja FX według pasm.
  - Finalny tuning routingu FX i czułości.
  - Dodatkowe testy WebCodecs/WebGL w przeglądarce.

## Uruchomienie lokalne
**Wymagania:** Node.js 18+

1. Instalacja zależności:  
   `npm install`
2. Dev server:  
   `npm run dev`
3. Build produkcyjny (sprawdzenie przed push):  
   `npm run build`

> Uwaga: aplikacja korzysta wyłącznie z zasobów lokalnych (brak zewnętrznych kluczy/API).
