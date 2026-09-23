# WEB-PLAYER

Current Behavior: `/player` is a protected local-file listening page. `MeetingPlayer` accepts a browser-playable URL, emits integer millisecond position/duration, and exposes `seek(timeMs)` and `pause()`. It supports loading/buffering/error/end, speed, volume, seeking and source cleanup. The page also accepts an optional local transcript file — `pages/player/lib/local-transcript.ts` zod-validates `{segments:[{start_ms,end_ms,text}]}` and shows them beside the audio via the WEB-20 sync hook. The same-origin media proxy and protected recording endpoint are owned by #9 and are not connected yet — no API calls.

Known Gaps: #19 remains open until a real stored recording plays through the protected URL and Range/206. Server results (`GET …/results/{v}/segments` on dev) still need wiring for real #19/#20 integration. The local page does not upload or transcribe.

Proof: frontend typecheck/check/i18n/FSD/build passed for initial player. The follow-up integer-ms contract alignment passed typecheck/check. Deployed to `https://dev-ivan.saint-tibo.win` and a temporary ordinary user verified a 10-minute synthetic WAV, play, seek and stop in the browser. That user was deleted after logout. No real meeting audio was sent to the server.
