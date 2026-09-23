# DEVIN-01 Team, lanes, and issue workflow

Repo: github.com/BAITC-Hacks/hack-a58598e0-saint-tibo (public staging —
no secrets, tokens, or strategy in git/issues).

## Roles (verified 2026-09-23)

- Danil `rldyourmnd` — backend + ML pipeline; also the integrator:
  only he merges `dev` → `main` and deploys prod (`saint-prod`).
- Ivan `R3flector` — task owner: authors and assigns all issues.
  Own lanes: recordings, player, meeting-platform integrations.
- Artem `letya999` — UI/UX, branding, design system, landing.

## Issue = source of truth

Lifecycle in comments: `implemented` (branch pushed) → `done: <sha>`
(merged to personal lane) → `integrated: <sha>` (merged to dev) →
`LIVE-OK <sha>` (verified live) → closed. Never close on "code written".
Claim files in an issue comment before editing; one owner per file.

Assignment snapshot 2026-09-23:
- Danil: #8–15, #26 (contracts → meetings backend → jobs → STT →
  diarization → action items → export → reminders → E2E validation).
- Ivan: #7 (master plan), #19–25 (player, recording capture,
  Teams/Zoom/Meet/Telemost, extension).
- Artem: #16–18 (meeting UI), #40–48 (landing, design system).
- Unassigned: #31, #34–39 (closed-env/security track).

## Lanes

`feat/<issue>-<slug>` → `<user>` (`danil`/`ivan`/`artem`) → `dev` → `main`.
`--no-ff` merges only; no squash/rebase; never rewrite shared history.
`main` is hook-protected: pushes and `gh pr merge` denied without the
untracked `.agent/orchestrator` marker (integrator's checkout only).
Each member merges own lane → `dev` themselves, verifies on own server.

## Local worktrees (this machine, 2026-09-23)

- `hackathon` — `main` (this checkout, prod-aligned)
- `hackathon-integration` — `dev`
- `hackathon-meetings` — `codex/9-meeting-storage` (#9 code, e9a9f75)
- `hackathon-media-proxy` — `codex/9-media-proxy` (b538b1e)
- `hackathon-runtime-docs` — `codex/9-runtime-docs`

Never edit inside a worktree another session is using.
