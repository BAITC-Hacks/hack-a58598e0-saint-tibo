# Zoom browser participant prototype — #25

`ZoomAdapter` implements the common `CaptureAdapter` from #22. It opens an
isolated Chromium context with Playwright, enters as a guest, watches the
prejoin/waiting/meeting screens, and records remote WebRTC audio tracks only.
The resulting continuous `audio/webm;codecs=opus` fragments flow through the
common `AudioSink`. Camera and microphone permissions are not granted.

```ts
import { CaptureSession } from "../lifecycle.ts";
import { meetingUrl, ZoomAdapter } from "./adapter.ts";

const adapter = new ZoomAdapter(undefined, passcode); // passcode stays in memory
const session = new CaptureSession({
  id, meeting_id, recording_id,
  meeting_url: meetingUrl(meetingId), // or a validated Zoom /j/ link
  display_name: "Saint Tibo recorder", recording_notice_confirmed: true,
}, adapter, authorizedSink);
await session.start();
```

Install Playwright and Chromium/Chrome in the worker environment; this slice
does not change the shared dependency manifest. The default launcher uses
the `playwright` package and installed Chrome channel. A link's `pwd` query is
an opaque Zoom token; for a numeric Meeting ID and a plain passcode, pass the
passcode separately to the adapter. Never log either value. The caller must
bind the sink to an authorized meeting and recording, obtain recording notice
confirmation, and provide the actual backend transport. This adapter does not
allocate recordings, authenticate callers, or upload directly.

Local fixture proof (Chrome + Playwright installed):

```sh
bun run tools/meeting-capture/zoom/verify.ts
```

The fixture checks numeric IDs, guest prejoin, passcode failure, waiting room,
rejection, host end and cleanup. It injects a synthetic 440 Hz audio track into
a `RTCPeerConnection` track event, records it in Chromium, decodes the resulting
WebM stream and checks nonzero RMS. It does **not** prove Zoom's real UI, remote
track behavior, or backend playback. The selectors are an experiment and will
need adjustment against a controlled meeting. Chrome's media policy and Zoom's
participant/recording restrictions may prevent real capture.

## Live gates before calling #25 done

1. Controlled Zoom meeting permits a named guest recorder and provides explicit
   recording notice/consent. Check passcode, waiting room, denial, host removal,
   meeting end, and browser leave on the same account setup used in deployment.
2. Confirm actual remote speech is audible in the recorded WebM and is accepted
   by the authorized backend sink, player and pipeline. This prototype has no
   real backend sink wiring in its owned path.
3. Verify deployment's Playwright/Chrome runtime, isolated worker/process kill,
   and remote participant disappearance after timeout or crash. The shared
   lifecycle bounds waits; this JavaScript adapter cannot kill a stuck process
   synchronously or prove a remote leave by itself.
4. Resolve the Zoom-approved route for a recording bot. Zoom directs automated
   real-time media use to RTMS; access needs a configured app, host permission,
   entitlement and callback receiver. Meeting SDK web use has separate policy
   and authorization rules. This browser prototype is not SDK or RTMS approval.

Official references: [Meeting SDK scope](https://developers.zoom.us/docs/meeting-sdk/),
[web SDK policy](https://developers.zoom.us/docs/meeting-sdk/web/),
[RTMS prerequisites](https://developers.zoom.us/docs/rtms/meetings/getting-started/).
