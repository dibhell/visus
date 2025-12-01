# Changelog

## [Unreleased]
- Tuned audio-reactive mapping (pow+smoothing, FX clamp 24 / VU clamp 10) and smoothed band analysers (fftSize 256, smoothing 0.55).
- Removed debug overlay/log after validation of bandLevels/VU.

## [0.1.0] - 2025-11-27
- Added FFT fallback for bandLevels (Bass/Mid/High) so FX routing works even when filter bands are silent.
- Strengthened audio-reactive mapping (linear, high multiplier) and removed throttling/smoothing on FX VU updates.
- Added on-screen debug overlay/log for bandLevels and FX VU to diagnose audio-reactive flow.
- Removed spectrum gain/threshold UI; routing now uses raw bands.
- Fixed duplicate debug refs/state and ensured builds pass.

## [0.0.0] - Initial
- Initial Experimental mode scaffold (render worker, audio engine, FX routing, recording).
