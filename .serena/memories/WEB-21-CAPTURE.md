# WEB — local capture #21

## Current Behavior
- `frontend/src/shared/lib/audio-capture.ts`: microphone/shared audio/both,
  one MediaRecorder, per-source meters, bounded immutable chunks, final Blob.
- `frontend/src/shared/ui/meeting-capture/index.tsx`: localized capture UI,
  local playback/download and URL cleanup.
- `frontend/src/pages/capture/`, `frontend/src/app/routes/_app.capture.tsx`:
  `/capture` under existing auth; no AppShell or `/player` edits.
- `capture_*` strings exist in all `frontend/messages/{ru,kk,en}.json`.
- Limits: 64 MiB, 4096 chunks, 30 minutes; reserve final-event headroom.
- `uploadCapture`: sequential callback adapter, identical retry (3 attempts),
  permanent HTTP errors fail, AbortSignal; finalize only after all acks.
- `frontend/src/shared/api/capture-upload.ts` binds the UI to the real
  generated SDK: `createMeeting` → `createRecording(source=live)` →
  `uploadRecordingChunk` per chunk → `finalizeRecording`; owner JWT via
  `backend-client`.
- Docs: `docs/capture.md`; canonical backend design `docs/meeting-contract.md`.
- Typecheck/check/i18n/build pass; 7 existing tests pass.
- Synthetic Chrome confirms MediaRecorder/playback, both tones in mix,
  permission/no-audio/source-loss/late-grant cleanup/silence, retry/abort,
  oversized-event continuous prefix. Fixtures not committed.

## Known Gaps

- SDK transport is wired but no live end-to-end upload has been proven on
  a dev server; OS/browser picker still needs manual proof.
- No persistence across route/unmount/reload; local result must be downloaded.
- #21 closes only with live upload proof; then pass server media_url to
  #19 MeetingPlayer.
