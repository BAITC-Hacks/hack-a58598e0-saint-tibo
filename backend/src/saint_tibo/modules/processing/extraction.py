"""Supervise local or explicitly enabled private SSH extraction after diarization."""

import asyncio
import json
import logging
import os
import shlex
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
    meeting_context: dict[str, str],
    *,
    speaker_labels: list[str | None] | None = None,
) -> ExtractionDraft:
    remote = config.extract_remote_enabled
    if remote:
        if (
            not config.stt_remote_host
            or not config.extract_remote_identity_file.is_file()
            or not config.stt_remote_known_hosts_file.is_file()
        ):
            raise APIError(503, "extraction_unavailable", "The private extraction runtime is unavailable")
        command = [
            "/usr/bin/ssh", "-F", "/dev/null", "-T", "-o", "BatchMode=yes",
            "-o", "IdentitiesOnly=yes", "-o", "IdentityAgent=none",
            "-o", "StrictHostKeyChecking=yes", "-o", "GlobalKnownHostsFile=/dev/null",
            "-o", f"UserKnownHostsFile={config.stt_remote_known_hosts_file}",
            "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=5",
            "-o", "ServerAliveCountMax=2", "-o", "LogLevel=ERROR",
            "-i", str(config.extract_remote_identity_file), "-p", str(config.stt_remote_port),
            "-l", config.stt_remote_user, "--", config.stt_remote_host,
            shlex.join(["/usr/bin/python3", "-I", config.extract_remote_runner_path]),
        ]
    else:
        if not config.extract_script_path.is_file() or not config.extract_model_path.is_file():
            raise APIError(503, "extraction_unavailable", "The local extraction bundle is unavailable")
        command = [
            str(config.stt_python_path), str(config.extract_script_path),
            "--llama-server", str(config.extract_runtime_path),
            "--model-file", str(config.extract_model_path),
        ]
    labels = speaker_labels if speaker_labels is not None else [None] * len(segments)
    if len(labels) != len(segments) or len(segment_ids) != len(segments):
        raise APIError(422, "invalid_extraction_input", "Segment annotations do not match")
    request = json.dumps(
        {
            "meeting": meeting_context,
            "segments": [
                {**row.model_dump(), "speaker": label}
                for row, label in zip(segments, labels, strict=True)
            ],
        },
        ensure_ascii=False,
    ).encode()
    if len(request) > 65536:
        raise APIError(422, "extraction_input_too_large", "Transcript exceeds the local model limit")
    process = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL, start_new_session=True,
    )
    assert process.stdin is not None and process.stdout is not None
    sender = asyncio.create_task(send_remote_request(process, request)) if remote else None
    try:
        async with asyncio.timeout(2000):
            if not remote:
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
                               "Extraction did not finish")
            payload = event["payload"]

            def refs(values: object) -> list[UUID]:
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
            logger.info("extraction_finished action_item_count=%s remote=%s", len(items), remote)
            return draft
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise APIError(503, "invalid_extraction_output", "Extraction returned invalid output") from exc
    except TimeoutError as exc:
        raise APIError(503, "extraction_timeout", "Extraction timed out") from exc
    finally:
        await stop_extraction(process, sender)


async def stop_extraction(
    process: asyncio.subprocess.Process, sender: asyncio.Task[None] | None,
) -> None:
    assert process.stdout is not None
    drainer = asyncio.create_task(discard_output(process.stdout))
    try:
        if sender is not None:
            sender.cancel()
            await asyncio.gather(sender, return_exceptions=True)
            assert process.stdin is not None
            process.stdin.close()
            # EOF lets the forced-command supervisor remove its private request
            # and container; heartbeat expiry handles a broken SSH connection.
            if process.returncode is None:
                try:
                    await asyncio.wait_for(process.wait(), timeout=12)
                except TimeoutError:
                    pass
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
    finally:
        drainer.cancel()
        await asyncio.gather(drainer, return_exceptions=True)


async def discard_output(reader: asyncio.StreamReader) -> None:
    # A rejected/oversized response must not fill the pipe and prevent process
    # cleanup. Discard in bounded chunks; never retain or log the response.
    while await reader.read(65536):
        pass


async def send_remote_request(process: asyncio.subprocess.Process, request: bytes) -> None:
    assert process.stdin is not None
    try:
        header = {"version": 1, "bytes": len(request), "timeout": 2000}
        process.stdin.write(json.dumps(header).encode() + b"\n")
        process.stdin.write(request)
        await asyncio.wait_for(process.stdin.drain(), timeout=15)
        while True:
            process.stdin.write(b".\n")
            await asyncio.wait_for(process.stdin.drain(), timeout=15)
            await asyncio.sleep(5)
    except (OSError, TimeoutError):
        process.stdin.close()
