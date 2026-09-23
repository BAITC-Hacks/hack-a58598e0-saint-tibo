# WEB-21 Browser audio capture

## Current Behavior

- `frontend/src/shared/lib/audio-capture.ts` supports microphone,
  shared audio or both using one MediaRecorder, per-source meters,
  immutable chunks and final Blob.
- `shared/ui/meeting-capture/index.tsx` supplies localized capture,
  local playback/download and URL cleanup; protected route is `/capture`.
- Limits: 64 MiB total, 8 MiB per chunk, 4096 chunks, 30 minutes;
  reserve headroom for final event. Capture does not survive reload/unmount.
- `uploadCapture` sequentially sends chunks; retries identical requests
  up to three attempts, fails permanent HTTP errors, accepts AbortSignal
  and finalizes only after all acknowledged chunks.
- `frontend/src/shared/api/capture-upload.ts` is already real SDK wiring:
  createMeeting → createRecording(source=live) → uploadRecordingChunk →
  finalizeRecording, using owner JWT from backendClient.
- `createCaptureTarget` and `saveCapture` keep capture and transport
  separate. A wired SDK adapter is not evidence of an end-to-end live upload.
- #106 stores immutable started_at/timezone at MediaRecorder start and carries
  them in CaptureResult/createMeeting. Later saves/retries no longer use save time.
- Docs: `docs/capture.md`, `docs/meeting-contract.md`.
  Implementation `a35e16e`, real transport `abae259`; historical synthetic
  checks are documented, not rerun in this memory synchronization.

## Known Gaps

- OS/browser picker permission, real upload and protected playback need
  current live acceptance; #21/#106 remain open. [#106 integration](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/106#issuecomment-5794071073)
  is code/build proof, not completed OS/browser capture-to-save acceptance.
- Route loss/reload requires downloading local output if it has not been
  saved; there is no durable browser recovery.
- External meeting bot AudioSink/service authentication is #81 and INFRA-22,
  not the browser's existing owner-authenticated upload adapter.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
