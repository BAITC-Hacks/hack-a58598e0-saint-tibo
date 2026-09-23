# NEXT-SESSION — Saint Tibo synchronization wave

Snapshot: 2026-09-23. Refresh GitHub refs/claims before acting.
Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited dev tree, not runtime).

## Current law and ownership

- Scope: Saint Tibo only. Preserve other worktrees/WIP; no secrets, user audio
  or transcripts in git/issues. No repository test/linter suites this wave.
- Feature → personal lane → dev with --no-ff; no history rewriting.
  Parent task `01a0cddc-2298-7f33-b1be-f11b490b1036` alone schedules this
  wave's shared merges/deploys; production release is separate.
- Serena writer: task `01a0cde1-9c17-7a11-a7eb-853644b202c2`,
  `feat/94-serena-sync-wave`, only memories and this file; explicit transfer
  confirmed by parent. Historic session ownership claims are not authority.
- Read-only integration audit: `01a0cde1-9c17-7a11-a7eb-851336afbcf2`.
- #13/#14 worker: `01a0cde1-9c16-70a0-ab79-4fb4ede149b0`,
  `feat/13-reviewed-export`; results/exports, migration, generated contract,
  related docs. Parent owns `docs/current-state.md` and `docs/integration-plan.md`.
- Artem owns UI/design/#83–85; Ivan owns player/capture/#95/#96.
  API-03-mock.md filename is reserved by #85. Check issue claims, not this
  snapshot, before taking work. #69 separate WIP is preserved.

## Done and evidence boundaries

- Fetched main `62b137d`, dev `f8cf4da`, danil `cae7b9d`.
- Main has recording/media API. Dev adds durable jobs `bcc02e5`,
  offline STT/results `b7d7a52`, export renderer `2341256`,
  local player/capture/platform prototypes and guarded dev access.
- Last independent Danil LIVE-OK: `58ee53734cdcbad1e50cd589425ec090adac3261`
  ([#94 proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510)).
  Later dev diff through f8cf4da is docs/memories only; no fresh deployment
  or server check was performed by this Serena task.
- RU STT succeeded; interrupted-job retry completion, KK/mixed accuracy,
  diarization, extracted results and full product UI acceptance remain open.

## Critical next work

1. Parent integrates ready #13/#14 only after review/build/scenario evidence,
   schedules dev deploy/live QA, then signals Serena to re-audit exact commit.
2. Refresh API-13/API-10/DB-01/WEB-01 and this snapshot after that signal;
   replace WIP claims only with actual integrated code and bounded proof.
3. Preserve #69 local LLM WIP; no automatic extraction claim without evidence.
   #12 diarization, #15 reminders, #81 trusted sink and #11/#70/#89 quality
   remain assigned/backlogged work, not implied authorization for this task.
4. Keep #95/#96 and UI branches separate until their owners/coordinator
   establish readiness. Never import cloud audio/text processing defaults.
5. For broader handoff read #94, `docs/session-handoff.md` and current parent
   state docs when present. No user input is currently required for this sync.

## Domain index

- [API architecture](../memories/API-01-backend-architecture.md), [recordings](../memories/API-02-meetings-recordings.md), [jobs/results](../memories/API-10-processing-results.md), [review/export](../memories/API-13-review-export.md)
- [Auth](../memories/AUTH-01-auth-access.md), [database](../memories/DB-01-schemas-migrations.md), [stack](../memories/STACK-01-stack-layout.md)
- [Deployment](../memories/INFRA-01-environments-deploy.md), [capture kernel](../memories/INFRA-22-CAPTURE.md), [connectors](../memories/INFRA-23-connectors.md), [local models](../memories/MODELS-01-stt-pipeline.md)
- [Frontend](../memories/WEB-01-frontend.md), [player](../memories/WEB-19-player.md), [transcript sync](../memories/WEB-20-transcript-sync.md), [browser capture](../memories/WEB-21-CAPTURE.md)
- [Team/ownership](../memories/TEAM-01-workflow.md), [verification](../memories/TEST-01-verification.md)
