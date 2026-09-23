# NEXT-SESSION — combined release handoff

Snapshot: 2026-09-23; refresh exact runtime receipts before acting.
Last commit: `420aac5df7f0f764fb8ddbbbd6d1b710d0f1ea7a` (release source; prod1adbcb5 health/UI PASS, dev GPU case2 complete with semantic gaps).

## Current law and ownership

- Saint Tibo only; preserve other worktrees/WIP. No private audio/transcripts
  or infrastructure secrets in git/issues; no repository test/linter suites.
- Feature → personal lane → dev/main with --no-ff; no history rewriting.
  Coordinator owns releases, deploys and the one Brev L4 ($25 cap).
- Serena owns memories/this tracked index on `feat/94-serena-player-handoff`.
  User authorized immediate NEXT/RELEASE handoff; combined UI proof remains pending.
  Preserve incoming notes; no product/root docs/DEMO edits or new runtime audits.
- Preserve user test1/Совещание №1 and permanent demo identities/meetings.
  Both UI owners finished; coordinator confirms disposable dev QA cleanup0.
  Permanent demo/user data remain untouched; do not clean unrelated data.
- Artem owns canonical /meetings UI; Ivan owns player/capture/Honcho tools.
  PR124 merged4c67498; user authorized /workspace and revoked the prior hold.
  Compat resolveda389a6a; PR127 shipped to both hosts at3676470, health/deploy PASS.

## Released code and bounded evidence

- [Runtime wave delta](../memories/RELEASE-94-runtime-wave.md) owns the new facts.
  Other notes retain their footer audit boundary; incoming API/DB/WEB-60 snapshots
  describe isolated work, now merged inb435586 but awaiting combined runtime proof.
- PR119 merged main1adbcb5 (tree=420aac5): published ready tips, #12 UI, #15 inbox,
  #69 extraction/R3, #113 GPU, #101 and player fixes 89525fa/7d57445, README updates.
  Original Devin sources 590aaf4 are preserved in its ancestry.
- [Latest runtime receipt: #94](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94) resolves current hosts;420/1adb remain historical processing proofs.
  Both hosts3676470 passed; devfd8e936 deployed/healthy. Newb435586 build/deploy in progress; UI proof pending.
  Includes9197250 canvas0009/session mock/landing/capture and12abf23 player/review integration.
- [Prod1adbcb5 extraction PASS](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/113#issuecomment-5794927457):23900ms mixed→39.07s,4segments/2speakers/4turns;
  CUDA/new prompt, empty draft/manualr2/export409, ACL/auth PASS, both QAcleanup0; #113 CLOSED.
- [#113 GPU](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/113#issuecomment-5794753625): actual L4, pinned provenance, cancel/heartbeat cleanup 0;
  case2 observed STT ~16.871s vs CPU149.41095s (~8.9×), Sherpa ~59.060s.
- [#12 browser](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/12#issuecomment-5794699275): mappings/approval/assignee immutability and #101 resume PASS.
  [Final420/prod UI](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794894930): player fixes/solo/resume/briefing/source PASS, console0; #120 reclosed.
- [#15 API/UI](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/15#issuecomment-5794676238): 3→2→1→0→1 polling without reload; issue CLOSED.
  23900ms two-voice job produced four segments/two speakers/four turns.
- Full GPU case2 completed152.047543s vs663.806196s with CPU Qwen; observed
  STT16.805/Sherpa60.888/extract75.548s,18 actions, identical45 segments/timings.
  CPU manualv2 preserved; GPUv1 unreviewed/export409, actualCUDA/cleanup0 verified.

## Remaining limits

1. GPU case2 semantic FAIL: late ten-day/event deadlines still absent; no prompt loops.
2. #70 both TTS runs complete: KK27segments/7actions has quality misses; mixed11/0
   misses all five expected tasks (FAIL). Real human accuracy remains unverified.
3. Prod smoke proves operation, not semantics/performance isolation; dev timings stay dev evidence.
4. External extraction/Honcho settings checked empty on dev; code/default-disabled
   capability is not permission or activation. Do not claim external consent.

## Domain index

- [API](../memories/API-01-backend-architecture.md), [recordings](../memories/API-02-meetings-recordings.md), [DEV mocks](../memories/API-03-mock.md), [jobs/results](../memories/API-10-processing-results.md), [review/export](../memories/API-13-review-export.md), [canvas API](../memories/API-60-meeting-canvas.md)
- [Auth](../memories/AUTH-01-auth-access.md), [DB](../memories/DB-01-schemas-migrations.md), [canvas DB](../memories/DB-60-meeting-canvas.md), [stack](../memories/STACK-01-stack-layout.md)
- [Deploy](../memories/INFRA-01-environments-deploy.md), [capture kernel](../memories/INFRA-22-CAPTURE.md), [connectors/Honcho](../memories/INFRA-23-connectors.md), [models](../memories/MODELS-01-stt-pipeline.md)
- [Workspace](../memories/WEB-01-frontend.md), [canvas UI](../memories/WEB-60-meeting-canvas.md), [player](../memories/WEB-19-player.md), [transcript](../memories/WEB-20-transcript-sync.md), [capture](../memories/WEB-21-CAPTURE.md), [media cancellation](../memories/WEB-102-media-abort.md)
- [Team](../memories/TEAM-01-workflow.md), [proof](../memories/TEST-01-verification.md)
