# WEB-19 Protected and local recording player

## Current Behavior

- Integrated dev `a2cfe28` includes protected selector `c55d1a9` and rich
  timeline `c026616`; source: `frontend/src/pages/player/`,
  `frontend/src/shared/ui/meeting-player/`, `docs/player.md`.
- Protected `/player` queries generated listMeetings/listRecordings,
  filters records with media URL/type and passes server `media_url` to
  MeetingPlayer. Cookie media proxy handles auth/Range; no second login.
- MeetingPlayer accepts MediaSource (`id,url,title`), optional waveform
  and TimelineMarker list, integer-ms position/duration callback and
  `seek(timeMs)/pause()` handle. New id/URL replaces playback session.
- Controls: play/pause, ±10s, position, speed, volume, loading/buffering/
  error/end; seeking preserves play state and is bounded by media duration.
- Local audio/video remains in the browser and is not uploaded/transcribed.
  `lib/audio-waveform.ts` samples decoded local audio into 180 peaks
  only for files <=32 MiB; unsupported/large files show no fake waveform.
  Server media is not downloaded in full for visualization.
- Local STT JSON uses `lib/local-transcript.ts`: required `audio_sha256`
  and segment `index,start_ms,end_ms,text`; hash must match selected audio.
  Limits: 8 MiB JSON, 256 MiB audio for hashing, 10k segments.
- Up to eight local transcript markers derive from actual segment timestamps;
  WEB-20 handles click-to-seek and follow. Switching sources clears local data.
- Dev `34062c4` adds #98 browser-generated 32s WAV/eight tone intervals,
  fictional speakers/dialogue and a source jump at 0:08. RU/KK/EN labels
  explicitly say tones are not speech/transcription and nothing is uploaded.
  Code: `lib/synthetic-recording.ts`; documentation: `docs/player.md`.

## Known Gaps

- Server selector loads first 100 meetings and first 100 recordings per meeting;
  it does not exhaust pagination or fetch server result versions/segments.
- [#95 deploy report](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/95#issuecomment-5793559235)
  reports Ivan dev at a2cfe28 with readiness/player HTTP 200. Interactive
  waveform/marker seek, protected selector/playback and browser logs were
  explicitly not verified in that run; #19/#20/#95 remain open.
- Earlier local playback/STT proof cannot establish the new selector's
  acceptance. Current Danil LIVE-OK58ee537 predates this feature.
- The #98 synthetic walkthrough is integrated; its browser acceptance is
  pending. Fictional text/tone synchronization proves no STT or diarization.
- Ivan owns player code; Artem owns global navigation/meeting workspace.
  Full server result/action-source/editor integration is still separate.

Last commit: `34062c4726f8ca5647b3159ac3b26e92023aee57` (audited origin/dev, 2026-09-23; not a live assertion).
