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
- Later [#13/#14 local evidence](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793605774)
  reports builds, PostgreSQL+HTTP review/conflict/ACL/export scenarios and
  visual RU/KK/long-table PDF/DOCX checks. Identity was substituted locally.
- Independent [review/export LIVE-OK 97e804e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793710152):
  real JWT, anonymous401, foreign-admin404, stale409, invalid/cross-version
  source/assignee422, r2 save/reload and immutable JSON/decoded PDF/DOCX through
  metadata/content edits, r3 draft export409, r4 approved current content.
  First run: 54 passes stopped on QA-only PDF whitespace assertion; targeted
  normalized continuation: 57/57 passed. Own app/auth cleanup counts 0; no product bug.
  #14 closed; UI buttons and #13 automatic extraction are separate acceptance.
- Browser proof covered logout/manual login/root dev-login; it is not a
  claim that the complete meeting UI or real player integration is finished.
- Ivan's earlier #95 report gives a2cfe28 deploy/HTTP200 only. Later synthetic
  player 34062c4/overflow fix ab3d331 still require dev/browser proof.
- QA removed its own temporary data; historic cleanup is not authorization
  to delete other users' meetings/jobs/accounts.

## Known Gaps

- RU functional success is not manual accuracy measurement for RU/KK/mixed.
  #11/#70/#89, diarization, extraction and product-level end-to-end acceptance
  remain separate work. CT2 small synthetic mixed smoke exposed omissions (MODELS-01).
- Real protected player, browser capture upload and external participant
  acceptance remain under their own issue owners.
- Evidence must include exact SHA, scenario, observed result and limitations.
  Never publish tokens, meeting text/audio or raw private logs as proof.

Last commit: `ab3d3312c3bafb3892bde93539383cea9e48b6de` (audited tree, 2026-09-23; live evidence is separate).
