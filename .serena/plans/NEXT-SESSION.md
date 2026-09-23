# NEXT-SESSION — Saint Tibo handoff

Updated: 2026-09-23 (Danil session, post-#9). If this disagrees with
`git status` / `gh issue list` — the repo wins; fix this file.

## Memory index (.serena/memories/)

- `DEVIN-01-team-workflow` — roles, lanes, issue lifecycle, worktrees
- `STACK-01-stack-layout` — pins, repo map, commands, do_not_use
- `INFRA-01-environments-deploy` — servers, manual deploy, secrets
- `API-01-backend-architecture` — request path, module recipe, contracts
- `API-02-meetings-recordings` — #8/#9 slice endpoints, contract entities
- `DB-01-schemas-migrations` — auth vs app schemas, table state
- `WEB-01-frontend` — routes, SDK regen, i18n, open UI lanes
- `MODELS-01-stt-pipeline` — STT candidates, fixtures, privacy rules
- `TEST-01-verification` — gates, live-verify, issue states

## Ground truth right now

- `main` = 62b137d (PR #80): baseline + FULL #9 slice — meetings,
  participants, recording upload (file + live chunks), finalize,
  media Range streaming, same-origin media proxy, migration 0002.
  Prod = manual `deploy.sh saint-prod`; confirm whether the parallel
  session already redeployed saint-tibo.win.
- `dev` = main + this `.serena/` memory set (803850b).
- `danil` lane = #9 content (eca53f9) + memory commit (44684c7);
  dev is ahead by merge shape only — next merge is trivial.
- #9 issue: code shipped to main; check issue comments for the
  `integrated:`/`LIVE-OK` state — close only on live-verified.

## Next actions (Danil lane)

1. #10 Background Processing & Job States — decode→STT→diarize→extract
   pipeline scaffold; unblocks #11→#12→#13→#14→#15→#26 chain.
2. If prod not yet redeployed from 62b137d: integrator run
   `deploy.sh saint-prod` + live check (owner's call).

## Team lanes in flight

- Ivan: #19–25 player/capture/platform joins — media URL ready:
  same-origin `/api/media/meetings/{m}/recordings/{r}` w/ Range.
- Artem: #16–18 UI + #44–48 design system — SDK for meetings already
  regenerated on main (`bun run api:generate` after any API change).

## Traps

- `.serena/` was locally excluded from git — fixed 2026-09-23; other
  clones/worktrees may still have the line in `.git/info/exclude`.
  `.agent/` stays excluded (integrator marker must remain untracked).
- README/docs now describe the recording API as implemented; the older
  "not implemented" framing is gone — trust openapi.json over prose.
- Never create seed/demo accounts on public servers.
