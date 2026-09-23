"""Supervise the isolated ML environment through a bounded private JSONL pipe."""

import asyncio
import json
import os
import signal
import time
from collections.abc import Awaitable, Callable
from pathlib import Path

from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError
from saint_tibo.modules.results.schemas import TranscriptSegment


async def transcribe(
    config: Settings,
    path: Path,
    language: str,
    duration_ms: int,
    report_progress: Callable[[float], Awaitable[None]],
) -> tuple[list[TranscriptSegment], str]:
    if not config.stt_python_path.is_file() or not config.stt_script_path.is_file():
        raise APIError(503, "transcription_unavailable", "The local STT runtime is unavailable")
    process = await asyncio.create_subprocess_exec(
        str(config.stt_python_path),
        str(config.stt_script_path),
        str(path),
        "--model-dir",
        str(config.stt_model_path),
        "--language",
        language,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        limit=128 * 1024,
        start_new_session=True,
    )
    assert process.stdout is not None
    segments: list[TranscriptSegment] = []
    detected_language: str | None = None
    received_bytes = 0
    last_report = 0.0
    progress = 0.0
    try:
        async for line in process.stdout:
            received_bytes += len(line)
            if received_bytes > 32 * 1024 * 1024 or len(segments) > 20000:
                raise APIError(
                    422, "transcript_too_large", "Transcript exceeded the supported size"
                )
            event = json.loads(line)
            if not isinstance(event, dict):
                raise ValueError("Invalid STT event")
            kind = event.pop("event", None)
            if detected_language is not None:
                raise ValueError("Output after terminal event")
            if kind == "segment":
                row = TranscriptSegment.model_validate(event)
                if row.end_ms > duration_ms:
                    raise APIError(
                        422, "invalid_transcript_timing", "Timestamp exceeds the recording"
                    )
                segments.append(row)
                progress = max(progress, min(row.end_ms / duration_ms, 0.99))
                if time.monotonic() - last_report >= 1:
                    await report_progress(progress)
                    last_report = time.monotonic()
            elif kind == "done":
                value = event.get("language")
                if not isinstance(value, str) or not 1 <= len(value) <= 16:
                    raise ValueError("Invalid detected language")
                if event.get("duration_ms") != duration_ms:
                    raise ValueError("STT duration mismatch")
                detected_language = value
            elif kind == "error":
                code = event.get("code")
                if code not in (
                    "stt_model_unavailable",
                    "transcription_failed",
                    "invalid_transcript_timing",
                ):
                    code = "transcription_failed"
                raise APIError(503, code, "Local speech recognition failed")
            else:
                raise ValueError("Unknown STT event")
        if await process.wait() != 0 or detected_language is None:
            raise APIError(503, "transcription_failed", "Local speech recognition did not finish")
        if not segments:
            raise APIError(422, "speech_not_detected", "No speech segments were recognized")
        return segments, detected_language
    except ValueError as exc:
        raise APIError(
            503, "invalid_transcription_output", "Local STT returned invalid output"
        ) from exc
    finally:
        if process.returncode is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except TimeoutError:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                await process.wait()
