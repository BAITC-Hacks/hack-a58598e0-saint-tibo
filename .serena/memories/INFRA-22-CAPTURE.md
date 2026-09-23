# INFRA-22 External meeting capture kernel

## Current Behavior

- `tools/meeting-capture/url.ts` validates allowed HTTPS Teams/Meet/Zoom
  links without network requests; join secrets must stay private.
- `lifecycle.ts` supplies in-memory `CaptureSession` start/stop/cancel/
  snapshot with #8 statuses and bounded join/admission/record/stop/cleanup/I/O.
  Required adapter methods: join/capture/cleanup/forceCleanup.
- Injected AudioSink write/finalize follows the raw-chunk contract, records
  acknowledged prefix, and cannot claim complete recording without audio/ACK.
- Provider prototypes exist in `teams/`, `google-meet/`, `zoom/`;
  browser participant/audio approaches are described in their READMEs.
- Kernel and provider verification scripts use synthetic/local scenarios.
  This audit did not rerun those scripts or join external meetings.
- Historical integration is tracked in
  [#22](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/22#issuecomment-5793184636).
  Platform prerequisites/research map: [INFRA-23](INFRA-23-connectors.md).

## Known Gaps

- No real meeting join→audio→authorized sink proof is recorded for #22–25.
  Adapter prototypes are not a running production bot service.
- No shared durable service/supervisor or authenticated backend capture
  session API yet; #81 is Danil's dependency for trusted sink ownership.
- Bounded kernel waits cannot themselves force remote leave or terminate
  noncooperative JS. A real adapter must demonstrate process cleanup,
  participant notice/leave and captured audio in a controlled meeting.
- Ivan owns capture/platform implementation; current claims must be checked
  in GitHub before editing these code paths.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
