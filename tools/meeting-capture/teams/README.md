# Teams participant adapter — #23, local experimental slice

`TeamsAdapter` implements the [#22 lifecycle](../README.md) without changing its
interface. It joins as a **named guest** in a fresh Chromium process/profile,
waits for admission, records inbound mixed audio locally, drains chunks on stop
or a recognized meeting-end screen, clicks Leave and tears down its browser.
The adapter is single use; a retry requires a new session and recording.

**This is not live Teams acceptance.** The synthetic browser fixture proves the
adapter's DOM lifecycle and actual WebRTC → WebAudio → MediaRecorder path. It
does not prove current Teams DOM compatibility, tenant policy, audible human
voices, production network isolation, backend ingest or product playback.
Issue #23 must stay open until those gates pass.

## Runtime and integration

Task-local peer dependency: **Playwright 1.62.1**, Bun **1.4.2**, locally installed
Chrome, POSIX macOS/Linux. Use an already provisioned Playwright runtime or resolve
the exact peer from this directory; no root/frontend/backend dependencies change.
The browser control endpoint binds to loopback on an ephemeral port. No web
service or fixed application port is started. Windows is deliberately rejected:
force cleanup relies on Playwright's POSIX process-group launcher.

```ts
import { chromium } from "playwright";
import { CaptureSession } from "../lifecycle.ts";
import { TeamsAdapter } from "./adapter.ts";

// Trusted orchestration must establish these facts before creating the adapter.
// Never copy the true values from this example into untrusted request handling.
const adapter = new TeamsAdapter({
  chromium,
  authorization: {
    meeting_authorized: true,
    recording_notice_confirmed: true,
    platform_recording_allowed: true,
    isolated_network_confirmed: true,
  },
});
const session = new CaptureSession(authorizedRequest, adapter, authorizedSink);
const completion = session.start();
// Poll session.snapshot; session.stop() drains, session.cancel() interrupts.
await completion;
```

`authorizedRequest` follows #22: allocated session/meeting/recording UUIDs,
private Teams URL, display name and confirmed participant recording notice.
An operator must actually notify participants and confirm organizer/tenant
permission before capture. A recorder name alone is not sufficient notice.
There is no invented Teams recording-consent API or fake permission grant.

`authorizedSink` is the existing `AudioSink` interface, bound by backend
orchestration to the authorized meeting/recording pair. Each `write` must await
an ACK; `finalize` uses the acknowledged count and completion flag. No backend
endpoint, authentication, storage allocation or processing job is implemented
here. Backend #9 and the real player/pipeline integration remain separate gates.

## Join and media behavior

- Only URLs accepted by the shared URL parser are used. The browser follows
  the normal browser-join button, fills and verifies the requested guest name,
  and submits Join now. In-call UI alone cannot bypass the named-guest gate.
- Uses stable Teams data attributes and English/Russian prompt fallbacks;
  requests an English browser locale. Unknown UI stays bounded by the common
  join/lobby deadlines. CAPTCHA, login, OTP and policy prompts stop the attempt.
  No saved profiles, credentials, microphone/camera grants, stealth settings,
  launcher query tricks or automatic rejoin are used.
- Lobby, denial, recording prohibition and meeting-end screens are checked.
  Lost status UI or all ended inbound tracks fail after five seconds; first
  media must arrive within fifteen seconds after admission. Silent participants
  are allowed: the existence of encoded bytes alone never proves audibility.
- A pre-navigation script observes standard `RTCPeerConnection` inbound audio
  track events in the main document. It does not read Teams internals, data
  channels, captions, transcripts, roster or speaker identifiers. It mixes those
  tracks in WebAudio and creates **one** `audio/webm;codecs=opus` MediaRecorder
  stream. Browser/OS microphone, desktop and unrelated output are not sources.
  A zero-volume HTML audio consumer advances Chromium's remote audio decoding.
- Four-second approximate chunks have adjacent integer time intervals from
  `performance.now()`. MediaRecorder stays running while the sink acknowledges
  each chunk. Queue limits are eight chunks and 8 MiB: overload fails visibly,
  never drops audio or pauses time. The common kernel enforces recording limits.
  These time estimates are diagnostic; decoded audio remains playback truth.
- Stop and recognized meeting end drain the final chunk. Cancellation or failure
  preserves only the acknowledged incomplete prefix. No automatic source restart
  or concatenation of independent containers is allowed.
- Cleanup stops local media, attempts Leave and waits for the button to disappear,
  then closes the owned browser. A bounded cleanup failure cannot report success.
  `forceCleanup()` kills only its own POSIX browser process group, including when
  graceful cleanup hangs; late launches are also closed. A worker supervisor is
  still required to clean up on parent-process/host failure.

The main-document browser path is experimental. If Teams puts media in a worker,
iframe or popup, or its policy disallows this capture, this slice must fail rather
than enable an alternate hidden source. Mixed audio provides no roster-based
diarization. All subsequent speech/text processing must remain local.

## Network boundary

`network.ts` restricts navigation to approved Teams HTTPS hosts and resources to
a narrow Teams/Office CDN/Skype/Lync host list. It rejects credentials, explicit
non-default ports, IP URLs and non-public DNS results, blocks service workers,
rejects unapproved WebSockets, and treats auth navigation as a safe auth blocker.
Unknown platform endpoints may require a reviewed allowlist update after live
inspection; do not add broad wildcards to make the browser join succeed.

**These routes are not a network sandbox.** DNS preflight cannot prevent DNS
rebinding between validation and Chromium resolution; browser WebRTC UDP and
background traffic do not pass through Playwright HTTP routes. Real use requires
an externally enforced isolated worker network/firewall that excludes private,
loopback, link-local/metadata destinations and non-platform egress, with platform
media endpoints reviewed. The authorization flag is an operator attestation,
not implementation or proof of that firewall. No Linux isolation/deployment was
provisioned by this slice. Meeting platforms remain external media transport;
there are no external AI/transcription/recording services in this adapter.

## Reproducible local proof

With the exact Playwright peer available to this directory:

```sh
bun run tools/meeting-capture/verify.ts
bun run tools/meeting-capture/teams/verify.ts
```

The proof intercepts all fixture HTTP requests at the trusted Playwright boundary;
it never visits Teams or starts a real meeting. It exercises the real adapter,
Chromium, two local WebRTC peer pairs, MediaRecorder and the common chunk sink.
The synthetic fixture uses no external ICE servers. Its loopback WebRTC peers
are intentionally local and do not represent production egress enforcement.

It decodes the continuous saved WebM locally, measures the two incoming tones
(440/660 Hz), and checks that an unrelated page-output tone (880 Hz) is excluded.
It writes `.proof/synthetic.webm` and mono `.proof/synthetic.wav` for listening;
the directory is private and git-ignored. Fixtures contain only generated tones.
No user data, screenshots, browser traces, full URLs or raw browser errors are
recorded in reports. Chunk sink here is an in-memory acknowledgement fixture,
not evidence that backend #9 accepted a recording.

Scenarios include stop/drain/leave, host end, denial, login/verification, forbidden
recording, lobby timeout, no media, media loss, permission revocation, cancellation,
sink failure and stuck Leave/forced cleanup. Each checks page closure and that
the owned browser process group is gone. The separate common proof covers URL,
duration, upload/finalize deadlines and contract invariants.

## Remaining live gate / handoff

Obtain an explicitly authorized test Teams link, organizer for lobby admission
and notice, and **two test speakers**. If guest entry is forbidden, stop with
`authentication_required`; this slice does not implement account/manual login.
Then on the intended isolated Linux runner prove actual named join, participant
notice, two audible voices, normal stop and host end, denial/timeout, no remaining
remote participant or local processes, and no audio/text egress to external AI.
Pass the stream through the authorized #9 sink and verify the resulting media
in the actual player and local processing pipeline. Keep links/identities private.

Local proof environment (2026-09-23): macOS arm64, Bun 1.4.2, Playwright 1.62.1,
Google Chrome 153.0.8010.53. The verified synthetic stream decodes to 5.46 seconds;
440/660 Hz amplitudes are 0.11928/0.11939, unrelated 880 Hz is 0.0000348.
WebM SHA-256: `0a12eaadc928ee0b7f6e91f30b792802519aa9480dfd63f592aea4f2a6a808f7`.
Re-running generates a new stream/checksum. Strict TypeScript compilation and
the common 26-scenario proof passed. No push, shared-branch merge, deployment or
issue closure is implied.

The runtime APIs are documented by [Playwright BrowserServer](https://playwright.dev/docs/api/class-browserserver)
and [MediaRecorder dataavailable](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event).
