# NEXT-SESSION

Current law: Case requires self-hosted audio/text processing and a deployment possible in the customer's closed contour. Issues are the task source of truth. Ivan owns #19–25; Artem owns UI/branding; Danil owns backend, media, models and exports. Do not mention local reference projects in public artifacts. The ignored `shared/` contains user demo recordings and PDF examples; do not commit or deploy it. The two `input-audio/` fixtures on `origin/dev` were explicitly contributed by the owner through issue #32. This branch has local commits and no push to shared branches.

Done in this branch:

- `e81429d`, `963e9cb`: local-file player and integration guide.
- `9679c83`: merged `origin/dev` at `436eab0`, including `docs/meeting-contract.md` and STT notes.
- `dc836a1`: aligned player callbacks and guide to integer-ms `media_url` contract.
- `f999186`, `214bfdd`, `ea7527a`: connector research and Recall.ai/Meeting BaaS assessment, including Compose caveat. Decisions are in issue #22.
- `f999186` deployed to `https://dev-ivan.saint-tibo.win` and browser-proven with synthetic media. App also runs locally at `http://localhost:3001/player` in Ivan's isolated stack.
- `59a075f`, `190900d`, `ceca109`: imported #22 URL policy and bounded provider-neutral lifecycle from the worker branch. Its 26 synthetic scenarios passed with Bun 1.4.2; strict TypeScript 7.0.2 and diff check passed in the worker worktree. The coordinator still needs to run the appropriate integration gate after merge. No real platform join/audio was proved. Read `.serena/memories/INFRA-22-CAPTURE.md` and `tools/meeting-capture/README.md` for interface details.

Work in separate Codex worktrees: #21 local/live capture (`ivan/feat-21-local-capture`), #20 transcript sync (`ivan/20-transcript-sync`), #23 Teams browser participant (new worker). Inspect each task's status and commit before integration; avoid overlapping files. #22 lifecycle was merged locally, but issue remains open.

Next: integrate Danil's protected media backend/proxy when #9 lands, then test owner ACL, Range and one real authorized recording with #19. Review #20/#21/#23 worker commits before merging locally. #23 should reuse only relevant browser-join/audio behavior from the authorized local working example; never publish its source path or private data. For #22–25, live platform proof needs a controlled meeting and access. Meeting BaaS requires vendor images/access and full in-contour infrastructure; its documented path is Kubernetes, a Compose port remains unproven. Keep issues open until verified. Re-fetch `origin/dev` and peer branches before integration. The repo-monitor heartbeat checks for useful changes every 15 minutes and does not merge automatically.
