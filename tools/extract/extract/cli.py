"""Run one extraction pass over a transcript JSON produced by benchmark-stt.py.

Usage: python -m extract.cli --transcript T.json --server http://127.0.0.1:8080 \
    --title ... --started-at ... --timezone ... --participants a,b \
    --result out.json
"""

import argparse
import json
import sys
from pathlib import Path

from extract.client import chat_extraction
from extract.prompt import SYSTEM_PROMPT, MeetingContext, build_user_prompt
from extract.schema import ExtractionError


def load_segments(transcript_path: Path) -> tuple[list[dict], set[int]]:
    data = json.loads(transcript_path.read_text(encoding="utf-8"))
    segments = [
        {
            "segment_id": index,
            "speaker": row.get("speaker"),
            "start_ms": row["start_ms"],
            "end_ms": row["end_ms"],
            "text": row["text"],
        }
        for index, row in enumerate(data["segments"])
    ]
    return segments, {segment["segment_id"] for segment in segments}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--transcript", required=True, type=Path)
    parser.add_argument("--server", required=True, help="Loopback URL of the local server")
    parser.add_argument("--title", required=True)
    parser.add_argument("--started-at", required=True, help="RFC 3339 with offset")
    parser.add_argument("--timezone", required=True)
    parser.add_argument("--participants", default="", help="Comma-separated display names")
    parser.add_argument("--model-label", default="local")
    parser.add_argument("--max-tokens", type=int, default=4096)
    parser.add_argument("--result", required=True, type=Path, help="New result JSON (mode 0600)")
    parser.add_argument("--metrics", type=Path, help="Optional metrics JSON (mode 0600)")
    args = parser.parse_args()

    for path in (args.result, args.metrics):
        if path is not None and (path.exists() or path.is_symlink()):
            print(json.dumps({"status": "error", "stage": "args", "error_type": "OutputExists"}))
            return 1

    try:
        segments, known_ids = load_segments(args.transcript)
        meeting = MeetingContext(
            title=args.title,
            started_at=args.started_at,
            timezone=args.timezone,
            participants=tuple(p for p in args.participants.split(",") if p.strip()),
        )
        payload, meta = chat_extraction(
            args.server,
            SYSTEM_PROMPT,
            build_user_prompt(segments, meeting),
            known_ids,
            model_label=args.model_label,
            max_tokens=args.max_tokens,
        )
    except ExtractionError as exc:
        print(json.dumps({"status": "error", "stage": "extract", "error_type": str(exc)[:200]}))
        return 1

    import os

    descriptor = os.open(args.result, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as target:
        json.dump(payload, target, ensure_ascii=False, indent=2)
        target.write("\n")
    if args.metrics is not None:
        descriptor = os.open(args.metrics, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as target:
            json.dump({"status": "ok", **meta}, target, ensure_ascii=False, indent=2)
            target.write("\n")
    print(json.dumps({"status": "ok", "action_items": len(payload["action_items"]),
                      "usage": meta.get("usage", {})}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
