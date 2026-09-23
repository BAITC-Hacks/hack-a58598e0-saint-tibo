"""Bound the local diarizer's private JSONL pipe; never infer participant identity."""

import asyncio
import json
import os
import signal
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError


class AnonymousTurn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    speaker_label: str = Field(pattern=r"^speaker_[0-9]{2}$")
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)

    @model_validator(mode="after")
    def valid_interval(self) -> "AnonymousTurn":
        if self.end_ms <= self.start_ms:
            raise ValueError("Invalid speaker interval")
        return self


class DiarizationComplete(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    schema_version: Literal[1]
    bundle_id: Literal["saint-tibo-diarization-v1"]
    duration_ms: int = Field(gt=0)
    speaker_count: int = Field(ge=1, le=32)
    turn_count: int = Field(ge=1, le=20000)
    requested_num_speakers: Literal[-1]
    cluster_threshold: Literal[0.5]
    sherpa_onnx_version: Literal["1.13.8"]
    model_sha256: dict[str, str]

    @model_validator(mode="after")
    def valid_hashes(self) -> "DiarizationComplete":
        if set(self.model_sha256) != {"segmentation.onnx", "embedding.onnx"}:
            raise ValueError("Unexpected model names")
        for value in self.model_sha256.values():
            if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
                raise ValueError("Invalid model checksum")
        return self


class DiarizationOutput(BaseModel):
    turns: list[AnonymousTurn]
    provenance: DiarizationComplete


async def diarize(config: Settings, path: Path, duration_ms: int) -> DiarizationOutput:
    if not config.diarization_python_path.is_file() or not config.diarization_script_path.is_file():
        raise APIError(503, "diarization_unavailable", "The local diarization runtime is unavailable")
    process = await asyncio.create_subprocess_exec(
        str(config.diarization_python_path), str(config.diarization_script_path), str(path),
        "--model-dir", str(config.diarization_model_path),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        limit=16 * 1024, start_new_session=True,
    )
    assert process.stdout is not None
    turns: list[AnonymousTurn] = []
    complete: DiarizationComplete | None = None
    received_bytes = 0
    try:
        async for line in process.stdout:
            received_bytes += len(line)
            if received_bytes > 8 * 1024 * 1024 or complete is not None:
                raise ValueError("Invalid diarization stream")
            event = json.loads(line)
            if not isinstance(event, dict):
                raise ValueError("Invalid diarization event")
            kind = event.pop("event", None)
            if kind == "speaker_turn":
                turn = AnonymousTurn.model_validate(event)
                if (len(turns) >= 20000 or turn.end_ms > duration_ms
                        or turns and turn.start_ms < turns[-1].start_ms):
                    raise ValueError("Invalid diarization timeline")
                turns.append(turn)
            elif kind == "done":
                complete = DiarizationComplete.model_validate(event)
                if (complete.duration_ms != duration_ms or complete.turn_count != len(turns)
                        or complete.speaker_count != len({turn.speaker_label for turn in turns})):
                    raise ValueError("Invalid diarization completion")
            elif kind == "error":
                code = event.get("code")
                if not isinstance(code, str) or code not in {
                    "diarization_model_unavailable", "invalid_diarization_input",
                    "diarization_failed", "speech_not_detected",
                }:
                    code = "diarization_failed"
                status = 422 if code in {"invalid_diarization_input", "speech_not_detected"} else 503
                raise APIError(status, code, "Local speaker diarization failed")
            else:
                raise ValueError("Unknown diarization event")
        if await process.wait() != 0 or complete is None:
            raise APIError(503, "diarization_failed", "Local diarization did not finish")
        return DiarizationOutput(turns=turns, provenance=complete)
    except ValueError as exc:
        raise APIError(503, "invalid_diarization_output", "Local diarization returned invalid output") from exc
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
