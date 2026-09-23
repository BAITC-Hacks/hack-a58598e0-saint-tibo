"""Loopback-only, synthetic HTTP fixture server for the #83 frontend walkthrough."""

import copy
import json
import os
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import RLock
from urllib.parse import parse_qs, urlsplit
from uuid import NAMESPACE_URL, uuid5

from saint_tibo.modules.exports.render import render_docx, render_pdf
from saint_tibo.modules.exports.schemas import ProtocolExport

FIXTURE = json.loads(Path(__file__).with_name("fixtures.json").read_text(encoding="utf-8"))
STAMP = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
AUDIO = {name: Path(__file__).with_name(f"speech-{name}.wav").read_bytes() for name in ("ru", "mixed", "live")}
TIMINGS = json.loads(Path(__file__).with_name("speech-timing.json").read_text(encoding="utf-8"))


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


class MockState:
    def __init__(self):
        self.meetings = copy.deepcopy(FIXTURE["meetings"])
        self.participants = copy.deepcopy(FIXTURE["participants"])
        self.recordings = copy.deepcopy(FIXTURE["recordings"])
        self.jobs = copy.deepcopy(FIXTURE["jobs"])
        self.audio_kind = {}
        self.reviews = {self.meetings[0]["id"]: copy.deepcopy(FIXTURE["review"])}
        self.reviews[self.meetings[0]["id"]]["action_items"][0]["due_date"] = (datetime.now(timezone.utc).date() + timedelta(days=4)).isoformat()
        self.polls = {}
        self.history = {}
        self.counter = 0
        self.extend_fixtures()
        self.align_review(self.reviews[self.meetings[0]["id"]], self.recordings[0]["id"])
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
        for index in (7, 8, 9, 10):
            meeting = self.meetings[index]
            recording = next(r for r in self.recordings if r["meeting_id"] == meeting["id"])
            job = next(j for j in self.jobs if j["recording_id"] == recording["id"])
            review = self.clone_review(meeting["id"], recording["id"], job["result_version_id"])
            review["reviewed"] = index in (7, 9)
            self.reviews[meeting["id"]] = review
        for meeting_id, review in self.reviews.items():
            segment_ids = [s["id"] for s in review["segments"]]
            people = [p for p in self.participants if p["meeting_id"] == meeting_id]
            for number, status in enumerate(("in_progress", "done", "cancelled")):
                review["action_items"].append({
                    "id": stable_id("action", f"{review['result_version_id']}/{number + 1}"),
                    "result_version_id": review["result_version_id"],
                    "text": ("Проверить бюджет", "Разослать протокол", "Отменить старый план")[number],
                    "assignee_participant_id": people[number % len(people)]["id"] if people else None,
                    "assignee_text": None, "due_text": None,
                    "due_date": (datetime.now(timezone.utc).date() + timedelta(days=number + 1)).isoformat(),
                    "status": status, "source_segment_ids": [segment_ids[number % len(segment_ids)]],
                })
        self.reviews[self.meetings[0]["id"]]["action_items"][1].update(assignee_participant_id=None, assignee_text="Внешний подрядчик")
        for review in self.reviews.values():
            if review["revision"] > 1:
                previous = copy.deepcopy(review)
                previous.update(revision=1, reviewed=False)
                self.history[(review["result_version_id"], 1)] = previous
                self.history[(review["result_version_id"], review["revision"])] = copy.deepcopy(review)

    def extend_fixtures(self):
        shift = datetime.now(timezone.utc).date() - datetime(2026, 9, 23, tzinfo=timezone.utc).date()
        for collection in (self.meetings, self.participants, self.recordings, self.jobs):
            for item in collection:
                for key in ("started_at", "created_at", "updated_at", "finished_at"):
                    if item.get(key):
                        item[key] = (datetime.fromisoformat(item[key].replace("Z", "+00:00")) + shift).isoformat().replace("+00:00", "Z")
        for index, recording in enumerate(self.recordings):
            kind = "mixed" if index == 0 else "live" if recording["source"] == "live" else "ru"
            self.audio_kind[recording["id"]] = kind
            if recording["media_url"]:
                recording.update(original_filename=f"synthetic-speech-{kind}.wav", size_bytes=len(AUDIO[kind]), media_size_bytes=len(AUDIO[kind]), duration_ms=TIMINGS[kind][-1][1] + 500, media_content_type="audio/wav")
        names = ["Айгүл Сәрсенова", "Марат Иванов", "Дана Қасым", "Нұрлан Әлиев", "Елена Петрова", "Арман Серік", "Ольга Ким", "Бауыржан Нұр", "Светлана Ли", "Ермек Омар", "Алия Жұма", "Ирина Смирнова", "Руслан Ахмет", "Мадина Есен", "Виктор Цой", "Сауле Бек", "Павел Орлов", "Жанар Төре"]
        roles = ["председатель", "докладчик", "исполнитель", "участник"]
        titles = ["Планирование спринта", "Итоги закупок", "Команда продукта", "Вопросы безопасности", "Обновление сайта", "Завтрашняя повестка"]
        for index, title in enumerate(titles, 6):
            meeting_id = stable_id("meeting", f"seed-{index}")
            started = (datetime.now(timezone.utc).replace(hour=7 + index % 5, minute=0, second=0, microsecond=0) + timedelta(days=(index - 8) * 2)).isoformat().replace("+00:00", "Z")
            self.meetings.append({"id": meeting_id, "owner_id": "synthetic-mock-user", "title": title, "started_at": started, "timezone": "Asia/Almaty", "created_at": STAMP, "updated_at": STAMP})
            if index == 6:
                continue
            recording_id = stable_id("recording", f"seed-{index}")
            is_ready = index in (7, 8, 9, 10)
            kind = "live" if index in (8, 10) else "ru"
            self.audio_kind[recording_id] = kind
            self.recordings.append({"id": recording_id, "meeting_id": meeting_id, "source": "live" if index in (8, 10) else "file", "original_filename": f"synthetic-{index}.wav", "content_type": "audio/wav", "status": "ready" if is_ready else "receiving", "size_bytes": len(AUDIO[kind]) if is_ready else 0, "duration_ms": TIMINGS[kind][-1][1] + 500 if is_ready else None, "media_content_type": "audio/wav" if is_ready else None, "media_size_bytes": len(AUDIO[kind]) if is_ready else None, "media_url": f"/api/media/meetings/{meeting_id}/recordings/{recording_id}" if is_ready else None, "error_code": None, "created_at": STAMP, "updated_at": STAMP})
            if is_ready:
                self.jobs.append({"id": stable_id("job", f"seed-{index}"), "recording_id": recording_id, "request_key": stable_id("request", f"seed-{index}"), "retry_of_job_id": None, "allow_incomplete": False, "language": "mixed" if index == 8 else "ru", "target_stage": "transcribe", "attempt": 1, "status": "succeeded", "stage": "complete", "progress": 1, "error_code": None, "result_version_id": stable_id("version", f"seed-{index}"), "created_at": STAMP, "updated_at": STAMP, "started_at": STAMP, "finished_at": STAMP})
        for index, meeting in enumerate(self.meetings):
            for offset in range(3):
                name = names[(index * 2 + offset) % len(names)]
                if any(p["meeting_id"] == meeting["id"] and p["display_name"] == name for p in self.participants):
                    continue
                self.participants.append({"id": stable_id("participant", f"{meeting['id']}/{name}"), "meeting_id": meeting["id"], "display_name": name, "role": roles[offset % len(roles)], "created_at": STAMP, "updated_at": STAMP})
        retry_recording = next(r for r in self.recordings if r["meeting_id"] == self.meetings[8]["id"])
        failed_job = stable_id("job", "interrupted-seed")
        self.jobs.append({"id": failed_job, "recording_id": retry_recording["id"], "request_key": stable_id("request", "interrupted-seed"), "retry_of_job_id": None, "allow_incomplete": False, "language": "mixed", "target_stage": "transcribe", "attempt": 1, "status": "interrupted", "stage": "diarize", "progress": 0.72, "error_code": "worker_interrupted", "result_version_id": None, "created_at": STAMP, "updated_at": STAMP, "started_at": STAMP, "finished_at": STAMP})
        retried = next(j for j in self.jobs if j["recording_id"] == retry_recording["id"] and j["status"] == "succeeded")
        retried.update(retry_of_job_id=failed_job, attempt=2)
        queued_recording = next(r for r in self.recordings if r["meeting_id"] == self.meetings[10]["id"])
        self.jobs.append({"id": stable_id("job", "queued-seed"), "recording_id": queued_recording["id"], "request_key": stable_id("request", "queued-seed"), "retry_of_job_id": None, "allow_incomplete": False, "language": "ru", "target_stage": "transcribe", "attempt": 1, "status": "queued", "stage": "decode", "progress": 0, "error_code": None, "result_version_id": None, "created_at": STAMP, "updated_at": STAMP, "started_at": None, "finished_at": None})

    def new_id(self, kind):
        self.counter += 1
        return stable_id(kind, self.counter)

    def align_review(self, review, recording_id):
        kind = self.audio_kind[recording_id]
        for segment, (start, end) in zip(review["segments"], TIMINGS[kind]):
            segment.update(start_ms=start, end_ms=end)
        if kind == "ru":
            review["segments"][2]["text"] = "На следующей неделе обсудим это с поставщиком."

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
            if item.get("due_date"):
                item["due_date"] = (datetime.now(timezone.utc).date() + timedelta(days=4)).isoformat()
        for entries in review["summary"].values():
            for entry in entries:
                entry["source_segment_ids"] = [
                    segment_ids[value] for value in entry["source_segment_ids"]
                ]
        self.align_review(review, recording_id)
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


# ponytail: in-memory per-user state; persist it only if demos must survive container restarts.
STATES = {}
STATE_LOCK = RLock()


class Handler(BaseHTTPRequestHandler):
    server_version = "SaintTiboSyntheticMock/1"

    @property
    def state(self):
        return STATES[self.headers["X-Mock-User"]]

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
        user = self.headers.get("X-Mock-User", "")
        if not user or len(user) > 128:
            return self.error(401, "unauthorized", "Mock proxy identity required")
        with STATE_LOCK:
            if user not in STATES:
                STATES[user] = MockState()
        parts = url.path.strip("/").split("/")
        if parts == ["api", "v1", "demo", "reset"] and self.command == "POST":
            with STATE_LOCK:
                STATES[user] = MockState()
            return self.json(200, {"reset": True})
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
                meetings = [] if query.get("scenario") == ["empty"] else self.state.meetings[::-1]
                return self.json(200, page(meetings, query))
            if method == "POST":
                body = self.body()
                if not all(body.get(key) for key in ("title", "started_at", "timezone")):
                    raise ValueError("title, started_at and timezone are required")
                meeting = {
                    "id": self.state.new_id("meeting"),
                    "owner_id": "synthetic-mock-user",
                    "title": body["title"],
                    "started_at": body["started_at"],
                    "timezone": body["timezone"],
                    "created_at": STAMP,
                    "updated_at": STAMP,
                }
                self.state.meetings.append(meeting)
                return self.json(201, meeting)
            return self.error(405, "method_not_allowed", "Unsupported method")

        meeting_id = parts[0]
        meeting = next((item for item in self.state.meetings if item["id"] == meeting_id), None)
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
                self.state.meetings.remove(meeting)
                self.state.participants[:] = [
                    p for p in self.state.participants if p["meeting_id"] != meeting_id
                ]
                self.state.recordings[:] = [r for r in self.state.recordings if r["meeting_id"] != meeting_id]
                self.state.reviews.pop(meeting_id, None)
                return self.send(204)
            return self.error(405, "method_not_allowed", "Unsupported method")
        if parts[1] == "participants":
            return self.participants_route(meeting_id, parts[2:])
        if parts[1] == "recordings":
            return self.recordings_route(meeting_id, parts[2:], query)
        return self.error(404, "not_found", "Mock endpoint not found")

    def participants_route(self, meeting_id, parts):
        items = [p for p in self.state.participants if p["meeting_id"] == meeting_id]
        if not parts:
            if self.command == "GET":
                return self.json(200, page(items, parse_qs(urlsplit(self.path).query)))
            if self.command == "POST":
                body = self.body()
                if not body.get("display_name"):
                    raise ValueError("display_name is required")
                participant = {
                    "id": self.state.new_id("participant"),
                    "meeting_id": meeting_id,
                    "display_name": body["display_name"],
                    "role": body.get("role"),
                    "created_at": STAMP,
                    "updated_at": STAMP,
                }
                self.state.participants.append(participant)
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
                self.state.participants.remove(participant)
                return self.send(204)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def recordings_route(self, meeting_id, parts, query):
        items = [r for r in self.state.recordings if r["meeting_id"] == meeting_id]
        if not parts:
            if self.command == "GET":
                return self.json(200, page(items[::-1], query))
            if self.command == "POST":
                body = self.body()
                if not all(
                    body.get(key) for key in ("source", "original_filename", "content_type")
                ):
                    raise ValueError("source, original_filename and content_type are required")
                recording_id = self.state.new_id("recording")
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
                self.state.recordings.append(recording)
                self.state.audio_kind[recording_id] = "live" if body["source"] == "live" else "ru"
                return self.json(201, recording)
            return self.error(405, "method_not_allowed", "Unsupported method")
        recording = next((r for r in items if r["id"] == parts[0]), None)
        if recording is None:
            return self.error(404, "not_found", "Recording not found")
        if len(parts) == 1:
            if self.command == "GET":
                return self.json(200, recording)
            if self.command == "DELETE":
                self.state.recordings.remove(recording)
                self.state.jobs[:] = [
                    job for job in self.state.jobs if job["recording_id"] != recording["id"]
                ]
                self.state.reviews.pop(meeting_id, None)
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
                duration_ms=TIMINGS[self.state.audio_kind[recording["id"]]][-1][1] + 500,
                media_content_type="audio/wav",
                media_size_bytes=len(AUDIO[self.state.audio_kind[recording["id"]]]),
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
                duration_ms=TIMINGS[self.state.audio_kind[recording["id"]]][-1][1] + 500,
                media_content_type="audio/wav",
                media_size_bytes=len(AUDIO[self.state.audio_kind[recording["id"]]]),
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
        jobs = [job for job in self.state.jobs if job["recording_id"] == recording["id"]]
        if not parts:
            if self.command == "GET":
                for job in jobs:
                    self.state.advance_job(meeting_id, recording, job)
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
                    "id": self.state.new_id("job"),
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
                self.state.jobs.append(job)
                self.state.polls[job["id"]] = 0
                return self.json(202, job)
        if len(parts) == 1 and self.command == "GET":
            job = next((job for job in jobs if job["id"] == parts[0]), None)
            if job is None:
                return self.error(404, "not_found", "Job not found")
            self.state.advance_job(meeting_id, recording, job)
            return self.json(200, job)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def results_route(self, meeting_id, recording, parts, query):
        review = self.state.reviews.get(meeting_id)
        jobs = [
            job
            for job in self.state.jobs
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
        if not parts and self.command == "GET":
            return self.json(200, page(versions[::-1], query))
        if not parts:
            return self.error(405, "method_not_allowed", "Unsupported method")
        version = next((item for item in versions if item["id"] == parts[0]), None)
        if version is None:
            return self.error(404, "not_found", "Result version not found")
        if len(parts) == 1 and self.command == "GET":
            return self.json(200, version)
        if len(parts) == 2 and parts[1] == "segments" and self.command == "GET":
            return self.json(200, page(review["segments"] if review else [], query))
        if len(parts) == 2 and parts[1] == "review":
            return self.review_route(meeting_id, recording, version, query)
        if len(parts) == 2 and parts[1] == "export" and self.command == "GET":
            return self.export_route(meeting_id, recording, version, query)
        return self.error(404, "not_found", "Mock endpoint not found")

    def review_route(self, meeting_id, recording, version, query):
        if meeting_id == FIXTURE["meetings"][3]["id"] and self.command == "PATCH":
            return self.error(503, "save_unavailable", "Synthetic save failure")
        review = self.state.reviews.get(meeting_id)
        if review is None or review["result_version_id"] != version["id"] or review["recording_id"] != recording["id"]:
            return self.error(404, "not_found", "Synthetic result is not ready")
        if self.command == "GET":
            revision = query.get("revision", [None])[0]
            if revision is not None:
                try:
                    revision = int(revision)
                except ValueError as exc:
                    raise ValueError("Invalid revision") from exc
                snapshot = self.state.history.get((version["id"], revision))
                if not snapshot and revision == review["revision"]:
                    snapshot = review
                if not snapshot:
                    return self.error(404, "not_found", "Revision not found")
                return self.json(200, snapshot)
            return self.json(200, review)
        if self.command == "PATCH":
            body = self.body()
            if body.get("revision") != review["revision"]:
                return self.error(409, "version_conflict", "Review revision changed")
            allowed = {"revision", "reviewed", "summary", "speakers", "segments", "action_items"}
            if any(key not in allowed for key in body):
                raise ValueError("Unknown review field")
            candidate = copy.deepcopy(review)
            candidate.update({key: value for key, value in body.items() if key != "revision"})
            segment_ids = {item["id"] for item in candidate["segments"]}
            speaker_ids = {item["id"] for item in candidate["speakers"]}
            participant_ids = {item["id"] for item in self.state.participants if item["meeting_id"] == meeting_id}
            if segment_ids != {item["id"] for item in review["segments"]} or len(segment_ids) != len(candidate["segments"]):
                raise ValueError("Segment IDs cannot change")
            if any(item["result_version_id"] != version["id"] or item["recording_id"] != recording["id"] or item["speaker_id"] is not None and item["speaker_id"] not in speaker_ids or not item["text"].strip() for item in candidate["segments"]):
                raise ValueError("Invalid transcript segment")
            if len(speaker_ids) != len(candidate["speakers"]) or any(item["result_version_id"] != version["id"] or (item["participant_id"] is not None and item["participant_id"] not in participant_ids) for item in candidate["speakers"]):
                raise ValueError("Invalid speaker")
            actions = candidate["action_items"]
            if len({item["id"] for item in actions}) != len(actions) or any(item["result_version_id"] != version["id"] or not item["text"].strip() or item["assignee_participant_id"] is not None and item["assignee_participant_id"] not in participant_ids or not set(item["source_segment_ids"]) <= segment_ids for item in actions):
                raise ValueError("Invalid action item")
            if any(not set(entry["source_segment_ids"]) <= segment_ids for entries in candidate["summary"].values() for entry in entries):
                raise ValueError("Invalid summary source")
            self.state.history[(version["id"], review["revision"])] = copy.deepcopy(review)
            review.update(candidate)
            review["revision"] += 1
            self.state.history[(version["id"], review["revision"])] = copy.deepcopy(review)
            return self.json(200, review)
        return self.error(405, "method_not_allowed", "Unsupported method")

    def export_route(self, meeting_id, recording, version, query):
        if meeting_id == FIXTURE["meetings"][5]["id"]:
            return self.error(503, "export_unavailable", "Synthetic export failure")
        review = self.state.reviews.get(meeting_id)
        if review is None or review["result_version_id"] != version["id"] or review["recording_id"] != recording["id"] or not review["reviewed"]:
            return self.error(409, "review_required", "Review the result before export")
        revision = int(query.get("revision", [review["revision"]])[0])
        snapshot = review if revision == review["revision"] else self.state.history.get((version["id"], revision))
        if not snapshot:
            return self.error(404, "not_found", "Revision not found")
        if not snapshot["reviewed"]:
            return self.error(409, "review_required", "Review the selected revision before export")
        payload = ProtocolExport.model_validate({
            "result_version_id": version["id"], "revision": revision,
            "is_incomplete": recording["status"] == "incomplete", "meeting": next(m for m in self.state.meetings if m["id"] == meeting_id),
            "participants": [p for p in self.state.participants if p["meeting_id"] == meeting_id],
            "speakers": snapshot["speakers"], "segments": snapshot["segments"],
            "action_items": snapshot["action_items"],
            "summary": {key: [item["text"] for item in entries] for key, entries in snapshot["summary"].items()},
        })
        format_name = query.get("format", [""])[0]
        if format_name == "pdf":
            return self.send(
                200,
                render_pdf(payload),
                "application/pdf",
                {"Content-Disposition": 'attachment; filename="synthetic-protocol.pdf"'},
            )
        if format_name == "docx":
            return self.send(
                200,
                render_docx(payload),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                {"Content-Disposition": 'attachment; filename="synthetic-protocol.docx"'},
            )
        raise ValueError("format must be pdf or docx")

    def media_route(self, recording):
        if not recording["media_url"]:
            return self.error(404, "media_unavailable", "Synthetic audio is unavailable")
        audio = AUDIO[self.state.audio_kind[recording["id"]]]
        range_header = self.headers.get("Range")
        if range_header:
            try:
                unit, value = range_header.split("=", 1)
                start_text, end_text = value.split("-", 1)
                if unit != "bytes" or "," in value:
                    raise ValueError
                if not start_text:
                    suffix = int(end_text)
                    if suffix <= 0:
                        raise ValueError
                    start, end = max(0, len(audio) - suffix), len(audio) - 1
                else:
                    start = int(start_text)
                    end = min(int(end_text), len(audio) - 1) if end_text else len(audio) - 1
                if start < 0 or start > end or start >= len(audio):
                    raise ValueError
            except ValueError:
                return self.send(
                    416, extra={"Content-Range": f"bytes */{len(audio)}", "Accept-Ranges": "bytes"}
                )
            return self.send(
                206,
                audio[start : end + 1],
                "audio/wav",
                {"Accept-Ranges": "bytes", "Content-Range": f"bytes {start}-{end}/{len(audio)}"},
            )
        return self.send(200, audio, "audio/wav", {"Accept-Ranges": "bytes"})


if __name__ == "__main__":
    if os.environ.get("MOCK_API_DEV_ONLY") != "1":
        raise SystemExit("MOCK_API_DEV_ONLY=1 is required")
    host = os.environ.get("MOCK_API_HOST", "127.0.0.1")
    port = int(os.environ.get("MOCK_API_PORT", "8015"))
    print(f"Synthetic mock API on {host}:{port}; no database or recordings are read", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
