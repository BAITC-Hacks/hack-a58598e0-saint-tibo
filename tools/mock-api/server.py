"""Loopback-only, synthetic HTTP fixture server for the #83 frontend walkthrough."""

import copy
import io
import json
import math
import os
import struct
import time
import wave
import zipfile
from html import escape
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import NAMESPACE_URL, uuid5

FIXTURE = json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))
STAMP = "2026-09-23T05:00:00Z"
RECORDING_BYTES = 384044


def sample_audio():
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        # Tones are synthetic; the transcript is explicitly sample text, not STT output.
        audio.writeframes(
            b"".join(
                struct.pack("<h", int(1800 * math.sin(2 * math.pi * 440 * n / 16000)))
                for n in range(16000 * 12)
            )
        )
    return output.getvalue()


AUDIO = sample_audio()
assert len(AUDIO) == RECORDING_BYTES


def stable_id(kind, value):
    return str(uuid5(NAMESPACE_URL, f"saint-tibo-mock/{kind}/{value}"))


def page(items, query):
    try:
        limit = int(query.get("limit", ["20"])[0])
        offset = int(query.get("offset", ["0"])[0])
    except ValueError as exc:
        raise ValueError("Invalid pagination") from exc
    if not 1 <= limit <= 100 or offset < 0:
        raise ValueError("Invalid pagination")
    return {
        "items": items[offset : offset + limit],
        "total": len(items),
        "limit": limit,
        "offset": offset,
    }


def pdf_sample():
    content = b"BT /F1 18 Tf 50 780 Td (SYNTHETIC MOCK - SAMPLE PROTOCOL) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    output = b"%PDF-1.4\n"
    offsets = [0]
    for number, item in enumerate(objects, 1):
        offsets.append(len(output))
        output += b"%d 0 obj\n%s\nendobj\n" % (number, item)
    start = len(output)
    output += b"xref\n0 6\n0000000000 65535 f \n"
    output += b"".join(b"%010d 00000 n \n" % offset for offset in offsets[1:])
    output += b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % start
    return output


def docx_sample():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as document:
        document.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.'
            'relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-'
            'officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        document.writestr(
            "_rels/.rels",
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/'
            '2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
        )
        document.writestr(
            "word/document.xml",
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body><w:p><w:r><w:t>СИНТЕТИЧЕСКИЙ ПРИМЕР — "
            + escape(FIXTURE["meetings"][0]["title"])
            + "</w:t></w:r></w:p></w:body></w:document>",
        )
    return output.getvalue()


class MockState:
    def __init__(self):
        self.meetings = copy.deepcopy(FIXTURE["meetings"])
        self.participants = copy.deepcopy(FIXTURE["participants"])
        self.recordings = copy.deepcopy(FIXTURE["recordings"])
        self.jobs = copy.deepcopy(FIXTURE["jobs"])
        self.reviews = {self.meetings[0]["id"]: copy.deepcopy(FIXTURE["review"])}
        self.polls = {}
        self.counter = 0
        for index in (3, 5):
            meeting = self.meetings[index]
            recording = self.recordings[index]
            version = next(
                job["result_version_id"]
                for job in self.jobs
                if job["recording_id"] == recording["id"]
            )
            self.reviews[meeting["id"]] = self.clone_review(meeting["id"], recording["id"], version)
            if index == 5:
                self.reviews[meeting["id"]].update(reviewed=True, revision=2)

    def new_id(self, kind):
        self.counter += 1
        return stable_id(kind, self.counter)

    def clone_review(self, meeting_id, recording_id, version_id):
        review = copy.deepcopy(FIXTURE["review"])
        review.update(
            result_version_id=version_id, recording_id=recording_id, revision=1, reviewed=False
        )
        participant_ids = [p["id"] for p in self.participants if p["meeting_id"] == meeting_id]
        speaker_ids = {}
        segment_ids = {}
        for index, speaker in enumerate(review["speakers"]):
            old = speaker["id"]
            speaker["id"] = stable_id("speaker", f"{version_id}/{index}")
            speaker["result_version_id"] = version_id
            speaker["participant_id"] = (
                participant_ids[index] if index < len(participant_ids) else None
            )
            speaker_ids[old] = speaker["id"]
        for index, segment in enumerate(review["segments"]):
            old = segment["id"]
            segment["id"] = stable_id("segment", f"{version_id}/{index}")
            segment["recording_id"] = recording_id
            segment["result_version_id"] = version_id
            segment["speaker_id"] = speaker_ids.get(segment["speaker_id"])
            segment_ids[old] = segment["id"]
        for index, item in enumerate(review["action_items"]):
            item["id"] = stable_id("action", f"{version_id}/{index}")
            item["result_version_id"] = version_id
            item["assignee_participant_id"] = participant_ids[-1] if participant_ids else None
            item["source_segment_ids"] = [
                segment_ids[value] for value in item["source_segment_ids"]
            ]
        for entries in review["summary"].values():
            for entry in entries:
                entry["source_segment_ids"] = [
                    segment_ids[value] for value in entry["source_segment_ids"]
                ]
        return review

    def advance_job(self, meeting_id, recording, job):
        if job["id"] not in self.polls:
            return
        self.polls[job["id"]] += 1
        if self.polls[job["id"]] == 1:
            job.update(status="running", stage="transcribe", progress=0.5, started_at=STAMP)
        else:
            version = stable_id("version", job["id"])
            job.update(
                status="succeeded",
                stage="complete",
                progress=1,
                result_version_id=version,
                finished_at=STAMP,
            )
            self.reviews[meeting_id] = self.clone_review(meeting_id, recording["id"], version)
            self.polls.pop(job["id"])


# ponytail: one in-memory state; restart to reset, isolate per session for parallel demos.
STATE = MockState()


class Handler(BaseHTTPRequestHandler):
    server_version = "SaintTiboSyntheticMock/1"

    def log_message(self, format_string, *args):
        # Do not log URLs, headers or uploaded bytes: mock requests may contain user input.
        print(f"mock-api {self.command} {args[1] if len(args) > 1 else '-'}", flush=True)

    def cors_origin(self):
        origin = self.headers.get("Origin")
        allowed = os.environ.get("MOCK_FRONTEND_ORIGIN", "http://localhost:3000")
        return origin if origin == allowed else None

    def send(self, status, body=b"", content_type="application/json", extra=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Saint-Tibo-Mock", "synthetic")
        if origin := self.cors_origin():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def json(self, status, value):
        self.send(status, json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def error(self, status, code, message):
        self.json(status, {"error": {"code": code, "message": message, "details": None}})

    def body(self, binary=False):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid Content-Length") from None
        if not 0 <= length <= 8 * 1024 * 1024:
            raise OverflowError("Mock upload exceeds 8 MiB")
        raw = self.rfile.read(length)
        if binary:
            return raw
        try:
            value = json.loads(raw or b"{}")
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON") from exc
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value

    def do_OPTIONS(self):
        if not self.cors_origin():
            return self.error(403, "forbidden", "Origin is not allowed")
        self.send(
            204,
            extra={
                "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
                "Access-Control-Max-Age": "600",
            },
        )

    def do_GET(self):
        self.route()

    def do_HEAD(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PATCH(self):
        self.route()

    def do_PUT(self):
        self.route()

    def do_DELETE(self):
        self.route()

    def route(self):
        url = urlsplit(self.path)
        if self.command == "GET" and url.path == "/health/ready":
            return self.json(200, {"status": "ok", "source": "mock"})
        if not self.headers.get("Authorization", "").startswith("Bearer "):
            return self.error(401, "unauthorized", "Bearer token required")
        parts = url.path.strip("/").split("/")
        if parts[:3] != ["api", "v1", "meetings"]:
            return self.error(404, "not_found", "Mock endpoint not found")
        query = parse_qs(url.query)
        try:
            return self.meeting_route(parts[3:], query)
        except OverflowError as exc:
            return self.error(413, "upload_too_large", str(exc))
        except (ValueError, KeyError, TypeError) as exc:
            return self.error(422, "validation_error", str(exc))

    def meeting_route(self, parts, query):
        method = self.command
        if not parts:
            if method == "GET":
                if query.get("scenario") == ["loading"]:
                    time.sleep(0.8)
                if query.get("scenario") == ["error"]:
                    return self.error(503, "mock_unavailable", "Synthetic list failure")
                meetings = [] if query.get("scenario") == ["empty"] else STATE.meetings[::-1]
                return self.json(200, page(meetings, query))
            if method == "POST":
                body = self.body()
                if not all(body.get(key) for key in ("title", "started_at", "timezone")):
                    raise ValueError("title, started_at and timezone are required")
                meeting = {
                    "id": STATE.new_id("meeting"),
                    "owner_id": "synthetic-mock-user",
                    "title": body["title"],
                    "started_at": body["started_at"],
                    "timezone": body["timezone"],
                    "created_at": STAMP,
                    "updated_at": STAMP,
                }
                STATE.meetings.append(meeting)
                return self.json(201, meeting)
            return self.error(405, "method_not_allowed", "Unsupported method")

        meeting_id = parts[0]
        meeting = next((item for item in STATE.meetings if item["id"] == meeting_id), None)
        if meeting is None:
            return self.error(404, "not_found", "Meeting not found")
        if len(parts) == 1:
            if method == "GET":
                return self.json(200, meeting)
            if method == "PATCH":
                body = self.body()
                if any(key not in ("title", "started_at", "timezone") for key in body):
                    raise ValueError("Unknown meeting field")
                meeting.update(body)
                meeting["updated_at"] = STAMP
                return self.json(200, meeting)
            if method == "DELETE":
                STATE.meetings.remove(meeting)
                STATE.participants[:] = [
                    p for p in STATE.participants if p["meeting_id"] != meeting_id
                ]
                STATE.recordings[:] = [r for r in STATE.recordings if r["meeting_id"] != meeting_id]
                STATE.reviews.pop(meeting_id, None)
                return self.send(204)
            return self.error(405, "method_not_allowed", "Unsupported method")
        if parts[1] == "participants":
            return self.participants_route(meeting_id, parts[2:])
        if parts[1] == "recordings":
            return self.recordings_route(meeting_id, parts[2:], query)
        if parts[1] == "review":
            return self.review_route(meeting_id)
        if parts[1] == "export" and method == "GET":
            return self.export_route(meeting_id, query)
        return self.error(404, "not_found", "Mock endpoint not found")

    def participants_route(self, meeting_id, parts):
        items = [p for p in STATE.participants if p["meeting_id"] == meeting_id]
        if not parts:
            if self.command == "GET":
                return self.json(200, page(items, parse_qs(urlsplit(self.path).query)))
            if self.command == "POST":
                body = self.body()
                if not body.get("display_name"):
                    raise ValueError("display_name is required")
                participant = {
                    "id": STATE.new_id("participant"),
                    "meeting_id": meeting_id,
                    "display_name": body["display_name"],
                    "role": body.get("role"),
                    "created_at": STAMP,
                    "updated_at": STAMP,
                }
                STATE.participants.append(participant)
                return self.json(201, participant)
        if len(parts) == 1:
            participant = next((p for p in items if p["id"] == parts[0]), None)
            if participant is None:
                return self.error(404, "not_found", "Participant not found")
            if self.command == "PATCH":
                body = self.body()
                if any(key not in ("display_name", "role") for key in body):
                    raise ValueError("Unknown participant field")
                participant.update(body)
                participant["updated_at"] = STAMP
                return self.json(200, participant)
            if self.command == "DELETE":
                STATE.participants.remove(participant)
                return self.send(204)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def recordings_route(self, meeting_id, parts, query):
        items = [r for r in STATE.recordings if r["meeting_id"] == meeting_id]
        if not parts:
            if self.command == "GET":
                return self.json(200, page(items[::-1], query))
            if self.command == "POST":
                body = self.body()
                if not all(
                    body.get(key) for key in ("source", "original_filename", "content_type")
                ):
                    raise ValueError("source, original_filename and content_type are required")
                recording_id = STATE.new_id("recording")
                recording = {
                    "id": recording_id,
                    "meeting_id": meeting_id,
                    "source": body["source"],
                    "original_filename": body["original_filename"],
                    "content_type": body["content_type"],
                    "status": "receiving",
                    "size_bytes": 0,
                    "duration_ms": None,
                    "media_content_type": None,
                    "media_size_bytes": None,
                    "media_url": None,
                    "error_code": None,
                    "created_at": STAMP,
                    "updated_at": STAMP,
                }
                STATE.recordings.append(recording)
                return self.json(201, recording)
            return self.error(405, "method_not_allowed", "Unsupported method")
        recording = next((r for r in items if r["id"] == parts[0]), None)
        if recording is None:
            return self.error(404, "not_found", "Recording not found")
        if len(parts) == 1:
            if self.command == "GET":
                return self.json(200, recording)
            if self.command == "DELETE":
                STATE.recordings.remove(recording)
                STATE.jobs[:] = [
                    job for job in STATE.jobs if job["recording_id"] != recording["id"]
                ]
                STATE.reviews.pop(meeting_id, None)
                return self.send(204)
            return self.error(405, "method_not_allowed", "Unsupported method")
        if parts[1] == "file" and self.command == "PUT":
            content = self.body(binary=True)
            if meeting_id == FIXTURE["meetings"][2]["id"] or query.get("scenario") == [
                "upload_failure"
            ]:
                recording.update(status="failed", error_code="invalid_audio", updated_at=STAMP)
                return self.error(415, "invalid_audio", "Synthetic upload failure")
            if not content:
                raise ValueError("Upload is empty")
            recording.update(
                status="ready",
                size_bytes=len(content),
                duration_ms=12000,
                media_content_type="audio/wav",
                media_size_bytes=len(AUDIO),
                media_url=f"/api/media/meetings/{meeting_id}/recordings/{recording['id']}",
                updated_at=STAMP,
            )
            # Uploaded bytes are discarded. Playback and review always use synthetic fixtures.
            return self.json(200, recording)
        if parts[1] == "chunks" and len(parts) == 3 and self.command == "PUT":
            if int(parts[2]) < 0 or not self.body(binary=True):
                raise ValueError("Invalid chunk")
            recording["size_bytes"] += int(self.headers["Content-Length"])
            return self.json(200, recording)
        if parts[1] == "finalize" and self.command == "POST":
            body = self.body()
            if "expected_chunks" not in body or "is_complete" not in body:
                raise ValueError("expected_chunks and is_complete are required")
            recording.update(
                status="ready" if body["is_complete"] else "incomplete",
                duration_ms=12000,
                media_content_type="audio/wav",
                media_size_bytes=len(AUDIO),
                media_url=f"/api/media/meetings/{meeting_id}/recordings/{recording['id']}",
                updated_at=STAMP,
            )
            return self.json(200, recording)
        if parts[1] == "jobs":
            return self.jobs_route(meeting_id, recording, parts[2:], query)
        if parts[1] == "results":
            return self.results_route(meeting_id, recording, parts[2:], query)
        if parts[1] == "media" and self.command in ("GET", "HEAD"):
            return self.media_route(recording)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def jobs_route(self, meeting_id, recording, parts, query):
        jobs = [job for job in STATE.jobs if job["recording_id"] == recording["id"]]
        if not parts:
            if self.command == "GET":
                for job in jobs:
                    STATE.advance_job(meeting_id, recording, job)
                return self.json(200, page(jobs[::-1], query))
            if self.command == "POST":
                body = self.body()
                if not body.get("request_key"):
                    raise ValueError("request_key is required")
                old = next((job for job in jobs if job["request_key"] == body["request_key"]), None)
                if old:
                    return self.json(202, old)
                if recording["status"] not in ("ready", "incomplete") or (
                    recording["status"] == "incomplete" and not body.get("allow_incomplete")
                ):
                    return self.error(409, "recording_not_ready", "Recording is not ready")
                job = {
                    "id": STATE.new_id("job"),
                    "recording_id": recording["id"],
                    "request_key": body["request_key"],
                    "retry_of_job_id": body.get("retry_of_job_id"),
                    "allow_incomplete": bool(body.get("allow_incomplete", False)),
                    "language": body.get("language", "auto"),
                    "target_stage": "transcribe",
                    "attempt": len(jobs) + 1,
                    "status": "queued",
                    "stage": "decode",
                    "progress": 0,
                    "error_code": None,
                    "result_version_id": None,
                    "created_at": STAMP,
                    "updated_at": STAMP,
                    "started_at": None,
                    "finished_at": None,
                }
                STATE.jobs.append(job)
                STATE.polls[job["id"]] = 0
                return self.json(202, job)
        if len(parts) == 1 and self.command == "GET":
            job = next((job for job in jobs if job["id"] == parts[0]), None)
            if job is None:
                return self.error(404, "not_found", "Job not found")
            STATE.advance_job(meeting_id, recording, job)
            return self.json(200, job)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def results_route(self, meeting_id, recording, parts, query):
        if self.command != "GET":
            return self.error(405, "method_not_allowed", "Unsupported method")
        review = STATE.reviews.get(meeting_id)
        jobs = [
            job
            for job in STATE.jobs
            if job["recording_id"] == recording["id"] and job["result_version_id"]
        ]
        versions = [
            {
                "id": job["result_version_id"],
                "recording_id": recording["id"],
                "job_id": job["id"],
                "revision": review["revision"] if review else 1,
                "status": "reviewed" if review and review["reviewed"] else "draft",
                "completed_stage": "transcribe",
                "is_incomplete": recording["status"] == "incomplete",
                "language": job["language"],
                "duration_ms": recording["duration_ms"],
                "model_id": "synthetic/mock",
                "model_revision": "fixture-v1",
                "segment_count": len(review["segments"]) if review else 0,
                "created_at": job["created_at"],
                "updated_at": job["updated_at"],
            }
            for job in jobs
        ]
        if not parts:
            return self.json(200, page(versions[::-1], query))
        version = next((item for item in versions if item["id"] == parts[0]), None)
        if version is None:
            return self.error(404, "not_found", "Result version not found")
        if len(parts) == 1:
            return self.json(200, version)
        if len(parts) == 2 and parts[1] == "segments":
            return self.json(200, page(review["segments"] if review else [], query))
        return self.error(404, "not_found", "Mock endpoint not found")

    def review_route(self, meeting_id):
        if meeting_id == FIXTURE["meetings"][3]["id"] and self.command == "PATCH":
            return self.error(503, "save_unavailable", "Synthetic save failure")
        review = STATE.reviews.get(meeting_id)
        if review is None:
            return self.error(404, "not_found", "Synthetic result is not ready")
        if self.command == "GET":
            return self.json(200, review)
        if self.command == "PATCH":
            body = self.body()
            if body.get("revision") != review["revision"]:
                return self.error(409, "version_conflict", "Review revision changed")
            allowed = {"revision", "reviewed", "summary", "speakers", "action_items"}
            if any(key not in allowed for key in body):
                raise ValueError("Unknown review field")
            for key in allowed - {"revision"}:
                if key in body:
                    review[key] = body[key]
            review["revision"] += 1
            return self.json(200, review)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def export_route(self, meeting_id, query):
        if meeting_id == FIXTURE["meetings"][5]["id"]:
            return self.error(503, "export_unavailable", "Synthetic export failure")
        review = STATE.reviews.get(meeting_id)
        if review is None or not review["reviewed"]:
            return self.error(409, "review_required", "Review the result before export")
        format_name = query.get("format", [""])[0]
        if format_name == "pdf":
            return self.send(
                200,
                pdf_sample(),
                "application/pdf",
                {"Content-Disposition": 'attachment; filename="synthetic-protocol.pdf"'},
            )
        if format_name == "docx":
            return self.send(
                200,
                docx_sample(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                {"Content-Disposition": 'attachment; filename="synthetic-protocol.docx"'},
            )
        raise ValueError("format must be pdf or docx")

    def media_route(self, recording):
        if not recording["media_url"]:
            return self.error(404, "media_unavailable", "Synthetic audio is unavailable")
        range_header = self.headers.get("Range")
        if range_header:
            try:
                unit, value = range_header.split("=", 1)
                start_text, end_text = value.split("-", 1)
                if unit != "bytes" or not start_text or "," in value:
                    raise ValueError
                start = int(start_text)
                end = min(int(end_text), len(AUDIO) - 1) if end_text else len(AUDIO) - 1
                if start < 0 or start > end or start >= len(AUDIO):
                    raise ValueError
            except ValueError:
                return self.send(
                    416, extra={"Content-Range": f"bytes */{len(AUDIO)}", "Accept-Ranges": "bytes"}
                )
            return self.send(
                206,
                AUDIO[start : end + 1],
                "audio/wav",
                {"Accept-Ranges": "bytes", "Content-Range": f"bytes {start}-{end}/{len(AUDIO)}"},
            )
        return self.send(200, AUDIO, "audio/wav", {"Accept-Ranges": "bytes"})


if __name__ == "__main__":
    if os.environ.get("MOCK_API_DEV_ONLY") != "1":
        raise SystemExit("MOCK_API_DEV_ONLY=1 is required")
    host = os.environ.get("MOCK_API_HOST", "127.0.0.1")
    port = int(os.environ.get("MOCK_API_PORT", "8015"))
    print(f"Synthetic mock API on {host}:{port}; no database or recordings are read", flush=True)
    HTTPServer((host, port), Handler).serve_forever()
