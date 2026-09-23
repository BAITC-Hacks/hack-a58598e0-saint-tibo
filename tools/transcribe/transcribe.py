"""Private JSONL pipe consumed by the processing worker, never a public/logging interface."""

import argparse
import json
import logging
import math
import os
from pathlib import Path
import sys
import wave

from prepare_model import prepared_model


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False, allow_nan=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument(
        "--language", choices=("auto", "ru", "kk", "mixed"), required=True
    )
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    args = parser.parse_args()
    stage = "stt_model_unavailable"
    try:
        spec = prepared_model(args.model_dir)
        os.environ.update(
            {
                "HF_HUB_OFFLINE": "1",
                "HF_HUB_DISABLE_TELEMETRY": "1",
                "DO_NOT_TRACK": "1",
                "OMP_NUM_THREADS": "4",
                "CT2_VERBOSE": "0",
            }
        )
        logging.disable(logging.CRITICAL)
        import ctranslate2
        from faster_whisper import WhisperModel

        ctranslate2.set_log_level(logging.ERROR)
        if args.device == "cuda" and (
            ctranslate2.get_cuda_device_count() < 1
            or "float16" not in ctranslate2.get_supported_compute_types("cuda")
        ):
            raise RuntimeError("CUDA float16 unavailable")
        model = WhisperModel(
            str(args.model_dir),
            device=args.device,
            compute_type="float16" if args.device == "cuda" else "int8",
            cpu_threads=4,
            num_workers=1,
            local_files_only=True,
        )
        stage = "transcription_failed"
        with wave.open(str(args.audio), "rb") as audio:
            frames, sample_rate = audio.getnframes(), audio.getframerate()
            duration_ms = (frames * 1000 + sample_rate - 1) // sample_rate
        segments, info = model.transcribe(
            str(args.audio),
            language=args.language if args.language in ("ru", "kk") else None,
            task="transcribe",
            multilingual=args.language == "mixed",
            beam_size=5,
            best_of=1,
            temperature=0.0,
            condition_on_previous_text=False,
            word_timestamps=False,
            vad_filter=False,
            log_progress=False,
        )
        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            if not math.isfinite(segment.start) or not math.isfinite(segment.end):
                raise ValueError("Invalid model timestamps")
            start_ms = round(segment.start * 1000)
            # Whisper can place its final end token past EOF. Clip only that end to
            # the physical recording boundary; never remove pauses or shift starts.
            end_ms = min(round(segment.end * 1000), duration_ms)
            if not 0 <= start_ms < end_ms <= duration_ms:
                stage = "invalid_transcript_timing"
                raise ValueError("Invalid model timestamps")
            emit(
                {
                    "event": "segment",
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "text": text,
                }
            )
        emit(
            {
                "event": "done",
                "language": info.language,
                "duration_ms": duration_ms,
                "model_id": spec["model"],
                "model_revision": spec["revision"],
            }
        )
        return 0
    except Exception:
        # Exceptions from decoders/models may contain private text or paths.
        emit({"event": "error", "code": stage})
        return 1


if __name__ == "__main__":
    sys.exit(main())
