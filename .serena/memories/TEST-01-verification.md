# TEST-01 Verification and bounded receipts

## Current Behavior

- Current wave uses builds and focused runtime/browser scenarios; no repository
  test/linter suites. `verify` includes tests/checks and is not build-only.
  Memory-only changes use source/contract/link/scope review.
- Distinguish code, build, synthetic behavior, deployed commit and verified
  live behavior. Manual deployment/shared scheduling belong to the coordinator.
- [#94 at58ee537](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510):
  auth/logout/owner ACL, raw upload/WAV/Range, jobs/results, fresh RU STT 76
  segments; controlled restart interrupted safely. That retry's completion
  was not proven after a QA logger error; the fresh successful job was separate.
- [#14 LIVE 97e804e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793710152):
  real JWT,401/404/409/422, immutable historical JSON/decoded PDF/DOCX,
  draft export rejection and current approved export. First 54 checks hit a
  verifier whitespace issue; targeted continuation 57/57 passed, own cleanup 0.
  RU/KK/multipage layout was visually checked; backend #14 is closed.
- [#104/#105 LIVE b1e33cb](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/104#issuecomment-5793915724):
  actual 305478-frame WAV →19093ms →local STT 7 segments →review r2→PDF/DOCX;
  no seeded result. SQL parameter hiding/safe formatter deployed;422 private
  marker absent from response/scoped logs. Isolated Uvicorn 500 proof is
  separate; no shared unhandled failure injection. Owned app/auth/media cleanup 0.
- [Browser PASS 6ed682e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794265640):
  actual case2→54 segments, manual review/approval/edit reset, two-tab 409 retains
  draft until explicit reload; full reload persists. PDF 50243B/DOCX 37890B,
  seek 44.9→play 52.1/pause, empty console capture. #107 closed; demo retained.
- [Production LIVE-OK 7d5b481](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794357831):
  one ordinary signup→logout→login→JWT; dev-login404/no cookie, anonymous me401.
  Real synthetic RU 305478 frames→19093ms→turbo 7 segments, 20.76s with queue/poll.
  Manual r2→PDF48903B/DOCX37361B; own app/auth rows 0, media absent.
  Permanent demo untouched; coordinator separately reports production login/UI PASS.
- WEB-102 preserves local abort499/no-log vs genuine500/log proof;
  WEB-21 preserves capture metadata and still-pending OS/browser acceptance.

## Known Gaps

- #11/#70/#89 real-language acceptance stays open despite improved turbo
  synthetic CER. See MODELS-01 for model/runtime and #69/#12 evidence limits.
- Mobile/locale/capture gates are not inferred from the
  bounded core browser proof. Refer to exact #94 release receipts.
- QA deletes only its own disposable data; persistent demo identities/meetings
  are intentional; user-started test1/Совещание №1 must not be deleted/interrupted.
- Never publish private logs, tokens or meeting text/audio as evidence.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
