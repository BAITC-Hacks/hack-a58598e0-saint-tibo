# External meeting capture kernel

## Current Behavior

- `tools/meeting-capture/url.ts`: closed HTTPS Teams/Meet/Zoom link policy;
  no network requests; join tokens remain private.
- `tools/meeting-capture/lifecycle.ts`: `CaptureSession` in-memory attempt;
  `start/stop/cancel/snapshot`, #8 statuses, bounded join/admission/record/stop/
  cleanup/I/O. Required adapter `join/capture/cleanup/forceCleanup`.
- Injected `AudioSink.write/finalize` follows #8/#9 raw chunk contract;
  explicit acknowledged prefix, no complete recording without audio/ACK.
- `tools/meeting-capture/verify.ts`: 26 synthetic scenarios, no network/audio
  devices; `bun run tools/meeting-capture/verify.ts` passes with Bun 1.4.2.
- Strict TypeScript 7.0.2 compilation and `git diff --check` passed.
- README records lifecycle obligations, deadlines and link policy.

## Known Gaps

- No real adapter, process supervisor, service auth, durable state or HTTP sink.
  No SDK/API endpoint is claimed as implemented. Backend/storage belong to Danil.
- Kernel calls teardown and bounds waits, but cannot force a remote participant
  to leave or kill non-cooperative JS. Real adapter must prove process-group kill,
  remote leave, notice and audio in a controlled meeting.
- Teams access/policy; Meet Preview/OAuth/all-participant enrollment or approved
  browser proof; Zoom RTMS entitlement/app/host and separate-participant decision.
- Meeting BaaS self-hosted is a candidate: vendor image/chart access/licensing,
  documented Kubernetes deployment, storage/queue compatibility and egress proof.
  Compose is unverified. Hosted providers are not authorized.
- `docs/meeting-connectors.md` belongs to coordinator; integrate its research
  separately. It must use #8 states, not queued/connecting/connected.
- No push/merge/deploy; #22 stays open. Claims released after local delivery.
