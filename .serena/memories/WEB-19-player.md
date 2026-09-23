# WEB-19 Local recording player

## Current Behavior

- `frontend/src/shared/ui/meeting-player/` exports MeetingPlayer,
  MediaSource (`id,url,title`) and handle `seek(timeMs)/pause()`.
  Position/duration callbacks use integer milliseconds and source ID.
- Controls cover loading/buffering/error/end, speed, volume, seeking and
  source cleanup. A new source creates its own playback session.
- Protected `frontend/src/pages/player/ui/player-page.tsx` uses local
  browser files; it does not upload, call meeting APIs or transcribe.
- Optional local STT JSON is validated by
  `frontend/src/pages/player/lib/local-transcript.ts`: required
  `audio_sha256` plus segments with `index,start_ms,end_ms,text`.
  Hash must match selected audio; time intervals/text are validated.
  Limits: 8 MiB JSON, 256 MiB audio hash input, 10k segments.
- Local segments use WEB-20 synchronization and are bound to the chosen
  audio bytes. Do not replace this format with a bare segment array.
- [#19 integration evidence](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/19#issuecomment-5793184594)
  and [#20 local STT proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/20#issuecomment-5793184614)
  describe local playback/seek on Ivan dev; no complete server flow is claimed.

## Known Gaps

- Existing cookie media proxy/API supports protected media, but this audited
  player page is not connected to it or server result pagination.
- #19/#20 stay open for real stored recordings, Range/access/error scenarios
  and server result/action-source integration.
- #95 rich player is separate Ivan-owned branch work; its
  [claim](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/95#issuecomment-5793340879)
  does not establish integration or live readiness. Artem owns global
  routes/navigation and meeting workspace.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
