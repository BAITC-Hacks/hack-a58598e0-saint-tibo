#!/usr/bin/env python3
"""Offline CPU benchmark; install the optional STT environment separately.

Only local PCM16/16kHz/mono WAV and a complete CTranslate2 model are accepted.
Stdout contains metrics, never transcript text. See docs/stt-feasibility.md.
"""

import argparse
import hashlib
import importlib.metadata
import json
import logging
import math
import os
from pathlib import Path
import platform
import resource
import sys
import time
import wave


def sha256(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def write_private(path, data):
    # Refuse overwrites, including symlinks; never inherit a public file mode.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as target:
        json.dump(data, target, ensure_ascii=False, indent=2, allow_nan=False)
        target.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--model-revision", required=True, help="Pinned source revision, not a model alias")
    parser.add_argument("--language", choices=("ru", "kk", "auto", "mixed"), required=True)
    parser.add_argument("--threads", type=int, choices=range(1, 9), default=4)
    parser.add_argument("--beam-size", type=int, choices=(1, 5), default=5)
    parser.add_argument("--vad", action="store_true", help="Compare against the default without VAD")
    parser.add_argument("--output", required=True, type=Path, help="New metrics JSON file (mode 0600)")
    parser.add_argument("--transcript-output", type=Path, help="Optional private text/timestamps JSON; never commit it")
    args = parser.parse_args()
    stage = "validate_inputs"
    try:
        if not args.audio.is_file() or not args.model_dir.is_dir():
            raise ValueError("Local paths required")
        if len(args.model_revision) != 40 or any(c not in "0123456789abcdef" for c in args.model_revision):
            raise ValueError("Use a full lowercase source commit hash")
        model_files = [args.model_dir / name for name in ("model.bin", "config.json", "tokenizer.json")]
        if not all(path.is_file() for path in model_files):
            raise ValueError("Incomplete local model; tokenizer fallback is not allowed")
        model_files += [path for name in ("preprocessor_config.json", "vocabulary.json", "vocabulary.txt")
                        if (path := args.model_dir / name).is_file()]
        outputs = [path for path in (args.output, args.transcript_output) if path is not None]
        if len({path.resolve() for path in outputs}) != len(outputs):
            raise ValueError("Output paths must differ")
        if any(path.exists() or path.is_symlink() or not path.parent.is_dir() for path in outputs):
            raise ValueError("Output must be a new file in an existing private directory")
        with wave.open(str(args.audio), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(), source.getframerate(), source.getcomptype()) != (1, 2, 16000, "NONE"):
                raise ValueError("Normalize input to PCM16/16kHz/mono WAV first")
            duration_s = source.getnframes() / source.getframerate()
        if duration_s <= 0:
            raise ValueError("Empty input")
        audio_hash = sha256(args.audio)
        model_hashes = {path.name: sha256(path) for path in model_files}

        # Set before imports. This is defense in depth; use --network none for proof.
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        os.environ["DO_NOT_TRACK"] = "1"
        os.environ["OMP_NUM_THREADS"] = str(args.threads)
        os.environ["CT2_VERBOSE"] = "0"
        logging.disable(logging.CRITICAL)
        stage = "import_runtime"
        import ctranslate2
        from faster_whisper import WhisperModel

        versions = {name: importlib.metadata.version(name) for name in (
            "faster-whisper", "ctranslate2", "av", "tokenizers", "onnxruntime", "huggingface-hub", "numpy",
        )}
        ctranslate2.set_log_level(logging.ERROR)
        if "int8" not in ctranslate2.get_supported_compute_types("cpu"):
            raise RuntimeError("INT8 unavailable on this runtime")
        stage = "load_model"
        started = time.perf_counter()
        model = WhisperModel(str(args.model_dir.resolve()), device="cpu", compute_type="int8",
                             cpu_threads=args.threads, num_workers=1, local_files_only=True)
        load_s = time.perf_counter() - started
        stage = "transcribe"
        started = time.perf_counter()
        segments, info = model.transcribe(
            str(args.audio.resolve()),
            language=args.language if args.language in ("ru", "kk") else None,
            task="transcribe", multilingual=args.language == "mixed",
            beam_size=args.beam_size, best_of=1, temperature=0.0,
            condition_on_previous_text=False, word_timestamps=False,
            vad_filter=args.vad, log_progress=False,
        )
        # Inference is lazy: timing must include consuming the whole iterator.
        segments = list(segments)
        inference_s = time.perf_counter() - started
        duration_ms = round(duration_s * 1000)
        invalid_bounds = 0
        transcript = []
        for segment in segments:
            valid = math.isfinite(segment.start) and math.isfinite(segment.end)
            start_ms = round(segment.start * 1000) if valid else None
            end_ms = round(segment.end * 1000) if valid else None
            if not valid or not 0 <= start_ms < end_ms <= duration_ms:
                invalid_bounds += 1
            transcript.append({"index": segment.id, "start_ms": start_ms,
                               "end_ms": end_ms, "text": segment.text})
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        result = {
            "schema_version": 1, "status": "ok", "audio_sha256": audio_hash,
            "model_source_revision": args.model_revision, "model_files_sha256": model_hashes,
            "runtime": versions, "python": platform.python_version(),
            "platform": platform.system(), "architecture": platform.machine(),
            "visible_cpu_count": os.cpu_count(), "device": "cpu", "compute_type": "int8",
            "threads": args.threads, "num_workers": 1, "beam_size": args.beam_size,
            "language_mode": args.language, "detected_language": info.language,
            "multilingual": args.language == "mixed", "temperature": 0.0,
            "condition_on_previous_text": False, "word_timestamps": False, "vad": args.vad,
            "duration_ms": duration_ms, "load_seconds": round(load_s, 4),
            "inference_seconds": round(inference_s, 4), "rtf": round(inference_s / duration_s, 4),
            "process_peak_rss_bytes": rss if sys.platform == "darwin" else rss * 1024,
            "segment_count": len(segments), "invalid_segment_bounds": invalid_bounds,
            "offline_flags_enabled": True, "network_isolation_verified": False,
            "quality_review": "pending",
        }
        stage = "write_results"
        if args.transcript_output is not None:
            write_private(args.transcript_output, {"audio_sha256": audio_hash, "segments": transcript})
        write_private(args.output, result)
        print(json.dumps(result, allow_nan=False))
        return 0
    except Exception as error:
        # Library error messages can contain private paths or decoded text.
        print(json.dumps({"status": "error", "stage": stage, "error_type": type(error).__name__}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
