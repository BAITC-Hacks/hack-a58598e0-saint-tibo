"""Local CPU extraction after STT, supervised through a bounded private pipe."""

import asyncio
import json
import logging
import os
import signal
from uuid import UUID

from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError
from saint_tibo.modules.results.schemas import (
    ExtractionDraft,
    ExtractionProvenance,
    ReviewActionItem,
    ReviewSummary,
    TranscriptSegment,
)

logger = logging.getLogger(__name__)


async def extract(
    config: Settings,
    segments: list[TranscriptSegment],
    segment_ids: list[UUID],
    meeting_context: dict,
) -> ExtractionDraft:
    if not config.extract_script_path.is_file() or not config.extract_model_path.is_file():
        raise APIError(503, "extraction_unavailable", "The local extraction bundle is unavailable")
    request = json.dumps({"meeting": meeting_context,
                          "segments": [row.model_dump() for row in segments]},
                         ensure_ascii=False).encode()
    if len(request) > 65536:
        raise APIError(422, "extraction_input_too_large", "Transcript exceeds the local model limit")
    process = await asyncio.create_subprocess_exec(
        str(config.stt_python_path), str(config.extract_script_path),
        "--llama-server", str(config.extract_runtime_path),
        "--model-file", str(config.extract_model_path),
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL, start_new_session=True,
    )
    assert process.stdin is not None and process.stdout is not None
    try:
        async with asyncio.timeout(2000):
            process.stdin.write(request)
            await process.stdin.drain()
            process.stdin.close()
            output = bytearray()
            while chunk := await process.stdout.read(65536):
                output.extend(chunk)
                if len(output) > 1024 * 1024:
                    raise ValueError("Output exceeds limit")
            code = await process.wait()
            event = json.loads(output)
            if not isinstance(event, dict):
                raise ValueError("Invalid output envelope")
            if event.get("status") != "ok" or code != 0:
                error = event.get("code")
                allowed = {"extraction_unavailable", "extraction_bundle_mismatch",
                           "extraction_runtime_failed", "extraction_start_timeout",
                           "extraction_incomplete", "invalid_extraction_output",
                           "extraction_input_too_large"}
                raise APIError(503, error if error in allowed else "extraction_failed",
                               "Local extraction did not finish")
            payload = event["payload"]

            def refs(values: list) -> list[UUID]:
                if not isinstance(values, list) or not values or len(values) > 64:
                    raise ValueError("Missing evidence")
                if any(type(i) is not int or not 0 <= i < len(segment_ids) for i in values):
                    raise ValueError("Invalid source reference")
                return list(dict.fromkeys(segment_ids[i] for i in values))

            items = [ReviewActionItem(
                text=row["text"], assignee_text=row["assignee_text"],
                due_text=row["due_text"], due_date=row["due_date"],
                source_segment_ids=refs(row["source_segment_ids"]),
            ) for row in payload["action_items"]]
            source_ids: set[UUID] = set()
            summary = {}
            for key in ("topics", "decisions", "open_questions"):
                entries = payload["summary"][key]
                summary[key] = [entry["text"] for entry in entries]
                for entry in entries:
                    source_ids.update(refs(entry["source_segment_ids"]))
            draft = ExtractionDraft(
                provenance=ExtractionProvenance.model_validate(event["provenance"]),
                action_items=items,
                summary=ReviewSummary(**summary, source_segment_ids=sorted(source_ids)),
            )
            if any(item.due_date is not None for item in draft.action_items):
                raise ValueError("Dates must remain unknown")
            logger.info("local_extraction_finished action_item_count=%s", len(items))
            return draft
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise APIError(503, "invalid_extraction_output", "Local extraction returned invalid output") from exc
    except TimeoutError as exc:
        raise APIError(503, "extraction_timeout", "Local extraction timed out") from exc
    finally:
        # Kill the entire job-owned group, including llama-server, even if the CLI died first.
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(process.wait(), timeout=5)
        except TimeoutError:
            pass
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        await process.wait()
