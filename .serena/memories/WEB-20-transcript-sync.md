# WEB-20 — transcript synchronization

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
- `/transcript-demo` uses generated 32-second WAV and eight synthetic markers,
  no user files, no meeting API, all strings ru/kk/en. Public synthetic-only route.
- `docs/transcript-sync.md` contains integration contract and local run commands.

## Proof

- typecheck, check (format + typed lint), lint:fsd, i18n:check, build passed.
- i18n: all 92 messages in ru/kk/en; no new dependencies.
- Browser on production build at loopback port 3020: 0/4/8/24 s seeks,
  paused/playing preservation, rate 2x, 3.2 s gap, wheel/keyboard interruption,
  repeated source jump, unavailable source, locale changes, follow to end.
- Console warnings/errors empty. Build requires synthetic auth process settings;
  no real DB or backend needed for this public fixture.

## Known Gaps

- Editor integration and agreement with Artyom remain pending (#12/#13).
- Real authorized results/media integration not verified; #20 stays open.
- Full current-version segment list is required; no paginated fetching here.
- No push, shared-branch merge or deploy authorized/performed.
