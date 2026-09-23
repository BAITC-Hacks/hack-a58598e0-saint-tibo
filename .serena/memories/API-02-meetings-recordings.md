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

## Implemented — on `main` (PR #80, 62b137d)

All endpoints live in `contracts/openapi.json`. Files:
`backend/src/saint_tibo/modules/meetings/*`, `api/router.py`,
`auth/policy.py`, `core/config.py`, migration `0002_meetings`.
Prod deploys manually from `main` only — see INFRA-01.

Endpoints `/api/v1`: meetings CRUD; participants CRUD;
`PUT …/recordings/{r}/file` raw stream (≤512 MiB, source=file);
`PUT …/chunks/{sequence}` live chunks (≤8 MiB, ≤4096, idempotent resend);
`POST …/finalize` (marks incomplete if chunks missing);
`GET/HEAD …/media` Range/If-Range → 206/416, serves normalized `audio/wav`;
`DELETE` recording cascades stored files and its jobs. Decode picks audio stream
explicitly (MP3 cover art safe); normalization keeps timeline.
Owner-only access; foreign id → 404.

## Media proxy — also IN `main`

Same-origin `GET/HEAD /api/media/meetings/{m}/recordings/{r}` in
frontend: Better Auth cookie → server-minted JWT → backend `/media`.
Needed because HTMLMediaElement can't set Authorization headers.
Env: `BACKEND_INTERNAL_URL` (`frontend/scripts/setup.ts` seeds it;
Compose passes `http://backend:8000`; `.env.example` documents it).

## Processing jobs (#10) — on `dev`, not yet `main`

`modules/processing/` + migration `0003_processing_jobs` +
`docs/processing-jobs.md`. `POST …/recordings/{r}/jobs` → 202,
`GET` page, `GET /{job_id}` — same owner rules. Client `request_key`
makes retries idempotent (same key+params → same job; changed params →
409 `idempotency_conflict`; other key while active → 409
`processing_in_progress`); `retry_of_job_id` only on failed/interrupted.
Only `ready` or playable `incomplete`+`allow_incomplete` recordings enter.

Queue = Postgres `FOR UPDATE SKIP LOCKED`; separate `processing-worker`
compose service claims jobs (lease ~60 s, heartbeat ~20 s, attempt cap
2 h, no auto-retry; lease loss/SIGTERM → `interrupted`). Logs IDs/stage/
error_code only. Polling client: 2 s while queued/running.

Boundary: STT is NOT connected — a valid job reaches `transcribe` then
`failed / transcription_unavailable`; `result_version_id` stays null,
`succeeded` is never published. Real STT + ResultVersion land in #11.

## Known gaps / next

ResultVersion/Speaker/Segment/ActionItem are contract-only —
they arrive with #11–#13. Recording.status is a string
(`receiving`/…) — UI must treat unknown status as unsupported, not "done".
`modules/exports/` renders the reviewed protocol to DOCX+PDF from a
contract-shaped payload (vendored DejaVu fonts, RU/KK safe); its HTTP
endpoint and ACL arrive once #13 persists result versions.
