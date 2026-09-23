# INFRA-23 Meeting connectors and organizational memory

## Current Behavior

- `docs/meeting-connectors.md` records Teams/Meet/Zoom integration options
  and prerequisites; `tools/meeting-capture/` contains local prototypes.
  See INFRA-22 for actual kernel behavior, not provider marketing.
- Existing provider research distinguishes Teams policy/guest constraints,
  Meet Preview/OAuth/enrollment and Zoom RTMS entitlement/host requirements.
  RTMS is not automatically a visible separate participant.
- Hosted services that send meeting audio/text outside the self-hosted
  boundary do not satisfy the case. A documented self-host option alone
  does not establish vendor access, licensing or our deployment proof.

## Known Gaps

- No recorded live bot join/audio proof for #22–25, organizer credentials,
  complete local queue/storage deployment or approved vendor image/chart
  availability. Revalidate provider requirements before implementation.
- Meeting BaaS self-hosted Kubernetes is a research candidate; do not call
  Compose supported or claim cloud processing is authorized.
- #96 Honcho organizational memory/Q&A is Ivan-owned branch work, absent
  from audited dev. It must not be listed as a shipped product capability.
  The [pre-integration review](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/96#issuecomment-5793481184)
  requires removing ready-made external OpenAI processing configuration;
  parent decides integration after current branch review.
- Keep private meeting URLs, transcripts, credentials and recordings out of
  research queries, issues and memories. Preserve upstream attribution/licenses.

Last commit: `a2cfe28c10b214a8189b8c140d9d6b31167bf27a` (audited tree, 2026-09-23; not a live assertion).
