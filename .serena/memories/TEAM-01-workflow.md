# TEAM-01 Team, lanes, and issue workflow

Repo: github.com/BAITC-Hacks/hack-a58598e0-saint-tibo (private —
still: no secrets, tokens, or credentials in git/issues).

## Roles

- Danil `rldyourmnd` — backend + ML pipeline; also the integrator:
  only he merges `dev` → `main` and deploys prod.
- Ivan `R3flector` — task owner: authors and assigns issues.
  Own lanes: recordings, player, meeting-platform integrations.
- Artem `letya999` — UI/UX, branding, design system, landing.

## Issue = source of truth

Assignments and priorities live in issues — check
`gh issue list --assignee @me`, never this file. No issue, no work.
Claim files in an issue comment before editing; one owner per file.

Lifecycle in comments: `implemented` (branch pushed) → `done: <sha>`
(merged to personal lane) → `integrated: <sha>` (merged to dev) →
`LIVE-OK <sha>` (verified live) → closed. Never close on "code written".

## Lanes

`feat/<issue>-<slug>` → personal branch (`danil`/`ivan`/`artem`) →
`dev` → `main`. `--no-ff` merges only; no squash/rebase; never rewrite
shared history. `main` is protected — integrator-only. Each member
merges own lane → `dev` themselves and verifies on own dev server.
Flow detail: `docs/development.md`.

Work happens in separate worktrees off `origin/dev`; never edit inside
a checkout another session is using.
