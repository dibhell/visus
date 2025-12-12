# Changelog

## [Unreleased]
- Playlist UX/backlog: np. playlista z klipami video (do rozwazenia).

## [0.2.7] - 2025-12-11
- Spectrum: hi-res FFT z biasem na bas, sampler max zamiast sredniej, auto-gain bez twardego progu; fallback bands aktywny.
- Spectrum UX: drag punktow bez uciekania, blokada globalnego scrolla przy kreceniu width/Q, panel Auto gain/Shape zawsze widoczny.
- Performance Lab: uporzadkowany layout sekcji Pipeline (checkboxy, spojne naglowki).
- Assets: nowa ikona public/icon.png + wygenerowany public/favicon.ico.

## [0.2.6] - 2025-12-10
- Startup: nowe flagi diagnostyczne (debug_nogl, debug_noaudio, debug_noworker) oraz czytelne logi inicjalizacji GL/Audio/Worker.
- Stabilnosc: Error Boundary dla ExperimentalAppFull, instancje FastGL/Audio tworzone w useEffect (brak ciezkich obiektow w renderze).
- Debug: worker preference respektuje flage wylaczajaca worker; mock/layout bez zmian.

## [0.2.5] - 2025-12-10
- Audio: worklet (RMS/bands/buckets) jako glowny FFT z przelacznikiem fallback; mniej getByteFrequencyData na glownym watku.
- Render: scheduler requestVideoFrameCallback (toggle), histereza Auto Scale (10 klatek <25 FPS down, 20 klatek >50 FPS up, cool-down).
- WebGL: batched uniformy FX (float/int arrays) + cache program/texture; HUD w memo.
- UI: Performance Lab w memo PanelSettings, memo SpectrumVisualizer/FxSlot/MixerChannel/HUD, stabilne propsy (useCallback).
- Dev: devtools/benchmark.js (runVisusBenchmark) do logowania FPS/dt/scale; TODO z testem memory-leak 10 min.

## [0.2.4] - 2025-12-09
- Performance: dynamic frame cap (auto 60->30->24), FFT sampling stride per performance mode (high/medium/low), UI/VU update limiter (domyslnie 20 FPS), pomijanie ciezkich FFT przy dlugich klatkach.
- Quality: nowy poziom Ultra Low (35%) oraz blokada rozdzielczosci 0.5x dla slabszych GPU; auto LOD respektuje blokade.
- HUD: pasek statusu pokazuje dt, render scale, tryb renderu, cap mode i profil performance.
- Audio/recording: nagrywanie zawsze z miksu master; abort gdy brak aktywnego VIDEO/MUSIC/MIC.
- UI: Performance Lab zyskal przelacznik trybu performance, limit UI FPS oraz przelacznik automatycznego capu.

## [0.2.3] - 2025-12-03
- Mobile: canvas widoczny nad panelem (FX podczas strojenia), usuniety mini-podglad.
- UI/mobile: pelna szerokosc canvasu, wysokosc ~45% ekranu przy otwartym panelu.
- Preview: usuniety dodatkowy overlay w Experimental, zostaje glowny canvas.

## [0.2.2] - 2025-12-02
- Nagrywanie: wybor pojedynczego zywego toru audio (prior: captureStream audio -> miks -> captureStream video), WebM/Opus preferowane; brak pustych trackow.
- UI: throttling VU do ~25 Hz, render canvas uwzglednia szerokosc panelu bocznego przy skalowaniu.
- WebGL: powerPreference: high-performance, antialias off dla mniejszego overheadu.
- Audio: AudioContext z latencyHint: 'playback' (mniej CPU).
- Build: Tailwind z lokalnego buildu (PostCSS), usunieto CDN.

## [0.2.1] - 2025-12-01
- Fallbacki nagrywania audio: miks + captureStream elementow, preferencja WebM/Opus, naprawione brak audio w plikach.
- Credits zaktualizowane do v0.2.1.

## [0.2.0] - 2025-11-28
- Added new shader effects (118-139): liquid/glitch/echo variants including chroma fracture, liquid VHS, voronoi melt, feedback echo, hex glass, visc glitch, melt shift, drip chroma, fluid smear, wave slice, liquid echo, fluid feedback, gel trail, visc ripple, chroma wash, neural bloom, data stream, slit scan, anaglyph drift, ascii plasma, fractal flames, polar glitch.
- Adjusted audio-reactive smoothing (FX 0.30, VU 0.35) and band analysers (fftSize 256, smoothing 0.45, smoothing mix 50/50).
- Added boot loader overlay during renderer/audio init to avoid freeze perception.
- Ongoing: validate audio presence in WebM recordings.

## [0.1.0] - 2025-11-27
- Added FFT fallback for bandLevels (Bass/Mid/High) so FX routing works even when filter bands are silent.
- Strengthened audio-reactive mapping (linear, high multiplier) and removed throttling/smoothing on FX VU updates.
- Added on-screen debug overlay/log for bandLevels and FX VU to diagnose audio-reactive flow.
- Removed spectrum gain/threshold UI; routing now uses raw bands.
- Fixed duplicate debug refs/state and ensured builds pass.

## [0.0.0] - Initial
- Initial Experimental mode scaffold (render worker, audio engine, FX routing, recording).
