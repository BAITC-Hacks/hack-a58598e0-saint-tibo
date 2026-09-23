"""One command: python tools/mock-api/smoke.py (stdlib only, starts its own server)."""

import json
import io
import zipfile
from http.server import HTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import STATES, Handler

server = HTTPServer(("127.0.0.1", 0), Handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base = f"http://127.0.0.1:{server.server_port}"
meeting = "10000000-0000-4000-8000-000000000001"
recording = "20000000-0000-4000-8000-000000000001"


def request(path, method="GET", body=None, headers=None):
    data = json.dumps(body).encode() if isinstance(body, dict) else body
    req = Request(
        base + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer synthetic-smoke",
            "X-Mock-User": "smoke-user",
            **({"Content-Type": "application/json"} if isinstance(body, dict) else {}),
            **(headers or {}),
        },
    )
    try:
        response = urlopen(req, timeout=3)
    except HTTPError as exc:
        response = exc
    payload = response.read()
    if response.headers.get("Content-Type") == "application/json":
        payload = json.loads(payload) if payload else None
    return response.status, payload, response.headers


try:
    assert request("/health/ready")[1]["source"] == "mock"
    status, listed, _ = request("/api/v1/meetings")
    assert status == 200 and listed["total"] == 12
    assert request("/api/v1/meetings?scenario=empty")[1]["items"] == []
    assert request(f"/api/v1/meetings/{meeting}")[1]["title"].startswith("Образец")
    assert request(f"/api/v1/meetings/{meeting}/participants")[1]["total"] == 3
    assert request(f"/api/v1/meetings/{meeting}/recordings")[1]["items"][0]["status"] == "ready"
    ready_job = request(f"/api/v1/meetings/{meeting}/recordings/{recording}/jobs")[1]["items"][0]
    assert ready_job["status"] == "succeeded" and ready_job["target_stage"] == "transcribe"
    processing = "10000000-0000-4000-8000-000000000002"
    processing_recording = "20000000-0000-4000-8000-000000000002"
    assert request(f"/api/v1/meetings/{processing}/participants")[1]["items"]
    assert (
        request(f"/api/v1/meetings/{processing}/recordings/{processing_recording}/jobs")[1][
            "items"
        ][0]["status"]
        == "running"
    )
    incomplete = "10000000-0000-4000-8000-000000000005"
    incomplete_recording = "20000000-0000-4000-8000-000000000005"
    assert (
        request(f"/api/v1/meetings/{incomplete}/recordings/{incomplete_recording}")[1]["status"]
        == "incomplete"
    )
    assert (
        request(f"/api/v1/meetings/{incomplete}/recordings/{incomplete_recording}/jobs")[1][
            "items"
        ][0]["error_code"]
        == "transcription_unavailable"
    )
    versions_path = f"/api/v1/meetings/{meeting}/recordings/{recording}/results"
    versions = request(versions_path)[1]
    assert versions["total"] == 1 and versions["items"][0]["completed_stage"] == "transcribe"
    assert request(versions_path + "/" + versions["items"][0]["id"] + "/segments")[1]["total"] == 3
    review_path = versions_path + "/" + versions["items"][0]["id"] + "/review"
    export_path = versions_path + "/" + versions["items"][0]["id"] + "/export"
    review = request(review_path)[1]
    assert review["source"] == "mock" and review["reviewed"]
    assert review["action_items"][0]["source_segment_ids"][0] == review["segments"][0]["id"]
    assert review["segments"][-1]["end_ms"] <= request(f"/api/v1/meetings/{meeting}/recordings/{recording}")[1]["duration_ms"]
    assert review["summary"]["decisions"][0]["source_segment_ids"][0] == review["segments"][0]["id"]
    status, audio, headers = request(
        f"/api/v1/meetings/{meeting}/recordings/{recording}/media", headers={"Range": "bytes=0-43"}
    )
    assert status == 206 and len(audio) == 44 and headers["Content-Range"].startswith("bytes 0-43/")
    assert len(request(f"/api/v1/meetings/{meeting}/recordings/{recording}/media", headers={"Range": "bytes=-44"})[1]) == 44
    assert request(export_path + "?format=pdf")[1].startswith(b"%PDF")
    assert request(export_path + "?format=docx")[1].startswith(b"PK")
    assert request(export_path + "?format=pdf&revision=1")[0] == 409
    assert request(review_path, "PATCH", {"revision": 1, "reviewed": True})[0] == 409
    changed = [dict(item) for item in review["segments"]]
    changed[0]["text"] = "Проверить новую редакцию договора."
    actions = [dict(item) for item in review["action_items"]]
    actions[0]["status"] = "done"
    actions[0]["text"] = "Подготовить новую редакцию договора."
    updated = request(review_path, "PATCH", {"revision": 2, "reviewed": True, "segments": changed, "action_items": actions})[1]
    assert updated["revision"] == 3 and updated["segments"][0]["text"] == changed[0]["text"]
    assert request(review_path + "?revision=2")[1]["segments"][0]["text"] == review["segments"][0]["text"]
    docx = request(export_path + "?format=docx&revision=3")[1]
    with zipfile.ZipFile(io.BytesIO(docx)) as document:
        assert "Подготовить новую редакцию договора." in document.read("word/document.xml").decode()

    failed_meeting = "10000000-0000-4000-8000-000000000003"
    failed_recording = "20000000-0000-4000-8000-000000000003"
    status, error, _ = request(
        f"/api/v1/meetings/{failed_meeting}/recordings/{failed_recording}/file", "PUT", b"invalid"
    )
    assert status == 415 and error["error"]["code"] == "invalid_audio"
    save_failure = "10000000-0000-4000-8000-000000000004"
    save_recording = "20000000-0000-4000-8000-000000000004"
    save_version = "40000000-0000-4000-8000-000000000004"
    assert request(f"/api/v1/meetings/{save_failure}/recordings/{save_recording}/results/{save_version}/review", "PATCH", {"revision": 1})[0] == 503
    unavailable_export = "10000000-0000-4000-8000-000000000006"
    export_recording = "20000000-0000-4000-8000-000000000006"
    export_version = "40000000-0000-4000-8000-000000000006"
    assert request(f"/api/v1/meetings/{unavailable_export}/recordings/{export_recording}/results/{export_version}/review")[1]["reviewed"]
    assert request(f"/api/v1/meetings/{unavailable_export}/recordings/{export_recording}/results/{export_version}/export?format=pdf")[0] == 503

    status, created, _ = request(
        "/api/v1/meetings",
        "POST",
        {"title": "Новый образец", "started_at": "2026-09-23T05:00:00Z", "timezone": "Asia/Almaty"},
    )
    assert status == 201
    new_id = created["id"]
    _, upload, _ = request(
        f"/api/v1/meetings/{new_id}/recordings",
        "POST",
        {"source": "file", "original_filename": "sample.wav", "content_type": "audio/wav"},
    )
    path = f"/api/v1/meetings/{new_id}/recordings/{upload['id']}"
    assert request(path + "/file", "PUT", b"synthetic bytes")[1]["status"] == "ready"
    _, job, _ = request(
        path + "/jobs", "POST", {"request_key": "90000000-0000-4000-8000-000000000099"}
    )
    assert job["status"] == "queued"
    assert request(path + "/jobs/" + job["id"])[1]["status"] == "running"
    completed = request(path + "/jobs/" + job["id"])[1]
    assert completed["status"] == "succeeded"
    version = completed["result_version_id"]
    new_review = path + "/results/" + version + "/review"
    review = request(new_review)[1]
    assert review["source"] == "mock" and not review["reviewed"]
    assert (
        request(new_review, "PATCH", {"revision": 1, "reviewed": True})[1][
            "revision"
        ]
        == 2
    )
    assert request(path + "/results/" + version + "/export?format=pdf")[0] == 200
    assert len(STATES["smoke-user"].meetings) == 13
    seeded = STATES["smoke-user"]
    meeting_ids = {item["id"] for item in seeded.meetings}
    recording_ids = {item["id"] for item in seeded.recordings}
    participant_ids = {item["id"] for item in seeded.participants}
    assert len(meeting_ids) == 13 and len({item["display_name"] for item in seeded.participants}) == 18
    assert all(item["meeting_id"] in meeting_ids for item in seeded.participants + seeded.recordings)
    assert all(item["recording_id"] in recording_ids for item in seeded.jobs)
    assert {item["status"] for item in seeded.jobs} == {"queued", "running", "succeeded", "failed", "interrupted"}
    for review in seeded.reviews.values():
        segments = {item["id"] for item in review["segments"]}
        speakers = {item["id"] for item in review["speakers"]}
        assert review["recording_id"] in recording_ids
        assert all(item["speaker_id"] in speakers for item in review["segments"])
        assert all(item["participant_id"] is None or item["participant_id"] in participant_ids for item in review["speakers"])
        assert all(set(item["source_segment_ids"]) <= segments for item in review["action_items"])
        assert all(item["assignee_participant_id"] is None or item["assignee_participant_id"] in participant_ids for item in review["action_items"])
    assert request("/api/v1/meetings", headers={"X-Mock-User": "other-user"})[1]["total"] == 12
    assert request("/api/v1/demo/reset", "POST")[1]["reset"]
    assert request("/api/v1/meetings")[1]["total"] == 12
    print("mock smoke: meetings, recording, jobs, review, media, export and failure states OK")
finally:
    server.shutdown()
    thread.join()
