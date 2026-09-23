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
`PUT /meetings/{m}/recordings/{r}` raw stream (≤512 MiB, source=file);
`PUT …/chunks/{seq}` live chunks (≤8 MiB, ≤4096, idempotent resend);
`POST …/finalize` (marks incomplete if chunks missing);
`GET/HEAD …/media` Range/If-Range → 206/416, serves normalized `audio/wav`;
`DELETE` recording cascades stored files. Decode picks audio stream
explicitly (MP3 cover art safe); normalization keeps timeline.
Owner-only access; foreign id → 404.

## Media proxy — also IN `main`

Same-origin `GET/HEAD /api/media/meetings/{m}/recordings/{r}` in
frontend: Better Auth cookie → server-minted JWT → backend `/media`.
Needed because HTMLMediaElement can't set Authorization headers.
Env: `BACKEND_INTERNAL_URL` (`frontend/scripts/setup.ts` seeds it;
Compose passes `http://backend:8000`; `.env.example` documents it).

## Known gaps / next

ProcessingJob/ResultVersion/Speaker/Segment/ActionItem are contract-only —
#10 builds jobs on top of this slice. Recording.status is a string
(`receiving`/…) — UI must treat unknown status as unsupported, not "done".
`modules/exports/` renders the reviewed protocol to DOCX+PDF from a
contract-shaped payload (vendored DejaVu fonts, RU/KK safe); its HTTP
endpoint and ACL arrive once #13 persists result versions.
