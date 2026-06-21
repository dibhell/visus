#!/usr/bin/env python3
"""Real datamosh exporter for VISUS.

This works on encoded MPEG-4/AVI chunks, not decoded pixels. It uses ffmpeg
for a temporary MPEG-4 AVI transcode, then removes or repeats I/P frames in the
compressed stream to create classic scene-spill datamosh artifacts.
"""

from __future__ import annotations

import argparse
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

FRAME_MARKER = b"00dc"
VOP_START = b"\x00\x00\x01\xb6"
SEQ_START = b"\x00\x00\x01\xb0"


def run(cmd: list[str]) -> None:
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError as exc:
        raise SystemExit(f"Missing executable: {cmd[0]}") from exc
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"Command failed with exit code {exc.returncode}: {' '.join(cmd)}") from exc


def frame_payload(frame: bytes) -> bytes:
    if len(frame) <= 4:
        return b""
    declared = struct.unpack_from("<I", frame, 0)[0]
    payload = frame[4:]
    if 0 < declared <= len(payload):
        return payload[:declared]
    return payload


def frame_kind(frame: bytes) -> str:
    payload = frame_payload(frame)
    if not payload:
        return "other"
    # MPEG-4 Visual VOP coding type: first two bits after 00 00 01 B6.
    pos = payload.find(VOP_START)
    if pos >= 0 and pos + 4 < len(payload):
        coding_type = (payload[pos + 4] >> 6) & 0b11
        return ("i", "p", "b", "s")[coding_type]
    # Some key frames include sequence/VOL headers before the VOP. Treat those
    # as I-like because they refresh decoder state and break the mosh trail.
    if SEQ_START in payload:
        return "i"
    return "other"


def split_avi_chunks(data: bytes) -> tuple[bytes, list[bytes]]:
    chunks: list[tuple[int, int]] = []
    pos = data.find(FRAME_MARKER)
    while pos >= 0:
        if pos + 8 <= len(data):
            size = struct.unpack_from("<I", data, pos + 4)[0]
            end = pos + 8 + size + (size & 1)
            # A real AVI chunk has a plausible bounded payload. If this marker
            # appears inside compressed data, skip it and continue scanning.
            if 0 < size < len(data) and end <= len(data):
                chunks.append((pos, end))
                pos = data.find(FRAME_MARKER, end)
                continue
        pos = data.find(FRAME_MARKER, pos + 1)

    if len(chunks) < 2:
        raise SystemExit("No AVI video chunks found. The temporary file is not MPEG-4 AVI-like enough to mosh.")

    header = data[: chunks[0][0]]
    frames = [data[start + len(FRAME_MARKER): end] for start, end in chunks]
    return header, frames


def rebuild_avi(header: bytes, frames: list[bytes]) -> bytes:
    out = bytearray(header)
    for frame in frames:
        out += FRAME_MARKER
        out += frame
    return bytes(out)


def effect_bounds(frames: list[bytes], start: int, end: int) -> tuple[int, int]:
    video_count = sum(1 for frame in frames if frame_kind(frame) in {"i", "p", "b"})
    if end <= 0 or end > video_count:
        end = video_count
    start = max(0, min(start, video_count))
    end = max(start, min(end, video_count))
    return start, end


def mosh_frames(frames: list[bytes], mode: str, start: int, end: int, repeat: int, glide: int) -> list[bytes]:
    start, end = effect_bounds(frames, start, end)
    repeat = max(1, repeat)
    glide = max(2, glide)
    result: list[bytes] = []
    p_buffer: list[bytes] = []
    last_delta: bytes | None = None
    video_index = -1
    glide_tick = 0

    for frame in frames:
        kind = frame_kind(frame)
        is_video = kind in {"i", "p", "b"}
        if not is_video:
            result.append(frame)
            continue

        video_index += 1
        active = start <= video_index < end
        if not active:
            result.append(frame)
            if kind != "i":
                last_delta = frame
            continue

        if mode in {"classic", "void"}:
            if kind == "i":
                continue
            copies = repeat if mode == "classic" else 1
            result.extend([frame] * copies)
            last_delta = frame
            continue

        if mode == "repeat":
            if kind == "i":
                continue
            if len(p_buffer) < repeat:
                p_buffer.append(frame)
                result.append(frame)
            else:
                result.append(p_buffer[video_index % len(p_buffer)])
            last_delta = frame
            continue

        if mode == "glide":
            if kind != "i":
                last_delta = frame
            glide_tick += 1
            if glide_tick > glide and last_delta is not None:
                result.append(last_delta)
                if glide_tick > glide * 2:
                    glide_tick = 0
            elif kind != "i":
                result.append(frame)
            continue

        result.append(frame)

    return result


def transcode_to_mpeg4_avi(ffmpeg: str, src: Path, dst: Path, gop: int, fps: float | None) -> None:
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(src),
        "-an",
        "-c:v",
        "mpeg4",
        "-q:v",
        "2",
        "-bf",
        "0",
        "-g",
        str(gop),
    ]
    if fps:
        cmd.extend(["-r", str(fps)])
    cmd.append(str(dst))
    run(cmd)


def remux_video(ffmpeg: str, src: Path, dst: Path) -> None:
    # Regenerate timestamps/index after deliberately damaged frame ordering.
    run([ffmpeg, "-y", "-fflags", "+genpts", "-i", str(src), "-c:v", "copy", "-an", str(dst)])


def main() -> int:
    parser = argparse.ArgumentParser(description="Create real datamosh by manipulating MPEG-4 AVI I/P frames.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--mode", choices=["classic", "void", "repeat", "glide"], default="classic")
    parser.add_argument("--start-frame", type=int, default=0)
    parser.add_argument("--end-frame", type=int, default=-1)
    parser.add_argument("--repeat", type=int, default=2, help="P-frame repeat multiplier or repeat buffer size")
    parser.add_argument("--glide", type=int, default=12, help="Glide interval in frames")
    parser.add_argument("--gop", type=int, default=18, help="Temporary MPEG-4 keyframe interval")
    parser.add_argument("--fps", type=float, default=None, help="Optional temporary FPS normalization")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--keep-temp", action="store_true")
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input file not found: {args.input}")
    if shutil.which(args.ffmpeg) is None and not Path(args.ffmpeg).exists():
        raise SystemExit("ffmpeg not found. Install ffmpeg or pass --ffmpeg C:\\path\\to\\ffmpeg.exe")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="visus_datamosh_"))
    try:
        encoded = tmp / "encoded.avi"
        damaged = tmp / "damaged.avi"
        transcode_to_mpeg4_avi(args.ffmpeg, args.input, encoded, args.gop, args.fps)

        data = encoded.read_bytes()
        header, frames = split_avi_chunks(data)
        moshed = mosh_frames(frames, args.mode, args.start_frame, args.end_frame, args.repeat, args.glide)
        damaged.write_bytes(rebuild_avi(header, moshed))
        remux_video(args.ffmpeg, damaged, args.output)
    finally:
        if args.keep_temp:
            print(f"Temporary files kept at: {tmp}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)

    print(f"Wrote true datamosh: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())