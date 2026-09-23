"""The canvas is append-only and a recording keeps the version it started with."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from saint_tibo.auth.policy import Role
from saint_tibo.modules.meetings.models import Recording
from saint_tibo.modules.processing.models import ProcessingJob
from saint_tibo.modules.results.schemas import TranscriptSegment
from saint_tibo.modules.results.service import publish_transcript

pytestmark = pytest.mark.integration


async def test_canvas_versions_conflict_and_recording_pin(
    api_client, make_api_client, make_user, db_session
):
    meeting = await api_client.post(
        "/api/v1/meetings",
        json={
            "title": "Canvas check",
            "started_at": "2026-09-23T10:00:00Z",
            "timezone": "UTC",
        },
    )
    assert meeting.status_code == 201, meeting.text
    path = f"/api/v1/meetings/{meeting.json()['id']}"
    assert (await api_client.get(f"{path}/canvas")).json() is None

    legacy = await api_client.post(
        f"{path}/recordings",
        json={
            "source": "file",
            "original_filename": "old.wav",
            "content_type": "audio/wav",
        },
    )
    assert legacy.status_code == 201
    assert legacy.json()["canvas_version_id"] is None

    fields = {
        "purpose": None,
        "inputs": None,
        "expected_outputs": None,
        "facilitation_flow": None,
        "agenda_structure": None,
        "participants": None,
        "expected_artifacts": "",
    }
    first = await api_client.put(f"{path}/canvas", json={"base_revision": 0, **fields})
    assert first.status_code == 200
    assert first.json()["revision"] == 1
    assert first.json()["purpose"] is None
    assert first.json()["expected_artifacts"] == ""
    assert (
        await api_client.put(
            f"{path}/canvas", json={"base_revision": 1, **fields, "purpose": "bad\x00text"}
        )
    ).status_code == 422
    assert (
        await api_client.put(f"{path}/canvas", json={"base_revision": 0, **fields})
    ).status_code == 409

    second = await api_client.put(
        f"{path}/canvas",
        json={
            "base_revision": 1,
            **fields,
            "purpose": "Decide next steps",
        },
    )
    assert second.status_code == 200
    assert second.json()["revision"] == 2
    pinned = await api_client.post(
        f"{path}/recordings",
        json={
            "source": "file",
            "original_filename": "new.wav",
            "content_type": "audio/wav",
        },
    )
    assert pinned.status_code == 201
    assert pinned.json()["canvas_version_id"] == second.json()["id"]

    third = await api_client.put(
        f"{path}/canvas",
        json={
            "base_revision": 2,
            **fields,
            "purpose": "Changed after recording",
        },
    )
    assert third.status_code == 200
    assert (await api_client.get(f"{path}/canvas")).json()["id"] == third.json()["id"]
    assert (await api_client.get(f"{path}/canvas/{second.json()['id']}")).json()[
        "purpose"
    ] == "Decide next steps"
    with pytest.raises(DBAPIError):
        async with db_session.begin_nested():
            await db_session.execute(
                text("UPDATE app.meeting_canvases SET purpose = 'changed' WHERE id = :id"),
                {"id": UUID(second.json()["id"])},
            )
    recording = await db_session.scalar(
        select(Recording).where(Recording.id == UUID(pinned.json()["id"]))
    )
    assert recording is not None
    assert str(recording.canvas_version_id) == second.json()["id"]

    recording.status = "ready"
    recording.duration_ms = 1000
    recording.media_size_bytes = 1
    job = ProcessingJob(
        recording_id=recording.id,
        request_key=uuid4(),
        retry_of_job_id=None,
        allow_incomplete=False,
        language="auto",
        target_stage="transcribe",
        attempt=1,
        status="running",
        stage="transcribe",
        progress=0.5,
        claim_token=uuid4(),
        lease_expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    result_id = await publish_transcript(
        db_session,
        job,
        [TranscriptSegment(start_ms=0, end_ms=1000, text="A decision")],
        "en",
        1000,
        model_id="test",
        model_revision="test",
    )
    result = await api_client.get(f"{path}/recordings/{pinned.json()['id']}/results/{result_id}")
    assert result.status_code == 200
    assert result.json()["canvas_version_id"] == second.json()["id"]

    foreign = make_api_client(make_user(Role.USER, "someone-else"))
    assert (await foreign.get(f"{path}/canvas/{second.json()['id']}")).status_code == 404
