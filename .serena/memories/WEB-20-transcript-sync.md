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
- Integration details: `docs/transcript-sync.md`; implementation `16cd152`.
  Historical browser evidence is recorded in the doc and
  [#20](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/20#issuecomment-5793184614).
  This synchronization audit did not rerun those browser checks.

## Known Gaps

- The sync hook remains a UI primitive; pagination lives in the player page.
- Server action-source navigation and editor integration remain #20 and Artem's
  UI work. No action items or speakers are inferred from transcript text.
- #12 speaker identity and #13 reviewed source data remain backend
  dependencies; don't treat local demo fields as persisted product data.
- Branch `ivan/20-real-transcript` was built and deployed on `dev-ivan` as
  `cc131fd`. Browser `/player` showed the protected selector and preserved #98
  sample. The dev user had no playable server recordings, and the worker's
  `/models` directory was empty, so a completed server result and its seek/follow
  behavior were not verified there. Keep #20 open and do not label it LIVE-OK.

Updated 2026-09-23 from the `ivan/20-real-transcript` worktree.
