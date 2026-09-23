# INFRA-23 Connectors and isolated Honcho stack

## Current Behavior

- `docs/meeting-connectors.md` maps Teams/Meet/Zoom prerequisites;
  `tools/meeting-capture/` contains browser prototypes (INFRA-22).
  Provider policy/enrollment/entitlement and visible participant behavior need
  explicit confirmation; RTMS alone is not a separate meeting participant.
- Honcho #96 hardened tools-only stack is integrated at 3005fd3:
  `tools/honcho/compose.yaml` pins upstream image digest, uses an internal
  network/loopback API, local LLM/embedding endpoints and disabled telemetry.
  Cloud development overlay was removed; the old branch hold is superseded.
- Stack has separate PostgreSQL/Redis/storage/auth and does not run from
  Saint Tibo's shared Compose or application deployment.
- `docs/honcho.md` records synthetic ingestion/idempotency/workspace-token
  scoping and denied outbound probe. This is bounded access smoke, not
  successful derived cards or question answering.
- [#96 status](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/96#issuecomment-5793743674)
  delegates the application authorization bridge to Danil's #103.

## Known Gaps

- No real external bot join→audio→trusted sink proof for #22–25/#81.
  Vendor/self-host claims do not prove our supported deployment.
- Honcho lacks accepted local model derivation and application owner ACL/
  ingestion bridge; no user-facing Q&A/person-card capability is claimed.
  #96/#103 remain separate from the first release's required path.
- Local providers must remain inside the approved processing boundary;
  preserve upstream attribution and keep private meeting data out of research.
- Coordinator describes Secretary as an ideas reference using Teams heuristics
  and cloud services; it is not evidence of local acoustic diarization.
- `research/` is an archived reference collection, not implemented scope
  or authority to revive held branches/cloud processing.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
