# True Datamosh Export

`tools/true_datamosh.py` creates a real datamosh by manipulating encoded MPEG-4 AVI frames. This is separate from the realtime WebGL preview, because browser shaders only see decoded pixels and cannot remove I/P/B frames from the compressed stream.

## Requirements

- Python 3.11+
- `ffmpeg` available in `PATH`, or pass `--ffmpeg C:\path\to\ffmpeg.exe`

## Basic Use

```powershell
python tools\true_datamosh.py input.mp4 output.avi --mode classic --start-frame 120 --end-frame 260 --repeat 3 --gop 18 --fps 24
```

## Modes

- `classic`: removes I-frames in the selected frame range and repeats P/B frames.
- `void`: removes I-frames and keeps delta frames once.
- `repeat`: builds a small delta-frame buffer and cycles it.
- `glide`: periodically duplicates the last delta frame.

## Tuning

- `--start-frame` / `--end-frame`: range where keyframes are removed.
- `--repeat`: stronger P-frame repetition for `classic` and buffer size for `repeat`.
- `--gop`: temporary keyframe interval. Lower values create more possible cut points; higher values create longer prediction chains.
- `--fps`: optional FPS normalization before damaging the stream.

The output is intentionally damaged. Some players are stricter than others, so `.avi` is the safest target for previewing the result.