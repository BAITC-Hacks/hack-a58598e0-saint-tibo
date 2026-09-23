# WEB — local capture #21

## Current Behavior
- `frontend/src/shared/lib/audio-capture.ts`: microphone/shared audio/both,
  one MediaRecorder, per-source meters, bounded immutable chunks, final Blob.
- `frontend/src/shared/ui/meeting-capture/index.tsx`: localized capture UI,
  explicit disconnected transport, local playback/download and URL cleanup.
- `frontend/src/pages/capture/`, `frontend/src/app/routes/_app.capture.tsx`:
  `/capture` under existing auth; no AppShell or `/player` edits.
- 35 `capture_*` keys in `frontend/messages/{ru,kk,en}.json`.
- Limits: 64 MiB, 4096 chunks, 30 minutes; reserve final-event headroom.
- `uploadCapture`: sequential callback adapter, identical retry (3 attempts),
  permanent HTTP errors fail, AbortSignal; finalize only after all acks.
- Docs: `docs/capture.md`; canonical backend design `docs/meeting-contract.md`.
- Typecheck/check/i18n/build pass; 7 existing tests pass.
- Synthetic Chrome confirms MediaRecorder/playback, both tones in mix,
  permission/no-audio/source-loss/late-grant cleanup/silence, retry/abort,
  oversized-event continuous prefix. Fixtures not committed.

## Known Gaps

- No HTTP SDK transport, no live upload, no server recording_id or STT.
- No persistence across route/unmount/reload; local result must be downloaded.
- Actual OS/browser picker and #9 integration still need manual/live proof.
- #21 stays OPEN. No push, merge or deployment authorized in this task.
- Integrate `MeetingCapture` into owner's screen; bind generated #9 SDK to
  one persisted recording_id, then pass server media_url to #19 MeetingPlayer.
- Parent coordinates deployment. Do not touch another worktree or dev server.
