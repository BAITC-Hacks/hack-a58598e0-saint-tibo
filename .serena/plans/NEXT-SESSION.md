# Handoff — issue #20

Current law: work only in this worktree, no push/shared-branch merge/deploy;
no personal media/text in git or external services. No AppShell/editor/API edits.

## Done

- Branch `ivan/20-transcript-sync`, based on origin/dev `007b2c1`.
- Local #19 dependency merged preserving its commits (`e81429d`, `963e9cb`).
- `16cd152`: transcript hook, optional read-only panel, synthetic demo, ru/kk/en.
- `818b7d9`: integration guide + exact synthetic browser proof.
- Read `.serena/memories/WEB-20-transcript-sync.md` for domain state.
- Passed typecheck/check/lint:fsd/i18n:check/build and browser acceptance on fixture.

## Next

- Parent can merge `ivan/20-transcript-sync` with `git merge --no-ff` into its
  own clean player branch. No cherry-pick of the dependency merge is required.
- Coordinate integration with Artyom; mount per recording/result version;
  use real result segments and action source IDs from the agreed contract.
- Verify the authorized real-data path after API/editor land. Keep #20 open.
- Push/deploy require the owner's go. No request for approval is pending here.

The local synthetic demo can run at http://127.0.0.1:3020/transcript-demo.
Commands and disposable configuration are in docs/transcript-sync.md.
