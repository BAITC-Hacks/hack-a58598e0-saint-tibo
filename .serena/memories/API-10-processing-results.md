# API-10 Processing jobs and transcript results

## Current Behavior

- Code: `modules/processing/`, `modules/results/` under
  `backend/src/saint_tibo/`; migrations `0003` and `0004`.
  Implementation `bcc02e5` (jobs), `b7d7a52` (local transcription).
- Resource prefix:
  `/api/v1/meetings/{meeting_id}/recordings/{recording_id}`.
  `POST /jobs` → 202; `GET /jobs` and `GET /jobs/{job_id}` poll state.
- Input: UUID `request_key`, `language=auto|ru|kk|mixed`,
  `target_stage=transcribe`, `allow_incomplete`, optional `retry_of_job_id`.
  Ready recordings or explicitly accepted playable incomplete ones may run.
- Same request key+parameters returns the same job; different parameters
  give 409 `idempotency_conflict`; another active job gives
  409 `processing_in_progress`. Explicit retry creates a new job only from
  failed/interrupted state. There is no automatic retry.
- Postgres queue uses `FOR UPDATE SKIP LOCKED`; separate Compose worker.
  Default lease 60s, heartbeat at lease/3, attempt timeout 2h.
  Lost lease/SIGTERM cannot publish success; logs contain IDs/stage/error codes.
- States: queued/running/succeeded/failed/interrupted. A successful
  `target_stage=transcribe` means transcript ready. Polling guidance: 2s.
- Worker supervises the separate local STT process (MODELS-01); complete
  output atomically publishes one ResultVersion plus segments and job link.
  Empty/malformed/oversized output fails; no partial successful version.
- Read-back: `GET /results`, `GET /results/{result_version_id}`,
  `GET /results/{result_version_id}/segments`. All are owner-scoped;
  foreign meeting/recording/job/version gives 404. Segments are paginated.
- New processing creates a new version. Current stored versions have
  `status=draft`, `revision=1`, `completed_stage=transcribe`.
  Each segment has UUID, recording/version IDs, integer `start_ms/end_ms`
  and text; `speaker_id=null` until #12.
- See `docs/processing-jobs.md`, `docs/transcription.md`, generated OpenAPI.

## Known Gaps

- Diarization, extraction and manually reviewed results are separate work.
  #13 must extend existing ResultVersion/Segment, not duplicate them.
- Alternate audio-track selection and the full multi-stage pipeline remain open.
- [#10 live evidence](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/10#issuecomment-5793355837):
  a fresh job succeeded; controlled restart produced interrupted/no result.
  Retry acceptance/idempotency passed, but completion of that retry was not
  proven after a temporary QA logger failed. Do not combine those claims.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
