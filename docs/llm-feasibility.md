# Local extraction: measured limits and draft integration (#69)

No model has passed full semantic acceptance. Qwen3-8B is the provisional
runtime candidate for an **unreviewed draft**, not an accepted automatic
protocol. Russian case coverage, corrected/event deadlines, role attribution,
Kazakh and mixed speech still require audio-grounded human review.

## Preserved work and previous measurements

The stopped Devin worktree `hackathon-llm` was not edited. Its seven source
files were fingerprinted and copied byte-for-byte into commit `590aaf4` before
continuation. Models, transcripts, raw outputs, environments and caches were
not copied into Git. The private baseline remains on `saint-dev-danil` under
`/opt/saint-llm-bench`; published numbers below come from its metrics files.

8 vCPU AMD / 16 GiB RAM / no GPU or swap; llama.cpp b11120, 8 threads,
16,384-token context. These runs used the previous, larger experimental schema
and prompt; their output is not evidence for the current prompt.

| Candidate | Case | Wall time | Server peak RSS | Output tokens | Actions |
| --- | --- | ---: | ---: | ---: | ---: |
| Qwen2.5-7B-Instruct Q4_K_M | 1 | 477.257 s | 8,916,504,576 B | 1,357 | 5 |
| Qwen3-8B Q4_K_M, thinking off | 1 | 891.650 s | 10,997,809,152 B | 2,416 | 10 |
| Qwen3-8B Q4_K_M, thinking off | 2 | 777.830 s | 10,986,881,024 B | 2,341 | 11 |

All three metrics files report schema/reference validation and
`quality_review=pending`, `network_isolation_verified=false`. The old runner
contains a network-namespace probe, but the persisted metrics do not certify
its result. Do not retroactively claim verified isolation for those runs.
Qwen2.5 case 2 was not measured. The inherited handoff reports missing tasks,
duplicates, confused assigner/assignee roles and missed corrected/event
constraints; these are limitations reported by the previous operator, not a
new semantic review of private transcripts.

Both candidate model cards declare Apache-2.0:
[Qwen2.5-7B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF),
[Qwen3-8B-GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF).
Runtime API/flags: [llama.cpp b11120 server](https://github.com/ggml-org/llama.cpp/blob/b11120/tools/server/README.md).

## Pinned provisional bundle

The worker accepts only this existing Linux x86_64 bundle; model and launcher
SHA256 are checked before every launch. No runtime download, GPU provisioning,
cloud endpoint or fallback exists.

- Qwen3 model revision: `7c41481f57cb95916b40956ab2f0b139b296d974`.
- `Qwen3-8B-Q4_K_M.gguf` SHA256:
  `d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785`.
- llama.cpp release b11120 archive SHA256:
  `cae70da61dc74e3012418f7a4b6750eadc6fd0a8fb03270022d471b675e5b4cd`.
- Installed `llama-server` SHA256:
  `ea63bf0b55fd178a9f9564447c6cf083f162eaa160c9a73643b7cb8b913d344c`.
- Previous Qwen2.5 revision: `bb5d59e06d9551d752d08b292a50eb208b07ab1f`;
  baseline metrics fingerprint only shard 1 as
  `dfce12e3862a5283ccfb88221b48480e58745165de856439950d0f22590580db`.
  This is not a complete two-shard bundle manifest and is not used for deployment.

Existing host paths for the read-only worker mounts:

```dotenv
EXTRACT_RUNTIME_PATH=/opt/saint-llm-bench/llama-b11120
EXTRACT_MODELS_PATH=/opt/saint-llm-bench/models/qwen3-8b
```

These are optional prepared bundles. Missing files cause an explicit
`extraction_unavailable` failure; transcribe-only jobs continue to work.
Do not point the runtime mount at a public network service. The client only
accepts numeric loopback HTTP, disables proxies and rejects redirects.

## Processing and review contract

`POST /api/v1/meetings/{meeting_id}/recordings/{recording_id}/jobs` accepts
`target_stage=extract`; the default remains `transcribe`. One existing worker
runs decode validation → STT → diarization → extraction, sequentially.
Explicit `target_stage=diarize` stops after anonymous speaker intervals.
Extraction receives only anonymous cluster labels; a segment crossing voices
or without a matching turn has a null label. Labels never assign participants.
The system prompt is unchanged. Model loading and generation
show `stage=extract, progress=null`; there is no fake percentage.

The bounded transcript travels over stdin. The child starts its own local
llama-server, uses schema-constrained JSON, validates every reference and
requires a normal completion. The supervisor cancels the entire process
group on stop/lease loss/timeout. Model stdout/stderr never enters logs.
Limits: input 64 KiB, runtime context 8,192, output 3,072 tokens / 1 MiB,
64 action items, 16 entries per summary category, 64 refs per statement.
Oversized/truncated/invalid output fails explicitly; no empty-success fallback.
The runtime uses 4 threads, one slot, batch 256/ubatch 128, no weight repacking,
no warmup and no context shifting. The worker stays on its internal network
and keeps its existing 4 CPU / 6 GiB container cap.

Segment UUIDs are allocated before extraction. Small numeric prompt IDs map
only to this new result's UUIDs. The final transaction rechecks the lease,
recording and all references and writes the same existing `ResultVersion`,
segments, immutable diarization and nullable `extraction_draft` JSONB
(migration `0008`, following the existing `0007` diarization migration).
Any failed extract attempt publishes no successful result.

`completed_stage=extract`, `status=draft`, `revision=1` means an automatic
proposal. `GET .../results/{version_id}/review` exposes it using the existing
review shape and adds `extraction_provenance` (model/revision/model hash,
runtime and prompt hash). STT `model_id`/`model_revision` keep their original
meaning. Participant IDs remain unknown; speaker labels are not assignees.
Original `due_text` is kept; **all automatic `due_date` values stay null**.
Exact duplicate tasks merge their evidence; semantic duplicate correction
still needs a person. Summary evidence is combined into the existing summary
source list; there is no parallel review store or UI contract.

Human PATCH from revision 1 to 2 retains the draft if only approval changes,
and saves the normal immutable `ResultReview`. Exports still require an
explicitly reviewed saved revision. Reprocessing creates a new version and
cannot replace previous human edits. Revision 1 remains readable for an
extracted result; its meeting metadata is current, while saved human revisions
freeze their metadata as before.

## Verification boundary

Backend wheel build and API/SDK generation pass. A disposable local PostgreSQL
scenario applied migration 0006 and proved draft readback, approval without
content loss, same-result source validation, owner ACL, stale revision 409,
export refusal for unreviewed v1 and preservation of human v2 after a new run.
Synthetic storage input in that scenario is explicitly not inference evidence.
Ten focused schema/client rejection cases cover foreign/boolean references,
extra keys, duplicate keys, invented dates, missing evidence and nonlocal URLs.
No repository test or linter suite was run.

The first constrained case-2 CPU run (2,048 output tokens) **failed** with
`extraction_incomplete`. The authorized 3,072-token rerun below completed and
its actual artifact passed the private storage/review flow. No deployed HTTPS
full-job success is claimed.
The exact pinned launcher also runs inside the existing processing Docker image
(`--version`: build 11120, commit `08b1d2aea`, GNU 11.4.0, Linux x86_64),
and the model bind is readable as the image's unprivileged application user.

A separate synthetic supervisor scenario confirmed that a reported incomplete
completion remains an error and cancellation leaves no child process group.
It uses no model and makes no inference-quality claim.

The separately delivered release fix #104 (`ac8cfa4`) must be present when
running case 2 through the complete STT pipeline: its WAV has 3,296,500 frames
at 16 kHz, whose canonical integer-ceil duration is 206,032 ms. The previous
STT rounding produced 206,031 ms and failed the strict terminal-duration
check. This extraction benchmark consumes an existing transcript and does
not by itself exercise that repaired STT boundary.

## Current one-case runtime result — NO-GO

2026-09-23, existing private case-2 STT transcript, one run only. Unit
`saint-extract-69-case2` on `saint-dev-danil`, 4 CPU, MemoryMax 6 GiB,
PrivateNetwork enabled, current compact schema/prompt, thinking disabled,
no repacking, context 8,192, output limit 2,048 tokens.

- Exit 1 / `extraction_incomplete` after **820.418 seconds** (13 min 40 s).
  The client rejected a non-`stop` finish reason. The raw finish reason and
  final usage were not persisted on this error path; hitting the output cap
  is the likely explanation, not a separately captured final counter.
- Last sampled progress: 2,977 prompt tokens processed, 1,535 decoded tokens,
  513 tokens remaining in the output budget. This was active generation.
- CPU usage: 3,250.424 CPU-seconds. A short concurrent frontend build means
  wall time is not an uncontended performance comparison.
- Sampled model VmHWM: **6,335,348,736 bytes** (~5.90 GiB). The final model
  peak was not captured before shutdown; do not call this sample the final peak.
- Cgroup memory peak: 1,364,332,544 bytes. Weights were already in the host's
  file cache, whose charges may belong to another cgroup. This smaller number
  is not the full model footprint or proof of a cold-start 6 GiB safety margin.
- The running namespace had only `lo` and zero IPv4 routes. No outside
  transcript call, download or cloud fallback was used.
- No result file was created and no result version was published. The child
  runtime exited, MainPID became 0, and the CPU slot was returned to the coordinator.

Safe failure metrics are private at
`/opt/saint-llm-bench/continuation-69/private/case2-failure-metrics.json`.
Original bench files and the original Devin worktree remain unchanged.
No retry, second model, or model sweep was run.

The adapter and draft persistence are implemented on the feature branch, but
this profile is **not ready for automatic protocol delivery or release**.
That first run left three blockers: a bounded complete response, semantic
acceptance of both case recordings, and a deployed `target_stage=extract`
success. The following rerun resolves the complete-response blocker only. A future focused run may
adjust the output budget or reduce requested summary volume after the owner
allocates another CPU slot; this task does not claim that change was measured.

## Authorized bounded correction

Tools-only commit `f0fbc96` raises the completion budget from 2,048 to 3,072;
the model, system/user prompt construction, context, four threads, no-repack
and no-thinking settings are unchanged. No 4,096-token profile, six-thread
variant or prompt rewrite was introduced. At the measured 2,977-token prompt,
2,977 + 3,072 fits inside the existing 8,192-token context.

The client now retains only an allowlisted finish reason and nonnegative
integer prompt/completion counts when refusing a response. The CLI snapshots
VmHWM before stopping the runtime and writes error metrics with mode 0600.
A focused synthetic loopback scenario verified `finish_reason=length` and
numeric usage survive an error, while a raw response canary is absent from
stdout/stderr/result files. This is transport evidence, not model-quality proof.

Exactly one same-case-2 rerun started at 2026-09-23 11:23:16 UTC in
`saint-extract-69-case2-r2`, with the same CPU/memory/time/network limits.
Its artifacts are separate under `/opt/saint-llm-bench/continuation-69-r2/private`.
The original failed run remains preserved. Evaluation compares the supplied
six-row protocol reference separately from the documented audio corrections;
both critical final-deadline phrases are present in the source STT segments.
Only counts and boolean checks leave the private directory. Full semantic
acceptance still requires audio review; reference matching heuristics alone
must not be described as a passing quality grade.

## 3,072-token result and actual-artifact review flow

The single authorized rerun finished successfully:

| Signal | Measured value |
| --- | --- |
| Process / finish reason | exit 0 / `stop` |
| Wall time, including load | 925.271 seconds (15 min 25 s) |
| Prompt / completion tokens | 2,977 / 2,435 |
| Final server VmHWM | 6,369,689,600 bytes (~5.93 GiB) |
| Extracted action items | 16 |
| Transcript source segments | 76 |
| Schema and same-input numeric references | Validated |

The response exceeds the original 2,048-token cap. Raising only that budget
allowed completion without changing the prompt, model, context, threads or
repacking. This remains a warm-file-cache, shared-host measurement; it does
not establish a cold-start container memory margin. The model was stopped
and the CPU slot released immediately after completion.

The **actual** generated payload, its provenance and the same 76 source
segments then passed one isolated PostgreSQL flow using the feature's
publisher and API routes: allocate UUIDs → publish existing ResultVersion +
segments + automatic draft v1 → read review → save one explicit review edit
as v2 → reload both revisions. The original AI revision and provenance were
preserved, stale v1 returned 409, and an unreviewed export returned 409.
`reviewed` stayed **false throughout**. No AI fields were hand-filled and
no completion or approval was invented.

This was an ASGI storage/API scenario with a private fixture identity, not
an authenticated HTTPS full processing job. It used a uniquely owned temporary
database and role on the existing PostgreSQL service, never existing app/auth
data. Both were dropped; a separate catalog query confirmed zero remaining
database/role entries and no remaining temporary credential file.

### Semantic limitations found privately

The supplied six-row protocol and the audio corrections in `docs/case.md`
were treated as separate references. Counts are not a quality score; a source
row can legitimately contain several obligations. No source/output text or
personal names were exported to logs/Git.

- The model emitted an initial supplier-related task with the earlier two-week
  deadline and a separate final ten-day correction. Their references cover
  the earlier assignment and final correction separately; it failed to merge
  them into one final task with both sets of evidence.
- The event-based deadline after the meeting was absent from extracted due
  fields, despite being part of the documented case acceptance.
- One unknown deadline was written as a text sentinel instead of `null`.
- Only 9 of 16 due phrases occur literally in their cited source text after
  whitespace/case normalization. The other seven require inspection; this
  literal check is not itself a semantic accuracy score.
- Reference-based checks found the legal-role assignment, separate estimate
  week / training month obligations, and no misuse of the invoice five-day
  rule as the contract-preparation deadline. Some owner-name comparisons
  against reference rows 3/4 remain unresolved: ASR spellings and context may
  differ, and the heuristic does not establish speaker identity.
- Every automatic ISO date is null and every cited ID belongs to the input;
  those structural invariants do not prove that each citation supports its task.

The result is a **working local-model draft → manual-correction persistence
path**, suitable for continued integration as explicitly unreviewed content.
It is not an accepted automatic protocol, nor a semantic pass for #69.
Both-case audio-grounded acceptance and a deployed full `target_stage=extract`
job remain outstanding. The integration below consumes the published STT
model-provenance contract and resolves the migration order. GPU runtime
changes remain owned by the separate runtime worker.

Private evidence in `continuation-69-r2/private`: `case2-metrics.json`,
`case2-private-quality.json`, `case2-safe-field-audit.json`, `db-proof.json`
and `db-proof-cleanup.json`. Raw output and reference stay there. The initial
failed run and original Devin files remain unchanged. Exactly two inference
runs occurred in this continuation: the initial bounded failure and the
explicitly authorized one-variable correction.


## Integration with #12 and current dev — 2026-09-23

Integrated `origin/dev` at `a8c8fd1`, including #12 `1b6843e` and its pinned-check
fixes. The existing `0005` and `0007` migrations are unchanged. The unreleased
extraction migration was renamed from `0006` to `0008`, parent `0007`; a fresh
private database upgraded to the single head `0008`. Earlier `0006` proof
receipts above refer to the historical feature version, not a release migration.

All three target stages retain the actual STT model ID/revision returned by the
supervisor. The strict integer-ceiling audio clock is retained, including exact
metadata equality. The default remains `transcribe`; explicit `diarize` and full
`extract` publish one atomic result only after all requested stages complete.
A full result includes the raw anonymous speaker evidence, original STT
provenance and an unreviewed extraction draft. Speaker edits preserve draft
content and extraction provenance; no automatic participant mapping or approval
is introduced. No GPU-owned transcription/runtime behavior was edited.

Bounded replay proof passed against a new temporary local PostgreSQL database:

- Real API job creation, queue claim, worker subprocess supervisors, result
  publication and review reads observed exactly `transcribe`,
  `transcribe → diarize`, and `transcribe → diarize → extract` for the three modes.
- Diarization replayed the existing actual Sherpa two-speaker/four-turn output
  on its original 23,900 ms synthetic Milena/Aru audio. STT and extraction
  responses in this scenario were explicitly controlled synthetic fixtures.
  Turbo identity fields were passed through; this is not a turbo inference claim.
- Anonymous labels reached extraction, cross-voice attribution remained null,
  participant IDs remained null and all revisions stayed unreviewed.
- A speaker-only review edit preserved the automatic task/summary/provenance;
  original draft and raw diarization remained available. Stale revision and
  unapproved export both returned 409. Duration metadata ±1 ms was rejected.
- Fixture records and the uniquely owned database were deleted; the owned
  local PostgreSQL cluster was stopped. Private receipt:
  `/tmp/saint-69-integration/cleanup.json`.

Separately, the existing actual case2 STT and successful R2 Qwen3 payload were
replayed through the current extraction supervisor in a read-only container
with network disabled: 76 segments, 16 actions, duration 206,032 ms, identical
content/provenance and reference mapping, null automatic participant IDs and
ISO dates. No case2 diarization was fabricated. Safe receipt remains privately
under `continuation-69-integration/real-artifact-receipt.json` on the bench host.

Backend wheel/sdist build, OpenAPI export and TypeScript SDK generation passed.
No suites, linters, model inference, shared merge, deployment or browser/HTTPS
full-job verification ran for this integration. The semantic failures documented
above remain open; replay validates wiring and persistence, not model quality.

## Confirmed unknown-deadline normalization — 2026-09-23

The local structured-output validator now converts only the exact absence
markers `не указан`, `не указано` and `срок не указан` (case/whitespace normalized) in
`due_text` to null. It preserves every other deadline phrase, task, assignee,
source reference and summary field. This does not infer dates or merge similar
tasks. The prompt and model remain unchanged; #115's separate extraction API
is untouched.

A bounded replay of the original successful R2 payload changed only action
index 14's unknown-deadline marker to null. All 16 actions and every other
field remained identical, and the original private artifact stayed byte-for-byte
unchanged. Receipt: `continuation-69-integration/unknown-deadline-receipt.json`.
No new inference, suite or linter ran. The supplier correction remains split
between indices 2 and 12, its combined evidence is missing, and the event-based
deadline remains absent. Owner-name checks against STT/reference text do not
establish identity or replace listening to the original audio. A new own-QA
case2 job through the ordinary API awaits coordinator DEV-GO after the shared
build; no live acceptance is claimed by this normalization replay.
