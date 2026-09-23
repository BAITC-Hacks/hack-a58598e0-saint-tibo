# API-02 Meetings and recordings

## Current Behavior

- Implemented in `backend/src/saint_tibo/modules/meetings/` and migration
  `0002_meetings`; included in main `62b137d` via PR #80.
- `/api/v1/meetings`: CRUD; nested participants list/create/update/delete;
  nested recordings list/create/get/delete. IDs, ownership and UTC timestamps
  come from the server; meeting start and IANA timezone are required.
- Under `/meetings/{meeting_id}/recordings/{recording_id}`:
  `PUT /file` streams raw bytes (default limit 512 MiB, source=file);
  `PUT /chunks/{sequence}` accepts bounded live chunks (8 MiB, max 4096)
  with recording-relative integer start/end milliseconds and resend checks;
  `POST /finalize` resolves completeness and playable media.
- `storage.py` selects the audio stream explicitly (MP3 cover art is safe)
  and produces canonical 16 kHz mono PCM WAV while preserving the timeline.
  Incomplete recordings remain distinguishable from complete ones.
- `GET/HEAD /media` enforces owner access and Range/If-Range, with
  206/416 semantics. Deletion removes stored files and cascades jobs/results.
- Browser playback uses cookie route
  `/api/media/meetings/{meetingId}/recordings/{recordingId}`;
  `frontend/src/app/server/media.server.ts` gets a JWT and calls FastAPI.
  `BACKEND_INTERNAL_URL` is server-only; Compose uses `http://backend:8000`.
- Contracts and operations: `contracts/openapi.json`,
  `docs/recording-storage.md`, `docs/media-proxy.md`.

## Known Gaps

- Storage/API proof is separate from player and browser capture acceptance.
  Follow WEB-19, WEB-21 and current #19/#21 comments.
- Trusted service capture sessions and authenticated adapter sink (#81)
  are not implemented by this owner JWT upload API.
- Speaker remains unimplemented; action items now persist in bounded JSONB
  review snapshots (API-13), not a separate table. Jobs/transcripts: API-10.
- Storage/STT functional proof is the [#94 LIVE-OK report](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510)
  on `58ee537`; later review/export LIVE-OK 97e804e is recorded in API-13.

Last commit: `ab3d3312c3bafb3892bde93539383cea9e48b6de` (audited tree, 2026-09-23; live evidence is separate).
