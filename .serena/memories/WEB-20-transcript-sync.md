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
- `/transcript-demo` is explicitly public and synthetic: generated
  32-second WAV/eight markers, no meeting API or private uploaded data.
  The local player can also provide validated STT JSON (WEB-19).
- Integrated #98 adds a separate `/player` synthetic walkthrough with
  generated tones and explicitly fictional dialogue; this is not STT output.
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

Last commit: `ab3d3312c3bafb3892bde93539383cea9e48b6de` (audited tree, 2026-09-23; live evidence is separate).
