# Saint Tibo: integration and delivery plan

Owner: Danil (`rldyourmnd`). Coordination: [#94](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94).
This plan implements only Danil's assigned features. Artem owns UI/design;
Ivan owns the player and meeting-platform integrations.

## Current wave

1. Audit every local worktree and remote tip before changing shared refs.
   Preserve uncommitted, untracked and ignored material; no cleanup is needed
   to start a clean task. Distinguish ancestry from feature acceptance.
2. Deliver #13/#14 as one coherent backend slice: owner-scoped review,
   revision conflict handling, immutable reviewed snapshots, evidence links,
   and PDF/DOCX downloads from a selected reviewed revision. Extend the existing
   result model and renderer. Do not introduce a second result store or fake
   automatic extraction while #69 is unfinished.
3. Publish the real API paths and regenerate OpenAPI/TypeScript SDK in the
   same feature. Notify the UI's coordination issues of differences from the
   temporary mock adapter; leave Artem's components under his ownership.
4. Merge ready feature → `danil` → fresh `dev` with history-preserving merges.
   Integrate teammates' already-published shared changes without silently
   dropping their work. Only one task deploys `dev-danil` at a time.
5. Build and deploy the exact integrated commit. Independently exercise
   authenticated review/save/reload, stale revision rejection, invalid or
   foreign evidence rejection, owner isolation and both export formats.
   Check RU/KK text and actual document rendering. Remove only data created
   for this verification. Repository test suites remain disabled by the owner.
6. Refresh all Serena domains and the next-session index against the final
   code, issues and live receipt. Commit knowledge separately. Mark partial
   features accurately and release claims only after a durable handoff.

Production is a separate release boundary. A successful dev slice is not a
claim that the complete case is ready. Keep `main` on its established release
until the candidate and its remaining limitations have been evaluated.

## Next Danil product slices

| Order | Work | Exit evidence |
| --- | --- | --- |
| 1 | Continue preserved #69 work; connect accepted local extraction to #13 | Real case evaluation of owners, deadlines, corrected decisions and source IDs; no cloud requests or invented unknowns |
| 2 | #12 diarization and participant confirmation | Stable speaker labels and human-confirmed identities; speaker and action assignee remain distinct |
| 3 | #11/#70 RU, KK and mixed-language quality | Suitable recordings with separate human references; measured results, not locale labels |
| 4 | #26 complete case walkthrough and reproducible README | A new operator runs recording → transcript → reviewed actions/summary → downloadable minutes |
| 5 | #15 curator reminders | Upcoming/overdue reminder from a confirmed action item without unwanted external disclosure |

Dependencies can overlap in isolated branches after file claims are agreed.
Do not let optional organizational memory, extra channels or unbacked screens
displace completion of the required path. The README/reproducibility criterion
has the same 25-point weight as implementation in the case rubric.

## Contract requirements that must survive integration

- Unknown assignee/deadline remains unknown. A department may be the assignee.
- Preserve `due_text`; normalize only from explicit meeting date/timezone and
  supported meaning. Event-based or contradictory deadlines stay explicit.
- Validate source segments against the same recording/result, derive playback
  time from real segments, and preserve evidence for later deadline corrections.
- Concurrent review must reject stale revision; reprocessing must not destroy
  an already reviewed snapshot or change an exported historical revision.
- A rendered file must exist and be valid before export is called successful.
- User content remains data, including text that resembles model instructions.
- Local/self-hosted inference has no external fallback; logs exclude meeting
  text and secrets. Browser mocks must never masquerade as model output.

## Coordination rules

Use fresh GitHub assignees and file claims, not an old chat's plan. Feature
workers push only their branch; the coordinator serializes shared integration
and deployment for this wave. The Serena worker writes knowledge only. The
independent verifier changes neither product code nor deployment settings.

Evidence belongs in the relevant issue with exact SHA, URL, exercised scenario,
remaining limits and cleanup result. Keep #10/#11/#13 open when their broader
acceptance is incomplete. Close #14 only after real reviewed-version downloads
and document checks pass; a renderer-only smoke is insufficient.

The administrator-only GitHub merge-settings discrepancy and held Ivan branches
are recorded in [current-state.md](current-state.md). No force-push, squash,
rebase, blind worktree deletion, or removal of license/provenance records is
part of this plan.
