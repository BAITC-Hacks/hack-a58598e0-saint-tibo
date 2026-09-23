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
  `target_stage=transcribe` means transcript ready. Canonical UI polls every 3s
  while active; older contract guidance says 2s.
- Worker supervises the separate local STT process (MODELS-01); complete
  output atomically publishes one ResultVersion plus segments and job link.
  Empty/malformed/oversized output fails; no partial successful version.
- Canonical duration is ceil(frames*1000/sample_rate), checked by exact equality;
  persisted model_id/revision now comes from the verified small/turbo bundle.
- Read-back: `GET /results`, `GET /results/{result_version_id}`,
  `GET /results/{result_version_id}/segments`. All are owner-scoped;
  foreign meeting/recording/job/version gives 404. Segments are paginated.
- New processing creates a new version, initially `status=draft`,
  `revision=1`, `completed_stage=transcribe`. Manual review increments revision
  and may set status=reviewed, retaining completed_stage=transcribe (API-13).
  Each segment has UUID, recording/version IDs, integer `start_ms/end_ms`
  and text; `speaker_id=null` in core 6ed682e. Shared #12 is not deployed yet.
- See `docs/processing-jobs.md`, `docs/transcription.md`, generated OpenAPI.

## Known Gaps

- Diarization and extraction are separate work. Manual review now extends
  existing ResultVersion with immutable ResultReview snapshots (API-13).
- Alternate audio-track selection and the full multi-stage pipeline remain open.
- [#10 live evidence](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/10#issuecomment-5793355837):
  a fresh job succeeded; controlled restart produced interrupted/no result.
  Retry acceptance/idempotency passed, but completion of that retry was not
  proven after a temporary QA logger failed. Do not combine those claims.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
