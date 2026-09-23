"""Local anonymous diarization. Stdout is a private JSONL pipe, never a log."""

import argparse
import importlib.metadata
import json
import logging
import math
import os
from pathlib import Path
import wave

from bundle import BUNDLE_ID, FILES, MANIFEST, verify_bundle


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, allow_nan=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--num-speakers", type=int, default=-1,
                        help="Known speaker count (1..32); default -1 estimates it")
    parser.add_argument("--threads", type=int, choices=range(1, 9), default=4)
    args = parser.parse_args()
    # Native model/decoder diagnostics may contain private paths. The supervisor
    # also discards stderr and terminates the process group on cancellation.
    with open(os.devnull, "w") as sink:
        os.dup2(sink.fileno(), 2)
    logging.disable(logging.CRITICAL)
    os.environ.update({"HF_HUB_OFFLINE": "1", "HF_HUB_DISABLE_TELEMETRY": "1",
                       "DO_NOT_TRACK": "1", "OMP_NUM_THREADS": str(args.threads)})
    stage = "diarization_model_unavailable"
    try:
        verify_bundle(args.model_dir)
        for package, version in MANIFEST["runtime"].items():
            if importlib.metadata.version(package) != version:
                raise ValueError("Unexpected runtime version")
        import numpy as np
        import sherpa_onnx

        stage = "invalid_diarization_input"
        if args.num_speakers != -1 and not 1 <= args.num_speakers <= 32:
            raise ValueError("Invalid known speaker count")
        with wave.open(str(args.audio), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 16000):
                raise ValueError("Expected normalized PCM16 mono 16kHz audio")
            frames = source.getnframes()
            if not 0 < frames <= 4 * 60 * 60 * 16000:
                raise ValueError("Unsupported audio duration")
            pcm = source.readframes(frames)
            if len(pcm) != frames * 2:
                raise ValueError("Truncated audio")
        duration_ms = (frames * 1000 + 15999) // 16000
        samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        del pcm
        stage = "diarization_failed"
        config = sherpa_onnx.OfflineSpeakerDiarizationConfig(
            segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
                pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                    model=str(args.model_dir / "segmentation.onnx"), window_shift_ratio=0.1,
                ),
                num_threads=args.threads, provider="cpu", debug=False,
            ),
            embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                model=str(args.model_dir / "embedding.onnx"),
                num_threads=args.threads, provider="cpu", debug=False,
            ),
            clustering=sherpa_onnx.FastClusteringConfig(num_clusters=args.num_speakers, threshold=0.5),
            min_duration_on=0.3, min_duration_off=0.5,
        )
        if not config.validate():
            raise ValueError("Invalid diarization configuration")
        diarizer = sherpa_onnx.OfflineSpeakerDiarization(config)
        if diarizer.sample_rate != 16000:
            raise ValueError("Unexpected model sample rate")
        turns = diarizer.process(samples).sort_by_start_time()
        if not turns:
            emit({"event": "error", "code": "speech_not_detected"})
            return 1
        labels: dict[int, str] = {}
        output = []
        for turn in turns:
            if len(output) >= 20000 or not math.isfinite(turn.start) or not math.isfinite(turn.end):
                raise ValueError("Invalid diarization output")
            start_ms = max(0, math.floor(turn.start * 1000))
            end_ms = min(duration_ms, math.ceil(turn.end * 1000))
            if not 0 <= start_ms < end_ms <= duration_ms or turn.speaker < 0:
                raise ValueError("Invalid speaker interval")
            label = labels.setdefault(turn.speaker, f"speaker_{len(labels):02d}")
            if len(labels) > 32:
                raise ValueError("Too many speakers")
            output.append({"event": "speaker_turn", "speaker_label": label,
                           "start_ms": start_ms, "end_ms": end_ms})
        # No partial results before all output validates. Overlapping turns are
        # retained; a speaker label never identifies a meeting participant.
        for turn in output:
            emit(turn)
        emit({"event": "done", "schema_version": 1, "bundle_id": BUNDLE_ID,
              "duration_ms": duration_ms, "speaker_count": len(labels), "turn_count": len(output),
              "requested_num_speakers": args.num_speakers, "cluster_threshold": 0.5,
              "sherpa_onnx_version": MANIFEST["runtime"]["sherpa-onnx"],
              "model_sha256": {name: FILES[name]["sha256"]
                               for name in ("segmentation.onnx", "embedding.onnx")}})
        return 0
    except Exception:
        emit({"event": "error", "code": stage})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
