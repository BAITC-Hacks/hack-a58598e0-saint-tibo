# NEXT-SESSION

Current law: Case requires self-hosted audio/text processing and a deployment possible in the customer's closed contour. Issues are the task source of truth. Ivan owns #19–25; Artem owns UI/branding; Danil owns backend, media, models and exports. Do not mention local reference projects in public artifacts. The ignored `shared/` contains user demo recordings and PDF examples; do not commit or deploy it. The two `input-audio/` fixtures now on `origin/dev` were explicitly contributed by the owner through issue #32.

Done in this branch:

- `e81429d`, `963e9cb`: local-file player and integration guide.
- `9679c83`: merged `origin/dev` at `436eab0`, including `docs/meeting-contract.md` and STT notes.
- `dc836a1`: aligned player callbacks and guide to integer-ms `media_url` contract.
- `f999186`, `214bfdd`: connector research and Recall.ai/Meeting BaaS assessment. Both decisions are recorded in issue #22.
- `f999186` deployed to `https://dev-ivan.saint-tibo.win` and browser-proven with synthetic media. App also runs locally at `http://localhost:3001/player` in Ivan's isolated stack. Local branch is `codex/19-meeting-player` and has not been pushed.

Work in separate Codex worktrees: #21 local/live capture (`ivan/feat-21-local-capture`), #20 transcript sync (`ivan/20-transcript-sync`), #22 provider-neutral connector lifecycle (`ivan/22-capture-lifecycle`). Inspect each task's status and commit before integration; avoid overlapping files.

Next: integrate Danil's protected media backend/proxy when #9 lands, then test owner ACL, Range and one real authorized recording with #19. Review #20/#21/#22 worker commits before merging locally. For #22–25, live platform proof needs a controlled meeting and access; Meeting BaaS self-hosting additionally needs vendor charts/images and full in-contour infrastructure. Keep those issues open until verified. Re-fetch `origin/dev` and peer branches before integration. The repo-monitor heartbeat checks for useful changes every 15 minutes and does not merge automatically.

Handoff commit: this file is the final separate documentation commit after `214bfdd`.
