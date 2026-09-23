# Saint Tibo: remaining integration plan

Owner: Danil (rldyourmnd). The verified GPU baseline is `1adbcb5`; [PR #127](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/pull/127) subsequently shipped the authorized PR #124 editor and draft/export guards to both hosts as `3676470`. Ivan's follow-up `12abf23` integrates that editor into /player and redirects /workspace. Exact final deployment revisions and the changed-screen proof are in the [coordination #94 receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94); ready teammate source is included. [Current facts](current-state.md), [DEMO](../DEMO.md).

## Delivered release

The full private recording → GPU STT → diarization → GPU draft pipeline runs through the real application. Review, approval reset/CAS, PDF/DOCX, confirmed speaker labels, persistent/solo playback, person briefing, saved overview and automatically refreshed curator reminders are integrated. #14, #15, #104, #105, #107 and #120 have completed evidence. Actual GPU case-two processing took 152.05 seconds; automatic content is still a draft.

No extra model, workflow engine, external messaging channel or organizational-memory system is needed to demonstrate this release.

## Narrow remaining scope

1. **Protocol accuracy (#69/#13):** preserve evidence and unknowns; correct final deadline changes and event-based deadlines. The latest actual GPU result still misses both. Review the saved artifact before choosing a further small change; do not launch unbounded prompt/model loops or claim perfect extraction.
2. **Multilingual acceptance (#11/#70, related #12):** retain the explicit references and outcomes of the two longer synthetic checks. Synthetic TTS does not satisfy native-speaker natural-speech acceptance. Names, overlap and language switching need honest limits.
3. **Specific lifecycle/capture gaps (#10/#102/#106):** finish only the outstanding issue acceptance when that capability is needed for the demo. Broader Teams/Meet/Zoom participation and enterprise policy work remain separate scope.
4. **Handoff (#26/#94):** keep DEMO, current-state and Serena aligned with the actual deployed release. Close issues on their own complete evidence; do not reopen a colleague's completed issue solely because another agent has not repeated a scenario.

Optional provider/Honcho code stays configured off. The supported demonstration uses the private full-processing path and explicit review. Reference projects contributed ideas only, not credentials, user data, branding or copied private implementation.

## Integration discipline

- Fetch fresh refs, preserve other work, merge ready branches with history intact and use one deployment owner.
- Build the combined candidate and exercise only its changed real path. Keep existing proof; repeat only after a relevant change, actual failure or unresolved concern.
- Pin the release head, merge to main and deploy exact origin/main. Documentation-only sync can follow without expanding feature scope.
- Keep one migration head and actual model/prompt provenance. No force-push, squash, rebase or blind cleanup.
- Speaker labels are anonymous; action assignees are a separate decision. Unknown names/deadlines stay unknown, due text stays literal, evidence stays in the same result.
- Edits clear approval unless explicitly confirmed. CAS rejects stale saves; reprocessing preserves history.
- No cloud inference fallback or meeting content in logs. Maintain the single L4 within the $25 cap, preserve needed artifacts before stopping it.
- Preserve permanent demo accounts and the user's recordings; delete only named, owned QA fixtures.
