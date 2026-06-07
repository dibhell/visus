# VISUS Native - Phase 1 UI Architecture

This phase focuses on a production-quality Compose UI scaffold that mirrors the VISUS panels while staying ready for the GL / CameraX / MediaCodec plumbing coming next.

## App shell
- `MainApplication` holds lazy singletons for audio/GL controllers when they arrive.
- `MainActivity` uses `setContent { VisusApp() }` and keeps an `AndroidView` bridge for the GLSurfaceView/renderer.
- `VisusApp` hosts the dark, neon-styled layout and collects state from a single `VisusViewModel`.

## State + ViewModel
- `VisusViewModel` exposes immutable `StateFlow` models for:
  - `MixerState` with three `ChannelState` entries (video, music, mic) supporting fader, mute, solo, bypass, meters, transport info.
  - `OutputState` for aspect ratios, mirror, scale/pan, and computed frame info.
  - `SpectrumState` for bass/mid/high magnitudes, smoothing, and peak flags plus the band selector for analysis source.
  - `FxChainState` with `FxSlotState` (header + 4 layers) and shared knob values.
  - `RecordingState` for armed/recording flags, elapsed time, and last saved path.
- Actions exposed as intent-style methods (e.g., `onFaderChange`, `selectAspect`, `toggleRecording`) to be wired to real engines later.

## UI composition
- `VisusScaffold` wraps a GLSurfaceView overlay with translucent, touch-friendly control panels.
- Panels:
  - **Source Mixer**: three `MixerChannelCard` composables with fader, mute/solo/bypass, meters, and transport buttons; includes source selectors.
  - **Output & Framing**: aspect ratio chips, mirror toggle, and knobs for scale / pan X / pan Y; live canvas/source readouts.
  - **Spectrum & BPM**: animated `SpectrumOrbs` for bass/mid/high, BPM slider/field, and phase offset control.
  - **Main FX Controls**: grouped knobs (intensity, scale/zoom, distort, speed, offsets, color shift, exposure/contrast, blur/sharp, glitch, mix).
  - **FX Chain**: cards for Header + 4 layers with preset dropdown, key parameter knobs, and blend mode selector.
  - **Recording**: glowing record toggle, status pill, and target path text.

## Visual language
- Dark base, neon accents (cyan/magenta/acid green), rounded panels, consistent spacing, and smooth press/active states.
- Knob component supports double-tap reset and percent/value display.

## Extensibility hooks
- Spectrum view consumes `SpectrumState` and exposes callbacks to retune filters.
- FX slots expose uniform-ready values to be passed into GL renderer.
- Recording bar already holds the intended MediaCodec hooks for next phase.

## Upcoming integration scope
- AudioRecord + FFT routing for BASS/MID/HIGH and BPM detection.
- Music search: integrate iTunes Search API for preview/selection as MUSIC source.
- CameraX (front/rear) + SurfaceTexture OES and video file transport.
- Shader manager, GLSL presets, and uniform plumbing to GL renderer.
- MediaCodec + MediaMuxer dual-surface recording with AAC audio.
- Permissions, lifecycle handling, performance (60 FPS target).
