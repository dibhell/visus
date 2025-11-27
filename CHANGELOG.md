# Changelog

## [0.1.0] - 2025-11-27
- Added FFT fallback for bandLevels (Bass/Mid/High) so FX routing works even when filter bands are silent.
- Strengthened audio-reactive mapping (linear, high multiplier) and removed throttling/smoothing on FX VU updates.
- Added on-screen debug overlay/log for bandLevels and FX VU to diagnose audio-reactive flow.
- Removed spectrum gain/threshold UI; routing now uses raw bands.
- Fixed duplicate debug refs/state and ensured builds pass.

## [0.0.0] - Initial
- Initial Experimental mode scaffold (render worker, audio engine, FX routing, recording).
