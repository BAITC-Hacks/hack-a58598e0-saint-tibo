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
- `/player` now requests the latest completed result version for the selected
  protected recording via generated `listResultVersions`, then fetches every
  `SegmentRead` page via `listTranscriptSegments` before rendering the panel.
  Query keys include meeting/recording/version; source switching clears stale
  text. Server markers and the transcript use those same segments. No result,
  empty result, loading and errors are distinct states.
- #110 removes synthetic tones, local import and the public demo route. `/player` uses protected server recordings only.
- Canonical meeting-workspace ReviewPanel now also uses this hook; action-source
  clicks seek the same recording and reveal the source transcript segment.
- Integration details: `docs/transcript-sync.md`; implementation `16cd152`.
  Historical browser evidence is recorded in the doc and
  [#20](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/20#issuecomment-5793184614).
  This synchronization audit did not rerun those browser checks.

## Known Gaps

- The sync hook remains a UI primitive; pagination lives in the player page.
- No action items/speakers are inferred from text. Manual reviewed source data
  is persisted. #12 backend is in newer dev, but absent deployed/pinned core 6ed682e.
- Branch `ivan/20-real-transcript` was built and deployed on `dev-ivan` as
  `cc131fd`. Browser `/player` showed the protected selector and preserved #98
  sample. The dev user had no playable server recordings, and the worker's
  `/models` directory was empty, so a completed server result and its seek/follow
  behavior were not verified there. This is historical Ivan proof scope.
- [Canonical browser receipt 6ed682e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794265640)
  confirms real case2/54 segments, seek 44.9→play 52.1 and persisted review.
  This supersedes the earlier no-recordings limitation for that bounded flow.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
