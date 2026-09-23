# External meeting capture kernel — #22

Local, dependency-free Bun/TypeScript module for a **single capture attempt**.
There is no HTTP service, platform SDK, browser automation, FFmpeg process,
registered real adapter or production audio sink here. Synthetic checks prove
the lifecycle only. #22 remains open until a controlled meeting proves join,
audio, participant notice and cleanup. This module does not use cloud AI.

```sh
bun run tools/meeting-capture/verify.ts
```

## Integration boundary

`parseMeetingUrl(string)` returns `{platform, join_url}` or a constant error.
`new CaptureSession(input, adapter, sink)` validates the request without I/O.
`start()` returns one shared completion promise; `snapshot` can be polled.
`stop()` is idempotent: before admission it cancels; during capture it asks the
adapter to drain its final audio before completing. `cancel()` aborts immediately.
After capture has drained, cleanup/finalize cannot be cancelled. A retry is a new
session and recording, never resurrection of a terminal session.

The snapshot follows the [#8 draft](../../docs/meeting-contract.md):
`requested → joining → waiting_admission → recording → stopping → completed`,
with direct `joining → recording`, and `failed`/`cancelled` after cleanup.
`error_code` is a closed safe code; raw SDK exceptions, names and join links are
not returned. UUIDs identify the session/meeting/recording. `started_at` is the
attempt start in UTC, distinct from meeting time and audio-relative milliseconds.
This slice requires a previously allocated `recording_id`; allocation without a
recording is the future API orchestrator's responsibility.

Each platform needs its **own adapter instance and confirmed access**, even if
several adapters use the same self-hosted provider. `CaptureAdapter` supplies:

- `platform` and capabilities: participant join, mixed audio, participant audio.
- `join({target, display_name, signal, waitingAdmission})`: resolve only when
  admitted and recording is permitted; report lobby only once. Decline/login/
  permission loss must produce a safe `CaptureError`, never an automatic retry.
- `capture({signal, stop, emit})`: await every emission; on `stop` drain and
  resolve, on `signal` abort cease activity. No new resource allocation after abort.
- `cleanup(signal)`: leave the meeting, stop audio and release partial join
  resources even after a failed join. It receives a fresh bounded signal.
- `forceCleanup()`: synchronous, idempotent local teardown, called in all cases
  including successful cleanup. A future process adapter must kill its owned
  process group and destroy its isolated audio sink/handles here.

JavaScript cannot terminate arbitrary non-cooperative code or prove that a remote
participant has left. A production adapter needs process isolation, a supervisor
that kills the worker on loss of heartbeat, and platform-specific confirmation
of leave. Cleanup errors/timeouts produce `failed`, never a success claim. This
kernel guarantees bounded waiting and calls teardown; real OS/remote cleanup is
an adapter acceptance gate, still unproved.

Default deadlines: join 60s, lobby 120s, capture 4h, graceful stop 10s, each sink
operation 30s, cleanup 10s. A lobby notification cannot extend its deadline by
repeating. Duration timeout is incomplete failure; callers can stop gracefully
before it. Deadlines can be shortened for checks. No timer remains after completion.

## Audio and ownership — #8 / #9

The injected `AudioSink` is bound by trusted orchestration to an already-authorized
`meeting_id` / `recording_id`. Backend/storage belong to Danil. This module cannot
authenticate users or allocate records; UUID checks do not provide authorization.
Service authentication/endpoints must be agreed with #8/#9 before exposing it.

`write({sequence,start_ms,end_ms,content_type,bytes}, signal)` maps to raw binary
chunk PUT, with sequence in the path, times in the query and MIME in Content-Type.
Use the generated SDK only after real operations are published. No invented HTTP
endpoint or independent auth flow is implemented here. Sink resolution means
backend acknowledgement; a request being sent is insufficient.

One recording is one continuous encoded stream. Sequence starts at 0, time at 0,
intervals are adjacent integer milliseconds, MIME never changes. Fragments need
not decode individually; independent containers or a source restart require a
new recording. Adapters convert their PCM frames to a supported continuous
container before emitting. Limits match the draft: 8 MiB/chunk, 512 MiB total,
4096 chunks and 4h. Bytes are copied before the async write; the adapter must await
backpressure. This stricter producer order does not weaken #9's receiver support
for reordered/retried chunks.

Backend owns SHA-256/idempotency `(recording_id,sequence,bytes,times,MIME)` and real
container validation. Sink may retry the identical copied payload; kernel adds
no automatic retries. Finalization uses `{expected_chunks,is_complete}` only
after cleanup. Normal completion requires acknowledged nonempty audio and a
successful `finalize(is_complete:true)`. Failure/cancellation finalizes only the
acknowledged prefix with `false`. No audio means no finalize and never `ready`.

Timeout during write/finalize can leave server acceptance uncertain. Sink must
honor abort and reconcile through #9's idempotent operations; a server that has
accepted an unacknowledged extra part can reject prefix finalization. That remains
`finalize_failed`, never silent truncation or `completed`. Records left receiving
need #9's inactivity/recovery path. The module stores no media on disk.

## URL policy

Accepted HTTPS address shapes (an intentional subset, not a universal link parser):

- `meet.google.com/abc-defg-hij`: case normalized; `authuser`/`hs` dropped.
- `zoom.us/j/<9–11 digits>` or one-label `*.zoom.us` subdomain; only `pwd` retained.
- `teams.microsoft.com/l/meetup-join/19:meeting_<token>@thread.v2/0` with literal
  or encoded separators; optional JSON `context` contains only UUID `Tid`/`Oid`.
- `teams.microsoft.com/meet/<9–20 digits>` or `teams.live.com/meet/<9–20 digits>`;
  only `p` retained. Numeric limits are this module's acceptance policy.

Unknown/duplicate query keys, credentials, explicit ports, fragments, controls,
backslashes, dot paths, unapproved domains and unsupported paths are rejected.
Passcodes/context remain private inside `join_url`; do not log/serialize the
target, even though public snapshots omit it. No redirect resolution, fetch or
DNS request occurs. Short links, custom vanity domains, Meet lookup links and Zoom
personal rooms are unsupported. The future adapter must separately constrain
navigation, DNS/IP destinations, redirects and service endpoints; this parser is
not a browser/network sandbox. Link acceptance proves neither access nor audio.

## Unresolved platform gates

- **Teams:** controlled host/tenant, permitted participant account or guest access,
  lobby admission and recording notice. A browser path remains an experiment.
  Microsoft's application-hosted media bot requires Windows/.NET and Azure for
  production, plus calling/media permissions/admin consent: incompatible with
  an entirely on-premises production media worker without a different approved
  route. [Microsoft requirements](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots).
- **Meet:** either prove an allowed browser participant in a controlled meeting,
  or obtain Media API Developer Preview enrollment for the Cloud project, OAuth
  principal and **all participants**, plus restricted audio scopes and consent.
  [Google requirements](https://developers.google.com/workspace/meet/media-api/guides/get-started).
- **Zoom:** RTMS needs Developer Pack credits, configured/authorized application
  and host permission, plus a receiver and callback ingress. Decide whether a
  stream without a distinct participant meets product acceptance. Meeting SDK raw
  examples alone do not establish permission for an automated recorder.
  [RTMS prerequisites](https://developers.zoom.us/docs/rtms/meetings/getting-started/),
  [Meeting SDK policy](https://developers.zoom.us/docs/meeting-sdk/linux/).

**Meeting BaaS self-hosted v2** is a cross-platform candidate, not an installed
adapter. Obtain vendor access/licensing for `kubernetes-config` and bot/API images;
for the documented Kubernetes/Helm path provide bot nodes/video-device support,
PostgreSQL, Redis, internal
S3-compatible storage, SQS-compatible queues and HTTPS ingress. Disable
`ENABLE_TRANSCRIPTION` in both API and jobs, and verify media/text/log egress,
queue compatibility, vendor telemetry and platform permissions on the actual
images before claiming the local-only boundary. Public config exposes custom S3
and SQS endpoints but does not prove an arbitrary local queue is compatible.
[Repository access](https://docs.meetingbaas.com/self-hosting/repository-setup),
[configuration and disabled transcription](https://docs.meetingbaas.com/self-hosting/configuration).
Hosted Recall/Meeting BaaS or hosted storage-only options are not selected.
Kubernetes is the documented deployment path, not a claim of physical necessity.
A Docker image alone does not provide a working Compose deployment: bot lifecycle,
jobs, queues and video devices would need another orchestrator. No official Compose
recipe or functioning port was verified; no installation is attempted without images.

Research and platform choice live in the coordinator-owned
`docs/meeting-connectors.md`; integrate its draft separately. The current kernel
neither installs a provider nor claims real Teams/Meet/Zoom join or audio capture.
