# Saint Tibo: verified project state

Snapshot: 2026-09-23. This document separates integrated code, running code,
and unverified work. Refresh refs and read the linked issues before acting.
Coordination record: [#94](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94).

## Product and acceptance

Saint Tibo builds a local meeting secretary: recording → transcript →
evidence-backed action items and summary → human review → exported minutes.
The [organizer's case](https://docs.google.com/document/d/1PUDYCg2OC_wfBk4rq5673yc1qsmo8O5_pwxjm483omU/edit)
requires Russian, Kazakh and mixed speech, diarization, responsibility and
deadline extraction, and PDF/DOCX export. Audio and meeting text must stay
within local/self-hosted processing. See [case.md](case.md) for source links
and the distinctions between written examples and recordings.

## Verified release scope

Review/save/reload and owner-only PDF/DOCX downloads passed independent real
HTTPS verification at `97e804e`; #14 is complete. Historical revisions stay
unchanged, stale edits return 409, invalid evidence returns 422 and foreign
users cannot download. Russian/Kazakh glyphs and multi-page layout were checked.
This is a human-reviewed protocol path; automatic extraction is still #69/#13.

## Baseline observed during this synchronization

| Surface | Observed state | Meaning |
| --- | --- | --- |
| `main` and production | `62b137d` | Released foundation and private meeting recordings |
| Danil dev runtime | `58ee537` | Independently verified local STT and persisted transcript |
| Initial `dev` | `f8cf4da` | Documentation/memory changes after the verified runtime |
| Rich player integration | `a2cfe28` | Ivan integrated protected selection and waveform |
| Reviewed export runtime | `97e804e` | Independent HTTPS review/export proof passed |
| Subsequent `dev` | `34062c4` | Browser-generated synthetic walkthrough; explicitly not speech/STT |

The deploy system is manual. A Git push does not update any environment.
Exact final SHAs and verification receipts for the current wave belong in #94.
Do not infer deployment from this document's presence in a branch.

## Capability map

| Capability | Evidence and limit | Owner / issue |
| --- | --- | --- |
| Auth, private meetings, uploads, canonical WAV and Range playback | Released; owner isolation and logout verified | Danil, #9 / #82 |
| Persisted jobs, leases, idempotency and interrupted state | Integrated and exercised live; broader job acceptance remains open | Danil, #10 |
| Local transcription and stable timed segments | Real RU recording: 274.25 s audio, 71.03 s processing, 76 segments in independent #94 run | Danil, #11 |
| Kazakh/mixed quality | Synthetic offline CPU smoke found material errors; mixed small INT8 omitted Kazakh clauses | #11 / #70 |
| Diarization / confirmed people | STT currently publishes `speaker_id=null`; not delivered | Danil, #12 |
| Automatic action items and summary | Local LLM experiment exists, not integrated or accepted | Danil, #69 / #13 |
| Human review and versioned export API | Integrated and independently verified at `97e804e`; immutable snapshots and access checks passed | Danil, #13 / #14 |
| PDF/DOCX renderer | Real downloads, RU/KK and multi-page layout passed; #14 closed | Danil, #14 |
| Product UI and review adapters | Separate active delivery, mock data must remain explicit | Artem, #83–#85 / #17–#18 |
| Rich player and protected recording selector | Integrated at `a2cfe28`; backend STT proof does not prove this UI | Ivan, #19 / #95 |
| Meeting platform capture | Prototypes have separate live acceptance and transport gaps | Ivan, #21–#25; Danil, #81 |
| Curator reminders | Required second scenario still pending | Danil, #15 |

The successful fresh STT run and the interrupted job were distinct runs.
Completion of the interrupted retry was not proven by the old #94 receipt.
The later #14 receipt adds actual downloads and visual checks; it supersedes
the former renderer-only limitation.

## Agent and branch synchronization

The earlier foundation and integration tasks delivered the baseline.
The integration task is archived with its receipts preserved. Its attempted
fresh-task handoff was left queued; this synchronization wave has dedicated
tasks for integration audit, Serena synchronization,
review/export implementation and local extraction continuation. One coordinator owns shared merges and the
Danil deployment slot. Current task IDs and local inventories stay in the
coordinator's ignored evidence directory rather than product documentation.

The prior memory audit ended without reported pending edits. The separate
#69 experiment was stopped by the owner; seven untracked source files and
private server benchmark artifacts are preserved. A dedicated continuation
worker now owns local extraction. The earlier monitor has confirmed read-only
operation, no open claims and no unpublished product work.
One newly assigned worker exclusively owns `.serena/memories` and the
next-session index. No worker may overwrite another task's changes.

## Language quality evidence

Three locally synthesized short recordings were processed without egress by the
exact CPU small INT8 pipeline. RU: CER 7.11%, 6.19 s; KK: CER 12.60%, 9.50 s;
mixed: CER 53.16%, 7.17 s. The mixed output omitted Kazakh instructions. These
are synthetic smoke measurements, not human-speech accuracy claims; typography
and number spelling also affect CER. Valid timestamps and successful jobs do
not establish semantic accuracy. A stronger pinned local CT2 model is being
evaluated separately; it is not deployed or accepted yet. #11/#70 remain open.

## Holds and limitations

- Do not merge every surviving branch. `ivan/20-transcript-sync` contains
  an unmerged demo importing the original case MP3 into a public frontend
  bundle and an old next-session plan; it needs its owner's explicit review.
- Honcho #96 is outside the minimum. Its hardened isolated stack was integrated
  at `3005fd3`: local endpoints, internal network and no cloud development
  overlay. It is not started by the application deployment. App authorization
  and derived memory remain incomplete (#103); no product capability is claimed.
- Release fixes #104/#105 address inconsistent duration rounding and private
  exception logging. Capture start-time correction belongs to Ivan in #106.
- #69 is experimental: duplicate tasks, responsibility mistakes, missed
  event/corrected deadlines and invented dates were reported. No model is
  accepted merely because it returned JSON or ran without external access.
- GitHub currently permits squash and rebase despite the team's merge-only
  policy. This account has push/triage, not admin/maintain; the attempted
  settings update was rejected. An administrator must enforce the settings.
- Old failed Actions runs are historical. Current delivery intentionally uses
  build plus targeted live scenarios; no new CI or test suite is introduced.
- Accessible local sessions and GitHub were audited. Private remote chats on
  teammates' machines are not visible and are not claimed as audited.

Next actions and ownership are in [integration-plan.md](integration-plan.md).
