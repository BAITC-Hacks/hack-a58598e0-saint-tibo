"""Supervise the isolated ML environment through a bounded private JSONL pipe."""

import asyncio
import json
import os
import shlex
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
) -> tuple[list[TranscriptSegment], str, str, str]:
    remote = config.stt_remote_enabled
    if remote:
        if (not config.stt_remote_host or not config.stt_remote_identity_file.is_file()
                or not config.stt_remote_known_hosts_file.is_file()):
            raise APIError(503, "transcription_unavailable", "The remote STT runtime is unavailable")
        command = [
            "/usr/bin/ssh", "-F", "/dev/null", "-T", "-o", "BatchMode=yes",
            "-o", "IdentitiesOnly=yes", "-o", "IdentityAgent=none",
            "-o", "StrictHostKeyChecking=yes", "-o", "GlobalKnownHostsFile=/dev/null",
            "-o", f"UserKnownHostsFile={config.stt_remote_known_hosts_file}",
            "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=5",
            "-o", "ServerAliveCountMax=2", "-o", "LogLevel=ERROR",
            "-i", str(config.stt_remote_identity_file), "-p", str(config.stt_remote_port),
            "-l", config.stt_remote_user, "--", config.stt_remote_host,
            shlex.join(["/usr/bin/python3", "-I", config.stt_remote_runner_path]),
        ]
    else:
        if not config.stt_python_path.is_file() or not config.stt_script_path.is_file():
            raise APIError(503, "transcription_unavailable", "The local STT runtime is unavailable")
        command = [str(config.stt_python_path), str(config.stt_script_path), str(path),
                   "--model-dir", str(config.stt_model_path), "--language", language]
    process = await asyncio.create_subprocess_exec(
        *command,
        stdin=asyncio.subprocess.PIPE if remote else asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
        limit=128 * 1024,
        start_new_session=True,
    )
    sender = asyncio.create_task(send_remote_audio(process, path, language, config)) if remote else None
    assert process.stdout is not None
    segments: list[TranscriptSegment] = []
    detected_language: str | None = None
    model_id = ""
    model_revision = ""
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
                reported_duration = event.get("duration_ms")
                # All producers use the same integer ceil of normalized WAV frames.
                if type(reported_duration) is not int or reported_duration != duration_ms:
                    raise ValueError("STT duration mismatch")
                model = event.get("model_id")
                revision = event.get("model_revision")
                if not isinstance(model, str) or not 1 <= len(model) <= 120:
                    raise ValueError("Invalid model identity")
                if (
                    not isinstance(revision, str)
                    or len(revision) != 40
                    or any(char not in "0123456789abcdef" for char in revision)
                ):
                    raise ValueError("Invalid model revision")
                model_id, model_revision = model, revision
                detected_language = value
            elif kind == "error":
                code = event.get("code")
                if code not in (
                    "stt_model_unavailable",
                    "transcription_failed",
                    "invalid_transcript_timing",
                ):
                    code = "transcription_failed"
                raise APIError(503, code, "Speech recognition failed")
            else:
                raise ValueError("Unknown STT event")
        if await process.wait() != 0 or detected_language is None:
            raise APIError(503, "transcription_failed", "Speech recognition did not finish")
        if not segments:
            raise APIError(422, "speech_not_detected", "No speech segments were recognized")
        return segments, detected_language, model_id, model_revision
    except ValueError as exc:
        raise APIError(
            503, "invalid_transcription_output", "STT returned invalid output"
        ) from exc
    finally:
        if sender is not None:
            sender.cancel()
            await asyncio.gather(sender, return_exceptions=True)
            assert process.stdin is not None
            process.stdin.close()
            # EOF reaches the remote supervisor, which removes its container and
            # private WAV before SSH exits. The remote heartbeat watchdog also
            # handles broken TCP links independently of killing this SSH client.
            if process.returncode is None:
                try:
                    await asyncio.wait_for(process.wait(), timeout=12)
                except TimeoutError:
                    pass
        if process.returncode is None:
            kill_group = getattr(os, "killpg", None)
            try:
                if kill_group is None:
                    process.terminate()
                else:
                    kill_group(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except TimeoutError:
                try:
                    if kill_group is None:
                        process.kill()
                    else:
                        kill_group(process.pid, getattr(signal, "SIGKILL", signal.SIGTERM))
                except ProcessLookupError:
                    pass
                await process.wait()


async def send_remote_audio(
    process: asyncio.subprocess.Process, path: Path, language: str, config: Settings,
) -> None:
    assert process.stdin is not None
    try:
        with path.open("rb") as audio:
            size = os.fstat(audio.fileno()).st_size
            if not 44 <= size <= config.recording_max_bytes:
                raise ValueError("Invalid remote audio size")
            header = {"version": 1, "bytes": size, "language": language,
                      "timeout": min(config.processing_timeout_seconds, 7200)}
            process.stdin.write(json.dumps(header).encode() + b"\n")
            remaining = size
            while remaining:
                block = await asyncio.to_thread(audio.read, min(65536, remaining))
                if not block:
                    raise ValueError("Audio changed during upload")
                process.stdin.write(block)
                await asyncio.wait_for(process.stdin.drain(), timeout=15)
                remaining -= len(block)
        while True:
            process.stdin.write(b".\n")
            await asyncio.wait_for(process.stdin.drain(), timeout=15)
            await asyncio.sleep(5)
    except (OSError, ValueError, TimeoutError):
        # Closing stdin makes the remote job fail and clean up; stdout's existing
        # validator turns the missing terminal event/nonzero exit into a safe error.
        process.stdin.close()
