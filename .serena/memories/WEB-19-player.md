# WEB-19 Protected recording player

## Current Behavior

- `frontend/src/pages/player/` now uses only owner-authorized recordings;
  #110 removed local import/synthetic samples and public /transcript-demo.
  The previous sample/JSON hash workflow is historical, not current product UI.
- Generated listMeetings/listRecordings supply media_url; cookie media proxy
  handles Range/auth. No separate token or uploaded fixture is embedded.
- MeetingPlayer accepts source id/url/title, integer-ms position/duration,
  seek/pause handle, optional waveform and real transcript markers.
  Source replacement unloads old playback; seeking preserves play/pause.
- Page selects latest completed server result and loads every segment page
  (WEB-20). Markers, transcript and playback share recording/version IDs.
  Missing/loading/error/empty result states stay distinct.
- A waveform fetch is allowed only when declared server media size <=32 MiB;
  same-origin cookie fetch checks actual Blob size, then local Web Audio decodes.
  Oversized/unsupported audio has no fabricated waveform.
- Controls include play/pause, ±10s, position, rate, volume and loading/error.
  Marker overflow fix 4775b8c constrains its strip to the viewport.
- Related canonical workspace uses the same player/source navigation.
  Code map and current integration: `docs/player.md`, WEB-01/WEB-20.
  Media cancellation patch and its evidence remain in WEB-102.

## Known Gaps

- Recording selector still loads first 100 meetings and first 100 recordings
  per meeting; result/segment helpers do exhaust their own pagination.
- [Real case2 browser proof 6ed682e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794265640)
  confirms transcript seek 44.9s→play 52.1s/pause and empty warning/error capture.
  Earlier synthetic checks are separate. This does not complete unexercised
  mobile/locale/OS-capture/cancellation scenarios. Production proof: TEST-01.
- #101 resume-across-navigation feature 99f99e23 is handed off; not yet in
  fetched main/dev. Do not attribute it to deployed 7d5b481.
- Ivan owns player/capture; Artem owns canonical workspace/navigation.
  UI source links do not establish STT accuracy or automatic extraction.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
