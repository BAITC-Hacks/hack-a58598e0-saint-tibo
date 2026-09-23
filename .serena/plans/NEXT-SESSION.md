# Capture #21 handoff

Branch: `ivan/feat-21-local-capture`; base: origin/dev 436eab0.
Scope of this handoff is the local capture slice only.

## Current law

Use the published generated SDK when #9 exists. Audio/meeting text stays local
or self-hosted. Never claim a platform participant from browser source capture.
No push/merge/deploy/issue close without the owner's next instruction.
Parent owns player #19/#20 and deploy coordination; shared layouts stay untouched.

## Done

- a35e16e: local browser capture, bounded chunks, retry adapter, RU/KK/EN UI.
- e2313d8: `docs/capture.md`, integration contract and honest acceptance gaps.
- Passing typecheck, pre-commit check, i18n (91 keys), existing tests (7/7), build.
- Chrome synthetic capture/playback/mixing and error/cleanup/retry checks passed.
- Temporary test page and server removed/stopped; no demo media in Git.

## Next

Parent can integrate local commits into their lane after reviewing ownership.
Wire SDK #9 callbacks to a stable recording_id; UI transport currently disconnected.
Verify actual picker on demo OS, backend duplicate/reordered/missing chunks and
network interruption, final media_url in #19; then coordinate live acceptance.
Issue #21 remains open until all acceptance checks pass.

Domain memory: `.serena/memories/WEB-21-CAPTURE.md`.
