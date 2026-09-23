# WEB-102 Media cancellation

## Current Behavior

- `frontend/src/app/server/media.server.ts` forwards the request signal and
  cancels the upstream body when playback closes (`a39e8d0`).
- TanStack Start 1.168.56 uses `@tanstack/start-server-core` 1.169.37 and
  `h3-v2` (h3 2.0.1-rc.20). Start throws `request.signal.reason` before a
  media route can run; h3 otherwise logs it and returns an internal 500.
- `frontend/patches/h3@2.0.1-rc.20.patch` maps only the exact aborted
  request `AbortError` to internal 499 without a log. Other errors retain
  h3's 500 and logging. `frontend/Dockerfile` copies the patch before each
  frozen Bun install, including the production stage.
- Synthetic aborted `start.fetch` gave 499 and zero error logs. A normal
  error and an unrelated error on an aborted request both gave 500 and logged.
  Synthetic RIFF/WAV proxy check gave Range 206/exact bytes, HEAD 200/no body,
  and cookie-free 401. Local typecheck/check/build and Docker build passed.

## Known Gaps

- [Integrated d9ce072](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/102#issuecomment-5794083343)
  preserves the patch and both Docker COPY stages on shared dev. Earlier
  dev-ivan cc131fd lacked it; that is historical, not current deployment state.
- #102 stays open until exact deployed cancellation/seek/log proof; successful
  local aborted Start request does not establish final server/browser behavior.

Last implementation commit: `fa1baf2` (2026-09-23).

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
