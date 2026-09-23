"""Regenerate checked-in synthetic WAVs after generate_speech.ps1 on Windows."""

import json
import wave
from pathlib import Path

root = Path(__file__).parent
parts = []
for index in range(4):
    with wave.open(str(root / "speech-parts" / f"{index}.wav"), "rb") as source:
        params = source.getparams()
        parts.append(source.readframes(source.getnframes()))

assert params.nchannels == 1 and params.sampwidth == 2
rate = params.framerate
gap = b"\0\0" * (rate // 2)
timings = {}
for name, order in {"ru": (0, 1, 2), "mixed": (0, 1, 3), "live": (0, 1, 3)}.items():
    audio = bytearray(gap)
    spans = []
    for part in order:
        start = len(audio) * 1000 // (rate * 2)
        audio.extend(parts[part])
        end = len(audio) * 1000 // (rate * 2)
        spans.append([start, end])
        audio.extend(gap)
    with wave.open(str(root / f"speech-{name}.wav"), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(audio)
    timings[name] = spans
(root / "speech-timing.json").write_text(json.dumps(timings), encoding="utf-8")
