# TEST-01 Verification and evidence

## Current Behavior

- Current wave explicitly forbids repository test/linter suites.
  Use appropriate builds and short actual runtime/browser scenarios for code;
  memory-only changes use source/contract/link/scope review.
- Root `bun run build` builds frontend+backend.
  `verify` includes tests/checks; `check`, `test` and `test:integration`
  exist but are not the commands for this wave.
- No repository CI workflow is present. Deployment is manual and requires
  a clean commit, ancestry-safe server update and coordinator scheduling.
- Always distinguish code audit, local build, synthetic behavior, deployed
  commit and independently verified live behavior.
- [#94 independent LIVE-OK](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510)
  covers runtime `58ee537`: 30 HTTPS checks, auth/revocation, meeting/upload/
  normalized WAV, media Range, job idempotency, result linkage, owner ACL,
  deletion, fresh RU STT (274250ms → 71.03s → 76 segments).
- Controlled restart produced interrupted/no result; retry was accepted
  idempotently, but its completion was not proven after QA logger failure.
- Renderer produced PDF/DOCX and preserved tested DOCX characters; layout
  and HTTP/UI downloads were outside that proof.
- Browser proof covered logout/manual login/root dev-login; it is not a
  claim that the complete meeting UI or real player integration is finished.
- QA removed its own temporary data; historic cleanup is not authorization
  to delete other users' meetings/jobs/accounts.

## Known Gaps

- RU functional success is not manual accuracy measurement for RU/KK/mixed.
  #11/#70/#89, diarization, extraction and product-level end-to-end acceptance
  remain separate work.
- Real protected player, browser capture upload and external participant
  acceptance remain under their own issue owners.
- Evidence must include exact SHA, scenario, observed result and limitations.
  Never publish tokens, meeting text/audio or raw private logs as proof.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
