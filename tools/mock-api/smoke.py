"""One command: python tools/mock-api/smoke.py (stdlib only, starts its own server)."""

import json
from http.server import HTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import STATE, Handler

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
    assert status == 200 and listed["total"] == 6
    assert request("/api/v1/meetings?scenario=empty")[1]["items"] == []
    assert request(f"/api/v1/meetings/{meeting}")[1]["title"].startswith("Образец")
    assert request(f"/api/v1/meetings/{meeting}/participants")[1]["total"] == 3
    assert request(f"/api/v1/meetings/{meeting}/recordings")[1]["items"][0]["status"] == "ready"
    ready_job = request(f"/api/v1/meetings/{meeting}/recordings/{recording}/jobs")[1]["items"][0]
    assert ready_job["status"] == "succeeded" and ready_job["target_stage"] == "transcribe"
    processing = "10000000-0000-4000-8000-000000000002"
    processing_recording = "20000000-0000-4000-8000-000000000002"
    assert request(f"/api/v1/meetings/{processing}/participants")[1]["items"] == []
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
    review = request(f"/api/v1/meetings/{meeting}/review")[1]
    assert review["source"] == "mock" and review["reviewed"]
    assert review["action_items"][0]["source_segment_ids"][0] == review["segments"][0]["id"]
    assert review["segments"][-1]["end_ms"] <= 12000
    assert review["summary"]["decisions"][0]["source_segment_ids"][0] == review["segments"][0]["id"]
    status, audio, headers = request(
        f"/api/v1/meetings/{meeting}/recordings/{recording}/media", headers={"Range": "bytes=0-43"}
    )
    assert status == 206 and len(audio) == 44 and headers["Content-Range"].startswith("bytes 0-43/")
    assert request(f"/api/v1/meetings/{meeting}/export?format=pdf")[1].startswith(b"%PDF")
    assert request(f"/api/v1/meetings/{meeting}/export?format=docx")[1].startswith(b"PK")

    failed_meeting = "10000000-0000-4000-8000-000000000003"
    failed_recording = "20000000-0000-4000-8000-000000000003"
    status, error, _ = request(
        f"/api/v1/meetings/{failed_meeting}/recordings/{failed_recording}/file", "PUT", b"invalid"
    )
    assert status == 415 and error["error"]["code"] == "invalid_audio"
    save_failure = "10000000-0000-4000-8000-000000000004"
    assert request(f"/api/v1/meetings/{save_failure}/review", "PATCH", {"revision": 1})[0] == 503
    unavailable_export = "10000000-0000-4000-8000-000000000006"
    assert request(f"/api/v1/meetings/{unavailable_export}/review")[1]["reviewed"]
    assert request(f"/api/v1/meetings/{unavailable_export}/export?format=pdf")[0] == 503

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
    assert request(path + "/jobs/" + job["id"])[1]["status"] == "succeeded"
    review = request(f"/api/v1/meetings/{new_id}/review")[1]
    assert review["source"] == "mock" and not review["reviewed"]
    assert (
        request(f"/api/v1/meetings/{new_id}/review", "PATCH", {"revision": 1, "reviewed": True})[1][
            "revision"
        ]
        == 2
    )
    assert request(f"/api/v1/meetings/{new_id}/export?format=pdf")[0] == 200
    assert len(STATE.meetings) == 7
    print("mock smoke: meetings, recording, jobs, review, media, export and failure states OK")
finally:
    server.shutdown()
    thread.join()
