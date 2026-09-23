# WEB-102 Media cancellation

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
- Live dev-ivan at `cc131fd` still lacks this patch. #102 stays open until
  coordinated dev merge/deploy and live cancellation/seek/log proof.
