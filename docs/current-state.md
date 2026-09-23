# Saint Tibo: verified project state

Snapshot: 2026-09-23. Refresh remote refs and [#94 receipts](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94) before acting. A Git push never deploys an environment.

## Released scope

Saint Tibo builds a local meeting secretary: recording → transcript → evidence-backed actions and summary → human review → exported minutes. The [case](case.md) requires RU/KK/mixed speech, diarization, responsibilities/deadlines, PDF/DOCX and curator reminders. Meeting inference remains self-hosted.

The first integrated release is `main=7d5b481`, deployed to production after its history-preserving merge in [#114](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/pull/114). Its tree is the verified dev snapshot `6ed682e`. The release was pinned while new diarization commits continued arriving on dev; none were discarded. [Production receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794357831): ordinary login, actual turbo STT, manual revision, PDF/DOCX and scoped cleanup all passed. The 19.093-second fixture produced seven segments in 20.76 seconds including queue/polling. The production demo account and the user's separate test1 meeting are preserved.

The canonical application is `/meetings`; the root shows today's overview. [DEMO.md](../DEMO.md) contains dedicated ordinary demo accounts and steps. The separate `/workspace` fallback remains unmerged.

On Danil dev, the real second case recording produced 54 timed segments. The browser flow saved and explicitly approved manual summary/actions, downloaded PDF (50,243 bytes) and DOCX (37,890 bytes), and retained the approved revision after reload. Playback jumped to 44.9 seconds and advanced to 52.1. Edits cleared approval; a two-tab 409 preserved local text and offered explicit reload. [Actual browser receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794265640).

Independent HTTPS checks also covered owner isolation, invalid evidence, immutable historical revisions, stale edits and exported contents. RU/KK glyphs and multi-page layout were inspected. This proves a human-reviewed protocol path; automatic extraction and speaker identification have separate acceptance.

## Capability map

| Capability | Evidence and limit | Issue |
| --- | --- | --- |
| Auth, private meetings, upload, canonical WAV and protected playback | Working core; ordinary demo login and owner isolation | #9 / #82 |
| Jobs, leases and persisted timed transcripts | Exercised live; broader job acceptance open | #10 |
| Local STT | Pinned Whisper turbo, actual case recording processed | #11 |
| Kazakh/mixed quality | Synthetic improvement; names and ending still contain errors | #70 |
| Human review and PDF/DOCX | Real API/browser scenarios passed; #14 and #107 closed | #13 / #14 / #107 |
| Canonical meeting UI/player | Published real API integration, no synthetic player fallback | #83 / #19 / #95 |
| Diarization/confirmed people | Backend on dev through a8c8fd1, UI feature e99f43a; live acceptance pending | #12 |
| Automatic draft actions/summary | Real local output and draft→manual revision persistence proven; semantics unaccepted | #69 / #13 |
| GPU speed | Private CUDA/SSH implementation 1c7da97; GPU speed not measured yet | #113 |
| Curator reminders | Minimal internal inbox implementation in progress | #15 |
| Platform capture | Separate connector/transport live acceptance remains | #21–#25 / #81 |

## Quality boundaries

Pinned turbo revision: `0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf`. Offline synthetic CER: RU 6.28%, KK 5.91%, mixed 12.24%, versus small INT8 7.11%, 12.60%, 53.16%. Kazakh clauses reappeared. These short synthetic measurements do not establish human-speech accuracy.

Local Qwen3-8B finished the real extraction run in 925.271 seconds on four CPU threads, producing 16 actions. Its actual artifact persisted as an unreviewed draft and manually corrected revision. It duplicated an original two-week task and final ten-day correction, missed an event-based deadline and emitted one unknown-deadline text sentinel. It is not an approved automatic protocol.

Sherpa separated two synthetic voices into four turns. Its local backend proof covered PostgreSQL/JWT and reviewed speaker mappings, not a full live ASR→diarization job. Clusters do not identify people; confirmation and action assignees remain separate.

## Coordination and holds

- #104 exact integer-ceil duration and #105 private error formatting are verified and closed. Preserve strict duration validation; a later tolerance regression was corrected.
- #102 cancellation and #106 capture-start fixes are integrated, but remaining live acceptance is open. Deployment alone is insufficient to close them.
- Honcho's isolated optional stack is integrated but not started by app deployment. Authorized product memory/Q&A remains incomplete in #103.
- Preserve the original extraction experiment and existing worktrees. Do not blindly merge ivan/20-transcript-sync, which contains an old public MP3 demo and stale handoff state.
- One coordinator serializes shared merges/deployments; feature workers publish their branches. One dedicated task owns Serena memories.
- Accessible Codex/Devin/Claude sessions and GitHub were inspected. Private chats on teammates' computers are not accessible and are not claimed audited.
- Repository settings still permit squash/rebase; the current account lacks permission to change that. Our merges preserve history without force-push, rebase or squash.
- Owner instructions use builds and bounded actual scenarios, without test suites or linters. Historical CI failures do not describe the current runtime.

Next work: [integration-plan.md](integration-plan.md).
