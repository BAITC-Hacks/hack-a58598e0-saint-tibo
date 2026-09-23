# Saint Tibo: verified project state

Snapshot: 2026-09-23. The latest integrated follow-up is [PR #127](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/pull/127): the requested workspace PR #124, its draft/export guards and synchronized handoff. The complete GPU/API/browser proof baseline is main `1adbcb5` from [PR #119](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/pull/119), with equivalent dev tree `420aac5`. The follow-up preserves that processing runtime. Read the release PR and [latest #94 receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94) for the exact deployed SHA; a push alone never deploys. Production: [saint-tibo.win](https://saint-tibo.win).

## Delivered

The canonical flow is recording → private GPU transcription → anonymous speaker intervals → private GPU draft actions/summary → explicit review → PDF/DOCX → curator reminders. Ready published teammate work through the release is integrated, including persistent playback, speaker filtering/solo playback, person briefings and the saved meeting overview. [DEMO.md](../DEMO.md) contains the dedicated ordinary demo accounts and walkthrough. PR #124 now retains the separate /workspace journey for result-version selection, evidence editing and historical export. Its button explicitly requests transcription; /meetings offers the full GPU pipeline. Reconnect refresh cannot discard its unsaved review, and export is disabled while dirty/saving/reloading. The obsolete public-MP3 player branch remains deliberately unmerged.

Production deployment completed with healthy services and an ordinary demo login/read-only test1 walkthrough. The user's test1 recording and permanent demo accounts are preserved. The earlier production release `7d5b481` independently passed actual STT, manual reviewed revision and PDF/DOCX downloads; it is retained in history.

[Final browser receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794894930): diarized transcripts appear in /player; changing recordings clears stale speaker filters; solo playback follows the selected speaker's intervals; route changes and reload preserve position; participant briefing links to the correct stored meeting. The saved overview and honest empty state were checked on existing data. Console errors/warnings: zero in the bounded walkthrough.

[Reminder receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/15#issuecomment-5794676238): explicit reviewed deadlines in Asia/Almaty produced yesterday/today/tomorrow items; done, reschedule, unreview and reconfirm changed the UI/sidebar automatically 3→2→1→0→1 without reload. #15 and #120 are completed. Speaker mapping edits preserved action ownership and immutable raw diarization; edits clear approval, stale revisions return 409, and unreviewed export is rejected.

## Actual processing and speed

The same 206.032-second case-two recording completed the full GPU pipeline in **152.047543 seconds**, compared with **663.806196 seconds** using GPU STT plus CPU Qwen extraction. Observed stages with two-second polling: STT 16.805 seconds, Sherpa 60.888 seconds, GPU extraction 75.548 seconds. The older CPU-only STT job took 149.41095 seconds; comparison with GPU STT is operational, not a kernel benchmark.

The latest full job persisted 45 transcript segments, 7 anonymous clusters, 33 speaker turns and 18 draft actions. The two full-pipeline runs had identical STT text/timestamps, but prompt/output counts differed; the roughly 4.37× overall improvement is not a quality-equivalent benchmark. Seven clusters do not prove seven real people.

Pinned Whisper turbo revision: `0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf`. Qwen3-8B GGUF revision: `7c41481f57cb95916b40956ab2f0b139b296d974`; CUDA runtime: `llama.cpp-b11120-cuda12.8`; actual prompt SHA: `f1eef875a52fe4291efcf3798e42a8850cc060f3f0046f7502fd90d6af5c329f`.

Both models run on one private L4 through separate forced-command SSH keys. App ownership checks, queue, database and publication remain on the app host. GPU containers have no network/public inference endpoint, read-only filesystems, non-root users and no transcript logs. Actual Qwen telemetry reached 5,872 MiB VRAM and 97% GPU; completion left zero containers/private job directories. Actual STT cancellation/heartbeat expiry and extraction EOF cleanup were exercised. [GPU STT receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/113#issuecomment-5794753625). The single VM is subject to Danil's authorized $25 cap.

## Remaining acceptance

| Area | Verified | Still open |
| --- | --- | --- |
| Automatic protocol #69/#13 | Full HTTPS job, pinned provenance, valid evidence, immutable history, manual revision/CAS | Late corrected ten-day deadline and event-based deadline still missed; output remains unreviewed |
| RU/KK/mixed #11/#70 | Turbo retained clauses lost by small; short synthetic CER RU 6.28%, KK 5.91%, mixed 12.24% | Long TTS checks: KK 100.86s → 27 segments/7 actions with name/negation/deadline misses; mixed 81.93s → 11 segments/0 actions, missing expected tasks and two synthetic voices merged into one. Quality failed; references are not human validated |
| Speakers #12 | Actual two-voice flow, stable intervals, corrected participant mapping, separate action owners | Broader multilingual/overlap quality; clusters never identify people automatically |
| Jobs/capture #10/#102/#106 | Core jobs, cancellation and capture fixes are integrated | Remaining issue-specific recovery/capture acceptance; deployment alone does not close it |
| Optional provider/Honcho #103/#115/#117 | Published teammate code retained | Provider settings remain empty; unavailable generation button is opt-in, no meeting data sent to external inference |

A small generic prompt correction did **not** resolve the case-two deadline misses. No example text leaked into output. Latest GPU draft stayed unreviewed, with PDF/DOCX 409; the earlier manual revision was preserved. Do not describe technical pipeline success as semantic acceptance.

## Coordination

- Additive migrations have one head: 0008 → 0007 → 0005. A fresh private production backup preceded the release.
- Accessible Codex/Devin/Claude sessions and published GitHub refs were reconciled. Private teammate-machine chats are not claimed inspected.
- One coordinator owns shared merges/deploys; one dedicated task owns Serena. Preserve all teammate history and unmerged experiments.
- Verification follows Danil's builds plus bounded actual scenarios, without test suites/linters. No new broad audit cycle is required.
- Clean only each verifier's own temporary accounts/meetings/media; preserve demo and user data.
- Next work is narrowed in [integration-plan.md](integration-plan.md); latest knowledge is indexed in [.serena/plans/NEXT-SESSION.md](../.serena/plans/NEXT-SESSION.md).
