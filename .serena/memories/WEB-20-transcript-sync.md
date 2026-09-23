# WEB-20 Transcript synchronization

## Current Behavior

- `frontend/src/shared/ui/transcript-sync/` exports useTranscriptSync,
  TranscriptPanel, TranscriptSegment, TranscriptSync and transcriptTime.
- Source ID is recording ID; playback positions and intervals use integer
  milliseconds. Consume a single recording/result version at a time.
- Segment/source click seeks without changing play/pause. Gaps clear
  highlight; latest-start segment wins overlap; invalid/foreign intervals
  are excluded. Repeated reveal requests carry a sequence number.
- Follow toggle respects wheel/touch/keyboard/native scrolling; automatic
  scrolling preserves keyboard focus.
- Parent keys hook owner by `recordingId:resultVersionId`; load the full
  selected version's segment list before using this client hook.
- `/transcript-demo` is explicitly public and synthetic: generated
  32-second WAV/eight markers, no meeting API or private uploaded data.
  The local player can also provide validated STT JSON (WEB-19).
- Integration details: `docs/transcript-sync.md`; implementation `16cd152`.
  Historical browser evidence is recorded in the doc and
  [#20](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/20#issuecomment-5793184614).
  This synchronization audit did not rerun those browser checks.

## Known Gaps

- No automatic paginated result fetch is implemented inside the hook.
- Real authorized server results/media and editor/action-source integration
  remain #19/#20 and Artem's UI work, not proven by a synthetic demo.
- #12 speaker identity and #13 reviewed source data remain backend
  dependencies; don't treat local demo fields as persisted product data.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
