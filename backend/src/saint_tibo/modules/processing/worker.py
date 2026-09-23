"""Run with python -m saint_tibo.modules.processing.worker, outside the HTTP process."""

import asyncio
import logging
import signal
import wave
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError
from saint_tibo.core.logging import configure_logging
from saint_tibo.db.session import create_engine
from saint_tibo.modules.meetings.models import Recording
from saint_tibo.modules.meetings.storage import recording_dir
from saint_tibo.modules.processing.models import ProcessingJob
from saint_tibo.modules.processing.service import interrupt_expired
from saint_tibo.modules.processing.transcription import transcribe
from saint_tibo.modules.results.service import publish_transcript

logger = logging.getLogger(__name__)
SessionFactory = async_sessionmaker[AsyncSession]


class LeaseLost(Exception):
    """A deleted job or expired lease must never publish a result."""


async def claim(factory: SessionFactory, config: Settings) -> ProcessingJob | None:
    async with factory() as session:
        await interrupt_expired(session)
        row = await session.scalar(
            select(ProcessingJob)
            .where(ProcessingJob.status == "queued")
            .order_by(ProcessingJob.created_at, ProcessingJob.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if row is not None:
            row.status = "running"
            now = await session.scalar(select(func.now()))
            assert now is not None
            row.started_at = now
            row.claim_token = uuid4()
            row.lease_expires_at = now + timedelta(seconds=config.processing_lease_seconds)
        await session.commit()
        return row


async def save(factory: SessionFactory, job: ProcessingJob, **values: Any) -> None:
    async with factory() as session:
        saved = await session.scalar(
            update(ProcessingJob)
            .where(
                ProcessingJob.id == job.id,
                ProcessingJob.status == "running",
                ProcessingJob.claim_token == job.claim_token,
                ProcessingJob.lease_expires_at > func.now(),
            )
            .values(**values)
            .returning(ProcessingJob.id)
        )
        await session.commit()
        if saved is None:
            raise LeaseLost


async def heartbeat(factory: SessionFactory, config: Settings, job: ProcessingJob) -> None:
    while True:
        await asyncio.sleep(config.processing_lease_seconds / 3)
        await save(
            factory,
            job,
            lease_expires_at=func.now() + timedelta(seconds=config.processing_lease_seconds),
        )


def validate_audio(path: Path, expected_duration_ms: int | None, config: Settings) -> None:
    """Read the existing normalized media in bounded blocks, preserving its original clock."""
    try:
        with wave.open(str(path), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (
                1,
                2,
                16000,
            ):
                raise APIError(422, "invalid_recording", "Expected normalized PCM16 mono audio")
            frames = source.getnframes()
            duration_ms = round(frames * 1000 / 16000)
            if not frames or duration_ms > config.recording_max_duration_ms:
                raise APIError(422, "invalid_recording", "Invalid audio duration")
            if expected_duration_ms is None or abs(duration_ms - expected_duration_ms) > 1:
                raise APIError(422, "invalid_recording", "Audio duration differs from metadata")
            remaining = frames * 2
            while remaining > 0:
                block = source.readframes(min(160000, remaining // 2))
                if not block or len(block) % 2:
                    raise APIError(422, "invalid_recording", "Audio data is truncated")
                remaining -= len(block)
    except FileNotFoundError as exc:
        raise APIError(409, "recording_media_missing", "Recording media is unavailable") from exc
    except (wave.Error, EOFError) as exc:
        raise APIError(422, "invalid_recording", "Audio could not be decoded") from exc
    except OSError as exc:
        raise APIError(503, "recording_storage_unavailable", "Cannot read recording media") from exc


async def process(factory: SessionFactory, config: Settings, job: ProcessingJob) -> None:
    async with factory() as session:
        media = await session.get(Recording, job.recording_id)
        if media is None:
            raise LeaseLost
        if media.status not in ("ready", "incomplete") or media.media_size_bytes is None:
            raise APIError(409, "recording_not_playable", "Recording is no longer playable")
        if media.status == "incomplete" and not job.allow_incomplete:
            raise APIError(409, "incomplete_recording", "Incomplete audio was not accepted")
        duration = media.duration_ms
    path = recording_dir(config.recording_storage_path, job.recording_id) / "media.wav"
    await asyncio.to_thread(validate_audio, path, duration, config)
    await save(factory, job, stage="transcribe", progress=None)
    assert duration is not None

    async def progress(value: float) -> None:
        await save(factory, job, progress=value)

    segments, detected_language = await transcribe(config, path, job.language, duration, progress)
    async with factory() as session:
        await publish_transcript(session, job, segments, detected_language, duration)


async def run_job(factory: SessionFactory, config: Settings, job: ProcessingJob) -> None:
    work = asyncio.create_task(process(factory, config, job))
    pulse = asyncio.create_task(heartbeat(factory, config, job))
    status = "failed"
    error: str | None = "processing_failed"
    logger.info("job_started job_id=%s attempt=%s", job.id, job.attempt)
    try:
        async with asyncio.timeout(config.processing_timeout_seconds):
            done, _ = await asyncio.wait((work, pulse), return_when=asyncio.FIRST_COMPLETED)
            if work in done:
                await work
                status, error = "succeeded", None
            else:
                await pulse
    except LeaseLost:
        logger.info("job_lease_lost job_id=%s", job.id)
        return
    except APIError as exc:
        error = exc.code
    except TimeoutError:
        error = "processing_timeout"
    except asyncio.CancelledError:
        status, error = "interrupted", "worker_stopped"
        raise
    except Exception:
        # Library exceptions can contain paths, audio text or SQL parameters. Never log them.
        logger.error("job_processing_error job_id=%s", job.id)
    finally:
        work.cancel()
        pulse.cancel()
        await asyncio.gather(work, pulse, return_exceptions=True)
        try:
            if status != "succeeded":
                await save(
                    factory,
                    job,
                    status=status,
                    error_code=error,
                    finished_at=func.now(),
                    lease_expires_at=None,
                    claim_token=None,
                )
            logger.info("job_finished job_id=%s status=%s error_code=%s", job.id, status, error)
        except (LeaseLost, SQLAlchemyError):
            # If DB is unavailable, the persisted lease becomes interrupted on recovery.
            logger.warning("job_finish_deferred job_id=%s", job.id)


async def main() -> None:
    config = Settings()
    configure_logging(config.log_level)
    engine = create_engine(config)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    main_task = asyncio.current_task()
    assert main_task is not None
    asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, main_task.cancel)
    logger.info("processing_worker_started")
    try:
        while True:
            try:
                job = await claim(factory, config)
                if job is not None:
                    await run_job(factory, config, job)
                    continue
            except SQLAlchemyError:
                logger.error("processing_database_unavailable")
            await asyncio.sleep(2)
    except asyncio.CancelledError:
        logger.info("processing_worker_stopped")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
