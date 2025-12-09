# Changelog

## [Unreleased]
- Playlist UX/backlog: np. playlista z klipami video (do rozważenia).

## [0.2.4] - 2025-12-09
- Performance: dynamic frame cap (auto 60→30→24), FFT sampling stride per performance mode (high/medium/low), UI/VU update limiter (domyślnie 20 FPS), pomijanie ciężkich FFT przy długich klatkach.
- Quality: nowy poziom Ultra Low (35%) oraz blokada rozdzielczości 0.5x dla słabych GPU; auto LOD respektuje blokadę.
- HUD: pasek statusu pokazuje dt, render scale, tryb renderu, cap mode i profil performance.
- Audio/recording: nagrywanie zawsze z miksu master; abort gdy brak aktywnego VIDEO/MUSIC/MIC.
- UI: Performance Lab zyskał przełącznik trybu performance, limit UI FPS oraz przełącznik automatycznego capu.

## [0.2.3] - 2025-12-03
- Mobile: canvas widoczny nad panelem (FX podczas strojenia), usunięty mini-podgląd.
- UI/mobile: pełna szerokość canvasu, wysokość ~45% ekranu przy otwartym panelu.
- Preview: usunięty dodatkowy overlay w Experimental, zostaje główny canvas.

## [0.2.2] - 2025-12-02
- Nagrywanie: wybór pojedynczego żywego toru audio (prior: captureStream audio -> miks -> captureStream video), WebM/Opus preferowane; brak pustych tracków.
- UI: throttling VU do ~25 Hz, render canvas uwzględnia szerokość panelu bocznego przy skalowaniu.
- WebGL: `powerPreference: high-performance`, antialias off dla mniejszego overheadu.
- Audio: `AudioContext` z `latencyHint: 'playback'` (mniej CPU).
- Build: Tailwind z lokalnego buildu (PostCSS), usunięto CDN.

## [0.2.1] - 2025-12-01
- Fallbacki nagrywania audio: miks + captureStream elementów, preferencja WebM/Opus, naprawione brak audio w plikach.
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
