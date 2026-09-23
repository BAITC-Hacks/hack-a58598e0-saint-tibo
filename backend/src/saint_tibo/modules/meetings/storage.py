"""Private local files. Client filenames never become filesystem paths."""

import asyncio
import hashlib
import json
import math
import os
import shutil
import tempfile
import wave
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from saint_tibo.core.errors import APIError

# hack: one API host owns this volume; use shared private object storage for replicas.
# Excluding playlists and network protocols prevents media inputs from fetching URLs.
DEMUXERS = "wav,mp3,matroska,webm,ogg,mov,mp4,m4a,3gp,3g2,mj2,flac,aac"


@dataclass(frozen=True)
class ReceivedFile:
    path: Path
    size_bytes: int
    sha256: str


@dataclass(frozen=True)
class NormalizedAudio:
    path: Path
    duration_ms: int
    size_bytes: int
    source_content_type: str


def recording_dir(root: Path, recording_id: UUID) -> Path:
    return root / str(recording_id)


def temporary_path(root: Path, suffix: str = "") -> Path:
    incoming = root / ".incoming"
    incoming.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, filename = tempfile.mkstemp(dir=incoming, suffix=suffix)
    os.close(fd)
    return Path(filename)


async def receive(
    stream: AsyncIterator[bytes], root: Path, max_bytes: int, max_seconds: float
) -> ReceivedFile:
    path = temporary_path(root)
    digest = hashlib.sha256()
    size = 0
    try:
        async with asyncio.timeout(max_seconds):
            with path.open("wb") as target:
                async for block in stream:
                    size += len(block)
                    if size > max_bytes:
                        raise APIError(
                            413, "recording_too_large", "Recording exceeds the byte limit"
                        )
                    digest.update(block)
                    await asyncio.to_thread(target.write, block)
                await asyncio.to_thread(target.flush)
        if not size:
            raise APIError(400, "empty_recording", "Recording body is empty")
        return ReceivedFile(path, size, digest.hexdigest())
    except TimeoutError as exc:
        path.unlink(missing_ok=True)
        raise APIError(408, "upload_timeout", "Recording upload timed out") from exc
    except BaseException:
        path.unlink(missing_ok=True)
        raise


async def run_media_tool(*args: str, max_seconds: float) -> bytes:
    try:
        process = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
    except FileNotFoundError as exc:
        raise APIError(
            503, "media_tool_unavailable", "Recording validation is unavailable"
        ) from exc
    try:
        async with asyncio.timeout(max_seconds):
            stdout, _ = await process.communicate()
        if process.returncode:
            raise APIError(
                422, "invalid_recording", "Recording cannot be decoded as supported audio"
            )
        return stdout
    except TimeoutError as exc:
        raise APIError(
            422, "media_timeout", "Recording validation exceeded its time limit"
        ) from exc
    finally:
        if process.returncode is None:
            process.kill()
            await process.communicate()


async def normalize(
    source: Path, root: Path, max_duration_ms: int, max_seconds: float
) -> NormalizedAudio:
    result = await run_media_tool(
        "ffprobe",
        "-v",
        "error",
        "-max_alloc",
        "67108864",
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        DEMUXERS,
        "-show_entries",
        "stream=codec_type:stream_disposition=attached_pic:format=duration,format_name",
        "-of",
        "json",
        str(source),
        max_seconds=min(max_seconds, 30),
    )
    try:
        metadata = json.loads(result)
        streams = metadata.get("streams", [])
        if not any(stream.get("codec_type") == "audio" for stream in streams):
            raise ValueError("No audio stream")
        formats = set(metadata.get("format", {}).get("format_name", "").split(","))
        has_video = any(
            stream.get("codec_type") == "video"
            and not stream.get("disposition", {}).get("attached_pic")
            for stream in streams
        )
        if "mp3" in formats:
            source_content_type = "audio/mpeg"
        elif "wav" in formats:
            source_content_type = "audio/wav"
        elif "flac" in formats:
            source_content_type = "audio/flac"
        elif "ogg" in formats:
            source_content_type = "video/ogg" if has_video else "audio/ogg"
        elif "mov" in formats or "mp4" in formats:
            source_content_type = "video/mp4" if has_video else "audio/mp4"
        elif "webm" in formats or "matroska" in formats:
            source_content_type = "video/webm" if has_video else "audio/webm"
        else:
            raise APIError(415, "unsupported_media", "Recording container is unsupported")
        duration = metadata.get("format", {}).get("duration")
        if duration is not None:
            seconds = float(duration)
            if not math.isfinite(seconds) or seconds <= 0:
                raise ValueError("Invalid duration")
            if seconds * 1000 > max_duration_ms:
                raise APIError(422, "recording_too_long", "Recording exceeds the duration limit")
    except (ValueError, TypeError) as exc:
        raise APIError(422, "invalid_recording", "Recording has no valid audio stream") from exc
    output = temporary_path(root, ".wav")
    try:
        # The actual decoded duration is checked too: container metadata is untrusted.
        await run_media_tool(
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-xerror",
            "-y",
            "-threads",
            "1",
            "-max_alloc",
            "67108864",
            "-protocol_whitelist",
            "file",
            "-format_whitelist",
            DEMUXERS,
            "-i",
            str(source),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-map_metadata",
            "-1",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-t",
            str(max_duration_ms / 1000 + 1),
            "-fs",
            str(math.ceil((max_duration_ms / 1000 + 2) * 32000) + 65536),
            "-f",
            "wav",
            str(output),
            max_seconds=max_seconds,
        )
        with wave.open(str(output), "rb") as audio:
            frames, sample_rate = audio.getnframes(), audio.getframerate()
            duration_ms = (frames * 1000 + sample_rate - 1) // sample_rate
        if duration_ms <= 0:
            raise APIError(422, "empty_recording", "Recording contains no audio samples")
        if duration_ms > max_duration_ms:
            raise APIError(422, "recording_too_long", "Recording exceeds the duration limit")
        return NormalizedAudio(output, duration_ms, output.stat().st_size, source_content_type)
    except BaseException:
        output.unlink(missing_ok=True)
        raise


def combine(paths: Sequence[Path], root: Path, max_bytes: int) -> ReceivedFile:
    target = temporary_path(root)
    digest = hashlib.sha256()
    size = 0
    try:
        with target.open("wb") as output:
            for path in paths:
                with path.open("rb") as source:
                    while block := source.read(1024 * 1024):
                        size += len(block)
                        if size > max_bytes:
                            raise APIError(
                                413, "recording_too_large", "Recording exceeds the byte limit"
                            )
                        output.write(block)
                        digest.update(block)
        return ReceivedFile(target, size, digest.hexdigest())
    except BaseException:
        target.unlink(missing_ok=True)
        raise


def remove_recordings(root: Path, recording_ids: Sequence[UUID]) -> None:
    for recording_id in recording_ids:
        directory = recording_dir(root, recording_id)
        if directory.exists():
            shutil.rmtree(directory)
