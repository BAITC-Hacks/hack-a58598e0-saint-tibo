# NEXT-SESSION — Saint Tibo synchronization wave

Snapshot: 2026-09-23. Refresh GitHub refs/claims before acting.
Last commit: `97e804ed7c941408ecf22145d72497214b5002c4` (audited dev, live pending).

## Current law and ownership

- Scope: Saint Tibo only. Preserve other worktrees/WIP; no secrets, user audio
  or transcripts in git/issues. No repository test/linter suites this wave.
- Feature → personal lane → dev with --no-ff; no history rewriting.
  Parent coordinator exclusively schedules this wave's shared merges/deploys.
  Current-wave main/prod release is user-authorized after QA; #69 is not a gate.
  Keep internal task IDs/local paths out of issue comments.
- Serena writer: `feat/94-serena-reviewed-export`, only memories and this
  explicitly tracked index; broad ignore rules remain unchanged.
- #13/#14 implementation worker handed off completed feature0203111.
  #69 continuation `feat/69-extraction-continuation` owns extractor/benchmark,
  coordinated processing/results integration and generated contract updates;
  original Devin WIP remains preserved. Personal user chat is not a worker.
- Parent owns `docs/current-state.md`, `docs/integration-plan.md` and
  deployment scheduling. Independent verifier owns the targeted live receipt.
- Artem owns UI/design/#83–85; Ivan owns player/capture/#95/#96.
  API-03-mock.md name is reserved by #85. Recheck current issue claims.
- Finish bounded slices and narrow remaining acceptance; avoid new subsystems.

## Done and evidence boundaries

- Fetched main `62b137d`, danil `5427d19`; dev34062c4 adds synthetic player
  frontend/docs only after backend integration97e804e.
- Main has recording/media API. Dev includes jobs `bcc02e5`, local STT
  `b7d7a52`, protected player/timeline through `a2cfe28`, first Serena sync
  `2ae91bc` and reviewed results/export `0203111` with migration0005.
- Last independent Danil LIVE-OK is still `58ee537`
  ([earlier receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510)).
  Coordinator reports DEPLOY-OK97e804e/healthy/readiness; final live GO pending.
- [#14 local proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793605774):
  builds, real local DB/HTTP scenarios and rendered RU/KK/long-table documents.
  Identity substitution means this is not live JWT/download acceptance.
- Human review preserves completed_stage=transcribe; no automatic extraction
  or completed #13 quality claim. #95 reported Ivan deploy/HTTP probes only.

## Critical next work

1. Independent verifier exercises exact97e804e JWT review/save/conflict/owner
   ACL/export and scoped cleanup; parent sends bounded live GO/evidence.
2. Parent schedules34062c4 deploy/UI proof then current-wave main/prod release.
   Serena adds exact receipts and pushes only this feature; no deployment here.
3. #69 evaluates local extraction on preserved case material and integrates
   only an accepted draft through existing result flow; no cloud fallback.
4. #12 diarization, #15 reminders, #81 trusted sink, #11/#70/#89 quality and
   server transcript/UI integration remain separate work under their owners.
5. Keep #96 outside minimum scope until its recorded gaps are resolved.
   Current docs and #94 supersede old session claims; no user input needed.

## Domain index

- [API architecture](../memories/API-01-backend-architecture.md), [recordings](../memories/API-02-meetings-recordings.md), [jobs/results](../memories/API-10-processing-results.md), [review/export](../memories/API-13-review-export.md)
- [Auth](../memories/AUTH-01-auth-access.md), [database](../memories/DB-01-schemas-migrations.md), [stack](../memories/STACK-01-stack-layout.md)
- [Deployment](../memories/INFRA-01-environments-deploy.md), [capture kernel](../memories/INFRA-22-CAPTURE.md), [connectors](../memories/INFRA-23-connectors.md), [local models](../memories/MODELS-01-stt-pipeline.md)
- [Frontend](../memories/WEB-01-frontend.md), [player](../memories/WEB-19-player.md), [transcript sync](../memories/WEB-20-transcript-sync.md), [browser capture](../memories/WEB-21-CAPTURE.md)
- [Team/ownership](../memories/TEAM-01-workflow.md), [verification](../memories/TEST-01-verification.md)
