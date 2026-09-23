# API-02 Meetings & recordings slice (#8/#9)

Contract draft: `docs/meeting-contract.md` (#8). Only operations present
in `contracts/openapi.json` are real — the doc describes intent.

## Entities (contract)

Meeting(id, owner_id, title, started_at, timezone[IANA, required]) ·
Participant(id, meeting_id, display_name, role?) ·
Recording(id, meeting_id, source, status, timeline) ·
ProcessingJob(id, recording_id) · ResultVersion(id, recording_id, job_id) ·
Speaker(id, result_version_id, participant_id nullable) ·
Segment(id, result_version_id, recording_id, start_ms, end_ms, speaker_id?) ·
ActionItem(id, result_version_id, source segments).
Timeline = integer ms from THAT recording start; `started_at`+`timezone`
required or relative deadlines stay unnormalized. Names/labels are never IDs.

## Implemented — `codex/9-meeting-storage` @ e9a9f75

Status 2026-09-23: code done, deployed on `saint-dev-danil`,
NOT yet merged into `danil`/`dev`/`main`. Files:
`backend/src/saint_tibo/modules/meetings/*`, `api/router.py`,
`auth/policy.py`, `core/config.py`, migration `0002_meetings`.

Endpoints `/api/v1`: meetings CRUD; participants CRUD;
`PUT /meetings/{m}/recordings/{r}` raw stream (≤512 MiB, source=file);
`PUT …/chunks/{seq}` live chunks (≤8 MiB, ≤4096, idempotent resend);
`POST …/finalize` (marks incomplete if chunks missing);
`GET/HEAD …/media` Range/If-Range → 206/416, serves normalized `audio/wav`;
`DELETE` recording cascades stored files. Decode picks audio stream
explicitly (MP3 cover art safe); normalization keeps timeline.
Owner-only access; foreign id → 404.

## Media proxy — `codex/9-media-proxy` @ b538b1e (also pending merge)

Same-origin `GET/HEAD /api/media/meetings/{m}/recordings/{r}` in
frontend: Better Auth cookie → server-minted JWT → backend `/media`.
Needed because HTMLMediaElement can't set Authorization headers.
New env: `BACKEND_INTERNAL_URL` (`frontend/scripts/setup.ts` seeds it;
Compose passes `http://backend:8000`).

## Known gaps / next

ProcessingJob/ResultVersion/Speaker/Segment/ActionItem are contract-only —
#10 builds jobs on top of this slice. Recording.status is a string
(`receiving`/…) — UI must treat unknown status as unsupported, not "done".
