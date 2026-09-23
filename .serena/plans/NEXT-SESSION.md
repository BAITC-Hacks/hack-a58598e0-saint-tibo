# NEXT-SESSION — Saint Tibo synchronization wave

Snapshot: 2026-09-23. Refresh GitHub refs/claims before acting.
Last commit: `ab3d3312c3bafb3892bde93539383cea9e48b6de` (audited tree; live evidence below).

## Current law and ownership

- Saint Tibo only. Preserve other worktrees/WIP; no private data in git/issues.
  No repository test/linter suites this wave.
- Feature → personal lane → dev with --no-ff; no history rewriting.
  Parent coordinator schedules shared merges/deploys. Current-wave main/prod
  Release is user-authorized after QA; #69 is not a gate. No internal task IDs/local paths in issue comments.
- Serena writer: `feat/94-serena-reviewed-export`, only memories and this
  deliberately tracked index; broad ignore rules remain unchanged.
- #13/#14 feature `0203111` is handed off. #69 continuation
  `feat/69-extraction-continuation` owns extractor/benchmark and coordinated
  processing/results/codegen updates; original Devin WIP remains preserved.
- Parent owns current-state/integration-plan docs and release scheduling;
  independent verifier owns live receipts. Personal user chat is not a worker.
- Artem owns UI/design/#83–85; Ivan owns player/capture/#95/#96/#98.
  API-03-mock.md name is reserved by #85. Recheck current issue claims.
- Finish bounded slices and narrow remaining acceptance; avoid new subsystems.

## Done and evidence boundaries

- Fetched main `62b137d`, danil `5427d19`, dev `ab3d331`.
  Dev includes #13/#14/migration 0005 at `97e804e`, synthetic player
  `34062c4` and marker overflow fix `4775b8c` integrated at `ab3d331`.
- Independent [review/export LIVE-OK](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793710152)
  is exact `97e804ed7c941408ecf22145d72497214b5002c4` on Danil dev.
  Real JWT/ACL/save/conflict/422 validation and immutable historical JSON/
  decoded PDF/DOCX passed; r3 draft blocked, r4 approved current exported.
  First run: 54 passes stopped on QA-only whitespace; continuation: 57/57 passed;
  own app/auth cleanup counts 0. RU/KK/multipage layout also visually checked.
- #14 CLOSED for backend download/renderer; UI buttons remain Artem's work.
  Human review keeps completed_stage=transcribe; #13 auto-extraction stays open.
- Earlier RU STT/storage proof remains `58ee537`; it is a separate scenario.
  CT2 small synthetic mixed CER 53.16%/Kazakh omissions block a quality pass;
  RU 7.11%/KK 12.60% smoke is not reference-based real-meeting acceptance.
- New player frontend still needs scheduled dev/browser proof before release.
  No production deployment or current-wave UI success is claimed here.

## Critical next work

1. Parent deploys the selected current player tip, verifies browser behavior,
   then integrates/releases the authorized wave to main/prod and records #94.
2. Serena refreshes final release receipts only on that signal; feature-only
   push, no deployment or shared-branch merge from this memory worktree.
3. #69 local extraction continues separately; stronger STT candidate evaluation
   must not be confused with accepted model deployment or delay this release.
4. #12 diarization, #15 reminders, #81 sink, #11/#70/#89 quality and server
   transcript/UI integration remain scoped work. Keep #96 outside the minimum.

## Domain index

- [API architecture](../memories/API-01-backend-architecture.md), [recordings](../memories/API-02-meetings-recordings.md), [jobs/results](../memories/API-10-processing-results.md), [review/export](../memories/API-13-review-export.md)
- [Auth](../memories/AUTH-01-auth-access.md), [database](../memories/DB-01-schemas-migrations.md), [stack](../memories/STACK-01-stack-layout.md)
- [Deployment](../memories/INFRA-01-environments-deploy.md), [capture kernel](../memories/INFRA-22-CAPTURE.md), [connectors](../memories/INFRA-23-connectors.md), [local models](../memories/MODELS-01-stt-pipeline.md)
- [Frontend](../memories/WEB-01-frontend.md), [player](../memories/WEB-19-player.md), [transcript sync](../memories/WEB-20-transcript-sync.md), [browser capture](../memories/WEB-21-CAPTURE.md)
- [Team/ownership](../memories/TEAM-01-workflow.md), [verification](../memories/TEST-01-verification.md)
