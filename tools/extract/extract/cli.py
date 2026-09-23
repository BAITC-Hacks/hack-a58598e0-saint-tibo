"""Private JSON stdin/stdout worker transport or explicit private benchmark files."""

import argparse
import hashlib
import json
import os
import sys
import time
from contextlib import nullcontext
from pathlib import Path

from extract.client import chat_extraction
from extract.prompt import SYSTEM_PROMPT, MeetingContext, build_user_prompt
from extract.runtime import MODEL_ID, MODEL_REVISION, MODEL_SHA256, RUNTIME_ID, local_runtime
from extract.schema import ExtractionError


def load_segments(data: dict) -> tuple[list[dict], set[int]]:
    rows = data["segments"]
    if not isinstance(rows, list) or not 1 <= len(rows) <= 20000:
        raise ExtractionError("invalid_extraction_input")
    segments = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or not isinstance(row.get("text"), str) or not row["text"].strip():
            raise ExtractionError("invalid_extraction_input")
        segments.append({"segment_id": index, "speaker": row.get("speaker"), "text": row["text"]})
    return segments, set(range(len(segments)))


def write_private(path: Path, data: dict) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as target:
        json.dump(data, target, ensure_ascii=False, allow_nan=False)
        target.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--transcript", type=Path, help="Omit for private stdin transport")
    parser.add_argument("--server", help="Existing loopback runtime (benchmark only)")
    parser.add_argument("--llama-server", type=Path)
    parser.add_argument("--model-file", type=Path)
    parser.add_argument("--title", default="")
    parser.add_argument("--started-at", default="")
    parser.add_argument("--timezone", default="")
    parser.add_argument("--participants", default="")
    parser.add_argument("--max-tokens", type=int, default=3072)
    parser.add_argument("--result", type=Path)
    parser.add_argument("--metrics", type=Path)
    args = parser.parse_args()
    meta = {}
    metrics_path_ready = False
    try:
        outputs = [p for p in (args.result, args.metrics) if p is not None]
        if len({p.resolve() for p in outputs}) != len(outputs) or any(
            p.exists() or p.is_symlink() for p in outputs
        ):
            raise ExtractionError("extraction_output_exists")
        metrics_path_ready = True
        raw = args.transcript.read_bytes() if args.transcript else sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ExtractionError("extraction_input_too_large")
        data = json.loads(raw)
        segments, known = load_segments(data)
        context = data.get("meeting", {})
        meeting = MeetingContext(
            title=context.get("title", args.title), started_at=context.get("started_at", args.started_at),
            timezone=context.get("timezone", args.timezone),
            participants=tuple(context.get("participants", args.participants.split(",") if args.participants else [])),
        )
        if not args.server and (args.llama_server is None or args.model_file is None):
            raise ExtractionError("extraction_unavailable")
        manager = nullcontext((args.server, None)) if args.server else local_runtime(args.llama_server, args.model_file)
        started = time.monotonic()
        with manager as (url, pid):
            try:
                payload, meta = chat_extraction(
                    url, SYSTEM_PROMPT, build_user_prompt(segments, meeting),
                    known, max_tokens=args.max_tokens,
                )
            except ExtractionError as exc:
                meta.update(exc.metrics)
                raise
            finally:
                peak_rss = None
                if pid is not None:
                    try:
                        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
                            if line.startswith("VmHWM:"):
                                peak_rss = int(line.split()[1]) * 1024
                    except OSError:
                        pass
                meta.update(elapsed_seconds=round(time.monotonic() - started, 3),
                            server_peak_rss_bytes=peak_rss, max_tokens=args.max_tokens)
        provenance = {"model_id": MODEL_ID, "model_revision": MODEL_REVISION,
                      "model_sha256": MODEL_SHA256, "runtime_id": RUNTIME_ID,
                      "prompt_sha256": hashlib.sha256(SYSTEM_PROMPT.encode()).hexdigest()}
        result = {"status": "ok", "payload": payload, "provenance": provenance, "metrics": meta}
        # An external benchmark server has not been fingerprinted by this process.
        if args.server:
            result["provenance"] = None
        if args.result:
            write_private(args.result, result)
            print(json.dumps({"status": "ok", "action_item_count": len(payload["action_items"]), **meta}))
        else:
            print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        if args.metrics:
            write_private(args.metrics, {"status": "ok", **meta})
        return 0
    except ExtractionError as exc:
        meta.update(exc.metrics)
        failure = {"status": "error", "code": str(exc), **meta}
    except Exception:
        failure = {"status": "error", "code": "extraction_failed", **meta}
    if args.metrics and metrics_path_ready:
        try:
            write_private(args.metrics, failure)
        except OSError:
            pass
    print(json.dumps(failure, allow_nan=False))
    return 1


if __name__ == "__main__":
    sys.exit(main())
