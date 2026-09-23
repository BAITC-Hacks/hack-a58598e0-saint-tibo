#!/usr/bin/env python3
"""Offline CPU benchmark for the extract stage; local llama-server only.

Reads a private transcript JSON from the STT benchmark, calls a schema-
constrained extraction on a loopback server, and reports time, tokens and
the server process peak RSS. Stdout contains metrics, never transcript or
result text. See docs/llm-feasibility.md.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "extract"))

from extract.client import chat_extraction  # noqa: E402
from extract.prompt import SYSTEM_PROMPT, MeetingContext, build_user_prompt  # noqa: E402
from extract.schema import ExtractionError  # noqa: E402


def sha256(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def vmhwm_bytes(pid: int) -> int | None:
    try:
        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
            if line.startswith("VmHWM:"):
                return int(line.split()[1]) * 1024
    except OSError:
        return None
    return None


def write_private(path: Path, data: dict) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as target:
        json.dump(data, target, ensure_ascii=False, indent=2, allow_nan=False)
        target.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--transcript", required=True, type=Path)
    parser.add_argument("--server", required=True)
    parser.add_argument("--server-pid", type=int, help="llama-server pid for peak RSS")
    parser.add_argument("--model-file", required=True, type=Path, help="Local GGUF for hashing")
    parser.add_argument("--model-revision", required=True, help="Pinned source revision")
    parser.add_argument("--model-label", required=True)
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument("--ctx-size", type=int, required=True)
    parser.add_argument("--threads", type=int, required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--started-at", required=True)
    parser.add_argument("--timezone", required=True)
    parser.add_argument("--participants", default="")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--result-output", required=True, type=Path)
    args = parser.parse_args()

    stage = "validate_inputs"
    try:
        if not args.transcript.is_file() or not args.model_file.is_file():
            raise ValueError("Local paths required")
        if len(args.model_revision) != 40 or any(
            c not in "0123456789abcdef" for c in args.model_revision
        ):
            raise ValueError("Use a full lowercase source commit hash")
        outputs = [args.output, args.result_output]
        if len({p.resolve() for p in outputs}) != len(outputs):
            raise ValueError("Output paths must differ")
        if any(p.exists() or p.is_symlink() or not p.parent.is_dir() for p in outputs):
            raise ValueError("Output must be a new file in an existing private directory")
        transcript = json.loads(args.transcript.read_text(encoding="utf-8"))
        segments = [
            {
                "segment_id": index,
                "speaker": row.get("speaker"),
                "start_ms": row["start_ms"],
                "end_ms": row["end_ms"],
                "text": row["text"],
            }
            for index, row in enumerate(transcript["segments"])
        ]
        known_ids = {segment["segment_id"] for segment in segments}
        stage = "extract"
        meeting = MeetingContext(
            title=args.title,
            started_at=args.started_at,
            timezone=args.timezone,
            participants=tuple(p for p in args.participants.split(",") if p.strip()),
        )
        started = time.perf_counter()
        payload, meta = chat_extraction(
            args.server,
            SYSTEM_PROMPT,
            build_user_prompt(segments, meeting),
            known_ids,
            model_label=args.model_label,
            max_tokens=args.max_tokens,
        )
        elapsed = time.perf_counter() - started
        stage = "write_results"
        usage = meta.get("usage", {})
        timings = meta.get("timings", {})
        result = {
            "schema_version": 2,
            "prompt_sha256": hashlib.sha256(SYSTEM_PROMPT.encode()).hexdigest(),
            "max_tokens": args.max_tokens,
            "status": "ok",
            "model_label": args.model_label,
            "model_file_sha256": sha256(args.model_file),
            "model_source_revision": args.model_revision,
            "platform": platform.system(),
            "architecture": platform.machine(),
            "visible_cpu_count": os.cpu_count(),
            "threads": args.threads,
            "ctx_size": args.ctx_size,
            "transcript_sha256": sha256(args.transcript),
            "segment_count": len(segments),
            "prompt_tokens": usage.get("prompt_tokens"),
            "completion_tokens": usage.get("completion_tokens"),
            "elapsed_seconds": round(elapsed, 3),
            "server_timings": timings,
            "server_peak_rss_bytes": vmhwm_bytes(args.server_pid) if args.server_pid else None,
            "action_item_count": len(payload["action_items"]),
            "schema_validated": True,
            "segment_refs_validated": True,
            "network_isolation_verified": False,
            "quality_review": "pending",
        }
        write_private(args.result_output, payload)
        write_private(args.output, result)
        print(json.dumps(result, allow_nan=False))
        return 0
    except ExtractionError as exc:
        print(json.dumps({"status": "error", "stage": stage, "error_type": str(exc)[:200]}))
        return 1
    except Exception as error:
        print(json.dumps({"status": "error", "stage": stage, "error_type": type(error).__name__}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
