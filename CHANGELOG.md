# Changelog

## [Unreleased]
- Track WebM audio validation for recordings; ensure MediaRecorder/WebCodecs capture audio tracks.

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
