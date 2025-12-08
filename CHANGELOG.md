# Changelog

## [Unreleased]
- Render/perf: clamp canvas render resolution do 1920x1080 (zachowuje aspect), VU tick co ~200 ms, FPS/UI co ~250 ms zeby zmniejszyc ruch w React.
- WebGL: kesz uniform/attrib w `GLService` + `UNPACK_FLIP_Y_WEBGL` ustawione w init (mniej `getUniformLocation` na kazdej klatce).
- Nagrywanie: `canvas.captureStream` na 24 fps dla MediaRecorder (stabilniejsze bitrate).
- Playlist UX/backlog: playlista z klipami video (do rozwazenia).

## [0.2.3] - 2025-12-03
- Mobile: canvas widoczny nad panelem (FX podczas strojenia), usuniety mini-podglad.
- UI/mobile: pelna szerokosc canvasu, wysokosc ~45% ekranu przy otwartym panelu.
- Preview: usuniety dodatkowy overlay w Experimental, zostaje glowny canvas.

## [0.2.2] - 2025-12-02
- Nagrywanie: wybor pojedynczego zywego toru audio (prior: captureStream audio -> miks -> captureStream video), WebM/Opus preferowane; brak pustych trackow.
- UI: throttling VU do ~25 Hz, render canvas uwzglednia szerokosc panelu bocznego przy skalowaniu.
- WebGL: `powerPreference: high-performance`, antialias off dla mniejszego overheadu.
- Audio: `AudioContext` z `latencyHint: 'playback'` (mniej CPU).
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
