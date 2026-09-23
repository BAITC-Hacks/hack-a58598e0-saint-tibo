# Google Meet browser participant — issue #24

Experimental local adapter for `../lifecycle.ts`, with real process/audio code and
synthetic checks. **Not live-verified; #24 remains open.** No deployment, account,
real meeting, backend upload or player acceptance is claimed.

## Runtime

`GoogleMeetAdapter` joins through the ordinary English guest browser UI, fills
`display_name + " (recording)"`, switches microphone/camera off, asks once and waits
for admission. It records only after admission. Login, CAPTCHA, denial, removal,
unknown UI or missing media fail closed; a retry needs a new adapter/session.
No hidden participant, private Meet API, captions, STT, cloud recorder or AI API.

The caller must confirm that the organizer permits this browser participant and
that participants were informed before capture. `recording_notice_confirmed: true`
is required both by the adapter and CaptureSession. The visible name is additional
identification, not a substitute for the actual notice. This prototype does not
post a chat notice or claim that a boolean proves consent. Organizers announce it
in the controlled meeting. Guest display names are limited to 100 characters before
the suffix. Account-only meetings stop; account provisioning/login is not implemented.

Run as an unprivileged dedicated Linux user with a visible X11 session (`DISPLAY`,
optionally `XAUTHORITY`), sandboxed Chromium, PulseAudio with `module-null-sink`,
FFmpeg with PulseAudio input + `libopus`, and a provisioned Playwright module.
The adapter neither installs packages nor changes project pins. The runtime
owner must pin the runner's browser/media dependencies when packaging it.
Playwright 1.62.1 and FFmpeg 7.1 were used for local synthetic verification.

Each attempt creates a private 0700 temporary directory, fresh Chromium profile,
private PulseAudio UNIX socket and null sink. No host PulseAudio/default monitor,
physical microphone or camera is used for recording. Browser env receives no
backend secrets. FFmpeg starts once and encodes `meet.monitor` to mono 48 kHz
Ogg/Opus. Original encoded bytes are preserved; chunk times come from Ogg sample
granules (minus Opus pre-skip), not arrival time. Writes are sequential and awaited.
The final partial chunk drains before finalize. A second container, sequence gap,
truncated stream or missing EOS fails; acknowledged earlier chunks remain incomplete.
Silence is format-valid and is **not proof of successful meeting audio capture**.

Stop/meeting-ended sends the normal `q` command to FFmpeg stdin for an EOS tail, then leaves through
the ordinary button and closes Chromium. Abort/fallback cleanup kills owned POSIX
process groups, including descendants, tears down the private Pulse server and
removes the profile/socket directory. Signal-only graceful stopping did not drain promptly on this FFmpeg/Bun/macOS
combination; stdin quit drains promptly. Abort still uses process-group SIGKILL. The shared lifecycle bounds join,
lobby, duration, sink writes, stop and cleanup. No unbounded retry or encoder restart.
The runner's supervisor still must kill its cgroup if the entire worker crashes.

## Network boundary

The canonical `meet.google.com/<code>` navigation and an explicit small list of
HTTPS Google resource hosts are allowed (`browser.ts`). Credentials, custom ports,
IP literals, other navigation destinations, popups and downloads are refused.
Service workers are blocked. Requests use Playwright `route.fetch(maxRedirects: 0)`;
**all redirects are rejected**, including subresource redirects. WebSockets are
blocked. This conservative policy may block real Meet dependencies/streaming
signalling; expand only after controlled observation and review, never wildcard
all Google hosts or silently fall back to unrestricted requests.

Browser interception is not an OS firewall: WebRTC, browser background traffic and
DNS rebinding require a dedicated runner egress policy. It must reject private,
loopback (except the worker-owned CDP control connection), link-local and service
networks and permit only the authorized platform media/signalling destinations.
`network_isolation_confirmed: true` is a deployment prerequisite, not a mechanism
that installs/proves that firewall. CDP is ephemeral loopback and must remain
unreachable to unrelated users/containers. Do not run on the public app server or
an unrestricted host. This task does not provision that runner or firewall.

## Integration

Trusted orchestration constructs one adapter and passes it to the existing kernel:

```ts
import { CaptureSession, type AudioSink } from "../lifecycle.ts";
import { GoogleMeetAdapter } from "./adapter.ts";

// All paths and attestations come from trusted runner/operator configuration.
const adapter = new GoogleMeetAdapter({
  chromium: "/usr/bin/chromium",
  pulseaudio: "/usr/bin/pulseaudio",
  ffmpeg: "/usr/bin/ffmpeg",
  playwright_module: "/opt/runner/node_modules/playwright-core/index.mjs",
  recording_notice_confirmed: true,
  network_isolation_confirmed: true,
});
// request contains UUIDs, meeting_url, display_name, recording_notice_confirmed.
// sink: AudioSink is already authorized for this owner/meeting/recording.
const session = new CaptureSession(request, adapter, sink);
const done = session.start();
// await session.stop() for drain; await session.cancel() for immediate abort.
const result = await done;
```

The snippet's `request` and `sink` are supplied by the coordinator; this directory
adds no public endpoint or invented backend auth. `AudioSink.write` receives
`audio/ogg;codecs=opus`, sequence and contiguous integer ms intervals. Only an ACK
advances the shared session; `finalize` runs after cleanup. Backend supports the
contract only after its owner integrates the real sink and validates decoder MIME.
Fragments are one stream, not individually playable files. Decode after concatenation
in sequence; player compatibility is a separate backend/playback gate.

## Reproduce local checks

```sh
MEET_VERIFY_FFMPEG=/absolute/path/to/ffmpeg \
  bun run tools/meeting-capture/google-meet/verify.ts
MEET_VERIFY_PLAYWRIGHT=/absolute/path/to/playwright-core/index.mjs \
MEET_VERIFY_CHROMIUM=/absolute/path/to/chromium \
  bun run tools/meeting-capture/google-meet/verify-browser.ts
bun run tools/meeting-capture/verify.ts
```

The scripts use generated tones, silence and local HTML fixtures only. They prove
sample-exact tone decode/RMS, original-byte chunk concatenation, truncation and
restart rejection, real FFmpeg graceful stop/abort/spawn failure, owned descendant
kill, notice/URL guards and shared sink/finalize. Browser fixtures prove the known
selector flow, guest name, mic/camera toggles, lobby timeout, denial, login/CAPTCHA,
removal and meeting end classification. They do not establish actual Meet selectors.

Before closing #24: provision and verify the isolated Linux runner; arrange an
organizer-approved guest meeting and notice; show the distinct participant and
admission; have two speakers produce audible audio; stop/remove/deny/timeout and
verify remote leave plus no remaining processes/audio sink; send through the real
protected backend and play the complete recording in our player. Account/tenant
restrictions, redirect/transport policy and current Meet DOM remain live blockers.

References: [Google guest join rules](https://support.google.com/meet/answer/9303069),
[Playwright routing/redirect options](https://playwright.dev/docs/api/class-route),
[Playwright CDP caveats](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp),
[Ogg Opus granule positions](https://wiki.xiph.org/OggOpus).

## Local handoff, 2026-09-23

Branch `ivan/24-google-meet-adapter`, based on the allowed local merge of
`codex/19-meeting-player`. Only this directory was authored by the worker.
Passed: 10 audio/process/contract checks, 3 groups of browser fixture checks,
26 shared lifecycle scenarios, strict TypeScript 7.0.2 and `git diff --check`.
Synthetic audio ran on macOS using FFmpeg 7.1 from a temporary verification-tool
installation (imageio-ffmpeg 0.6.0); no project dependency or lockfile was changed.
Browser fixtures used provisioned Playwright 1.62.1 and local Chrome. No residual
FFmpeg child was found after checks. Scope excludes shared `.serena` files; the
coordinator should merge this handoff into its own knowledge notes.
