# NEXT-SESSION — Saint Tibo handoff

Updated: 2026-09-23 (Danil session). If this disagrees with
`git status` / `gh issue list` — the repo wins; fix this file.

## Memory index (.serena/memories/)

- `DEVIN-01-team-workflow` — roles, lanes, issue lifecycle, worktrees
- `STACK-01-stack-layout` — pins, repo map, commands, do_not_use
- `INFRA-01-environments-deploy` — servers, manual deploy, secrets
- `API-01-backend-architecture` — request path, module recipe, contracts
- `API-02-meetings-recordings` — #8/#9 slice, endpoints, pending merges
- `DB-01-schemas-migrations` — auth vs app schemas, table state
- `WEB-01-frontend` — routes, SDK regen, i18n, open UI lanes
- `MODELS-01-stt-pipeline` — STT candidates, fixtures, privacy rules
- `TEST-01-verification` — gates, live-verify, issue states

## Ground truth right now

- `main` (prod saint-tibo.win) = bac1c51: auth + workspace baseline,
  contracts/case docs. NO domain backend.
- `dev` == `danil` = main + case-audio docs (007b2c1).
- `codex/9-meeting-storage` e9a9f75 — full #9 backend slice
  (meetings/participants/recordings/chunks/media) + `codex/9-media-proxy`
  b538b1e. Deployed on saint-dev-danil. PENDING: merge into `danil`,
  then `danil` → `dev`, live-verify, comment on #9.
- Contract/STT docs already merged to main (#8 draft, #11 feasibility,
  #32 audio).

## Next actions (Danil lane)

1. Verify e9a9f75 live on dev-danil → merge to `danil` → `dev`
   (see API-02 for what to exercise: resend dedup, Range seek, 404s).
2. #10 jobs worker — unblocks STT (#11) → diarization (#12) →
   extraction (#13) → export (#14) → reminders (#15) → E2E (#26).

## Team lanes in flight

- Ivan: #19–25 player/capture/platform joins — needs same-origin
  media URL (ready on codex/9-media-proxy).
- Artem: #16–18 UI + #44–48 design system — consumes openapi.json;
  regenerate SDK after #9 merge (`bun run api:generate`).

## Traps

- `.serena/` was locally excluded from git — fixed 2026-09-23 so
  memories share via repo. `.agent/` stays excluded (integrator marker).
- README "not implemented" list describes `main`; #9 code lives on
  the codex branch until merged — don't duplicate the work.
- Never create seed/demo accounts on public servers.
