# WEB-20 — transcript synchronization

Last commit: ef58368 (MP3 selector), e973681 (updated guide).

## Current Behavior

- `frontend/src/shared/ui/transcript-sync` exports `useTranscriptSync`,
  `TranscriptPanel`, `TranscriptSegment`, `TranscriptSync`, `transcriptTime`.
- Consume current recording/version segments from docs/meeting-contract.md.
- Player source ID equals recording ID; onPositionChange is in milliseconds.
- Segment click/source reference seeks without play; gaps clear highlight.
- Latest-start segment wins overlaps. Foreign/invalid intervals are excluded.
- Follow toggle + wheel/touch/keyboard/native scrolling; automatic scroll keeps focus.
- Explicit reveal requests carry a sequence to support repeated source jumps.
- Parent mounts the hook owner with key recordingId:resultVersionId.
- `/transcript-demo` offers generated 32-second WAV with eight synthetic markers
  and two owner-approved MP3 already tracked under `input-audio/`.
  Selecting MP3 hides the synthetic transcript/sources; no timed real segments
  exist yet. Source switch stops the old audio. No user uploads or meeting API.
- Vite bundles only the two published MP3 into client assets; no new media is
  tracked by this branch. All new strings are ru/kk/en.
- `docs/transcript-sync.md` contains integration contract and local run commands.

## Proof

- typecheck, check (format + typed lint), lint:fsd, i18n:check, build passed.
- i18n: all 97 messages in ru/kk/en; no new dependencies.
- Browser on production build at loopback port 3020: 0/4/8/24 s seeks,
  paused/playing preservation, rate 2x, 3.2 s gap, wheel/keyboard interruption,
  repeated source jump, unavailable source, locale changes, follow to end.
- Console warnings/errors empty. Build requires synthetic auth process settings;
  no real DB or backend needed for this public fixture.
- Published MP3 browser proof: metadata 274.25 s and 206.03125 s; meeting 1
  played, switching to meeting 2 stopped it and left meeting 2 paused at 0.
  Returning to synthetic mode restored transcript. RU/KK/EN selector checked.

## Known Gaps

- Editor integration and agreement with Artyom remain pending (#12/#13).
- Real MP3s are playable, but authorized meeting result/media API integration
  and timed segments are not verified; #20 stays open.
- Full current-version segment list is required; no paginated fetching here.
- No push, shared-branch merge or deploy authorized/performed.
