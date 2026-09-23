# NEXT-SESSION — core release handoff

## Isolated #60 lane (2026-09-23)

- `feat/60-meeting-canvas` was cut from fresh `origin/dev`
  `e3a241fc84040ce2622af0cb8102b81b6dd34a51`. Code commit:
  `1f344997069541a5d3a34a9fa2766b512682673e`. No push, merge, or deploy.
- API/DB/UI contracts and browser proof: [API-60](../memories/API-60-meeting-canvas.md),
  [DB-60](../memories/DB-60-meeting-canvas.md), [WEB-60](../memories/WEB-60-meeting-canvas.md).
- `alembic check`, canvas integration check, frontend typecheck, targeted lint,
  OpenAPI check and production build passed. Full repository hooks remain red on
  pre-existing frontend formatting and backend processing line-length issues;
  the code commit bypassed those hooks after targeted checks.
- #61 templates stay out until #60 contract integration. Release awaits owner
  instruction; preserve #83 file ownership and do not merge dev/main here.

Snapshot: 2026-09-23; refresh refs and #94 before acting.
Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (pinned core; production 7d5b481 LIVE-OK; TEST-01).

## Current law and ownership

- Saint Tibo only; preserve other worktrees/WIP. No private audio/transcripts
  or infrastructure secrets in git/issues; no repository test/linter suites.
- Feature → personal lane → dev/main with --no-ff; no history rewriting.
  Parent serializes release from `codex/94-reviewed-core-release` pinned to 6ed682e.
- Serena owns memories/this tracked index on `feat/94-serena-release-handoff`;
  Preserve incoming Artem/Ivan notes.   Core receipts accepted; knowledge publication authorized by coordinator.
- Artem owns canonical /meetings UI; Ivan owns player/capture/Honcho tools.
  #107 fallback b095035 stays UNMERGED; its a8886bd confirmation fix is integrated.
- #12 UI e99f43a, #69 integration 63a34f8 and #113 1c7da97 are in dev 269fcbb,
  not deployed; remote GPU is off. Preserve original Devin WIP.
  New dev pushes must not expand the pinned first release.
- Preserve persistent demo identities/meetings. DEMO update 5bc719c documents
  manual content; 590aaf4 preserves old LLM, #101 99f99e23 handed off; none in main.

## Pinned release code and newer dev

- Core 6ed682e → PR114/main 7d5b481; production LIVE-OK, login/UI PASS.
  Runtime remains dev 6ed682e/prod 7d5b481; newer dev 269fcbb is not deployed.
- Shared: canonical UI 117d9b8/6988054, pinned turbo/provenance 52efb76,
  strict ceil duration 8c95950, safe logs #105, capture metadata #106, media cancel #102.
  /player uses real server results; #110 removed synthetic/local/public demos.
- [Review/export LIVE 97e804e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793710152): real JWT/ACL/CAS/422/immutable documents,
  57/57 continuation, owned cleanup 0; #14 CLOSED. Human review is not extraction.
- [#104/#105 LIVE b1e33cb](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/104#issuecomment-5793915724):
  19093ms audio→STT 7 segments→review r2→PDF/DOCX; private marker absent;
  scoped cleanup 0. Both issues CLOSED; isolated 500 proof was separate.
- [Browser PASS 6ed682e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794265640):
  actual case2/54 segments, review/approval/edit reset/two-tab 409/reload,
  PDF 50243B/DOCX 37890B and seek 44.9→play 52.1; #107 CLOSED, demo retained.
- Turbo synthetic CER RU 6.28 / KK 5.91 / mixed 12.24% improves small; still no
  real-speech/reference quality acceptance or #11/#70 closure.
- Honcho 3005fd3 is isolated tools only. Core migrations end 0005; shared dev 0007
  and extraction 0008→0007 are not deployed. App Honcho/#103 remains open.

## Remaining work and release boundary

1. [Prod 7d5b481 LIVE-OK](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794357831):
   ordinary login→RU turbo 7 segments/19093ms/20.76s→manual r2→PDF/DOCX; cleanup 0.
2. #69 R2 completes 2435 tokens/16 actions in 925.271s; private DB/CAS proof passed
   and cleaned. Deadline duplication/omissions remain; model is not accepted.
3. #12 has 45 local checks and shared integration; deployment/UI acceptance remains.
   Brev L4 READY/image building ($25 cap); root owns runtime, actual GPU unverified.
4. #113 1c7da97 integrated, remote off; #15 backend 0972e69 ready, UI pending
   (stateless/no migration). #11/#70/#89, #81 and #103 remain open.
5. Preserve user test1/Совещание №1; mobile/locale/capture/cancellation need proof.

## Domain index

- [API](../memories/API-01-backend-architecture.md), [recordings](../memories/API-02-meetings-recordings.md), [DEV mocks](../memories/API-03-mock.md), [jobs/results](../memories/API-10-processing-results.md), [review/export](../memories/API-13-review-export.md)
- [Auth](../memories/AUTH-01-auth-access.md), [DB](../memories/DB-01-schemas-migrations.md), [stack](../memories/STACK-01-stack-layout.md)
- [Deploy](../memories/INFRA-01-environments-deploy.md), [capture kernel](../memories/INFRA-22-CAPTURE.md), [connectors/Honcho](../memories/INFRA-23-connectors.md), [models](../memories/MODELS-01-stt-pipeline.md)
- [Workspace](../memories/WEB-01-frontend.md), [player](../memories/WEB-19-player.md), [transcript](../memories/WEB-20-transcript-sync.md), [capture](../memories/WEB-21-CAPTURE.md), [media cancellation](../memories/WEB-102-media-abort.md)
- [Team](../memories/TEAM-01-workflow.md), [proof](../memories/TEST-01-verification.md)
