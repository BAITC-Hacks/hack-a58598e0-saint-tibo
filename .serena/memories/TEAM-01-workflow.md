# TEAM-01 Team, ownership and integration

## Current Behavior

- Project: BAITC-Hacks/hack-a58598e0-saint-tibo only. Repository privacy
  does not authorize secrets, credentials or user data in commits/issues.
- Danil (`rldyourmnd`): backend/ML and prod integration.
  Ivan (`R3flector`): recording/player/platform integrations.
  Artem (`letya999`): UI/UX, branding, design system and landing.
- Live issue assignees and claim comments own the queue. Danil agents work
  only his issues; unassigned backlog is not permission to implement it.
- Claim exact files before editing. One writer per file, separate worktrees
  from fresh origin/dev; preserve others' tracked/untracked/ignored WIP.
- Feature work: `feat/<issue>-<slug>` → personal lane → dev → main.
  Existing `codex/<issue>-*` features remain valid; Ivan uses `ivan/lane`.
  Named/shared branches are integration targets, not implementation checkouts.
- Merge with `--no-ff`; never squash/rebase/force or rewrite shared history.
  Normal members integrate their own lanes; this wave explicitly centralizes
  integration and deployment in the parent coordinator.
- Lifecycle evidence: implemented branch → `done: SHA` personal lane →
  `integrated: SHA` dev → `LIVE-OK SHA` → issue closure when scope is met.
  A partial delivered slice does not close broader acceptance.
- Push is not deployment. Danil alone releases agreed dev→main/prod.
  See `docs/development.md`, `docs/session-handoff.md`, INFRA-01.
- Memories have one explicitly assigned writer. Record current ownership
  in NEXT-SESSION; historical session prose is evidence, not fresh authority.

## Known Gaps

- #94 remains open until consolidation/knowledge handoff scope is complete.
  Current wave tasks and pending integration are in NEXT-SESSION.
- UI, player/capture, local LLM WIP and backend review/export have distinct
  owners; don't take their files because a dependent screen is missing.
- Do not archive/remove worktrees or clean ignored files without checking
  unique commits, local materials and active ownership.

Last commit: `a2cfe28c10b214a8189b8c140d9d6b31167bf27a` (audited tree, 2026-09-23; not a live assertion).
