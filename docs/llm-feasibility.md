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
runs decode validation → STT subprocess → extraction subprocess, sequentially.
No diarization/participant identity is claimed. Model loading and generation
show `stage=extract, progress=null`; there is no fake percentage.

The bounded transcript travels over stdin. The child starts its own local
llama-server, uses schema-constrained JSON, validates every reference and
requires a normal completion. The supervisor cancels the entire process
group on stop/lease loss/timeout. Model stdout/stderr never enters logs.
Limits: input 64 KiB, runtime context 8,192, output 2,048 tokens / 1 MiB,
64 action items, 16 entries per summary category, 64 refs per statement.
Oversized/truncated/invalid output fails explicitly; no empty-success fallback.
The runtime uses 4 threads, one slot, batch 256/ubatch 128, no weight repacking,
no warmup and no context shifting. The worker stays on its internal network
and keeps its existing 4 CPU / 6 GiB container cap.

Segment UUIDs are allocated before extraction. Small numeric prompt IDs map
only to this new result's UUIDs. The final transaction rechecks the lease,
recording and all references and writes the same existing `ResultVersion`,
segments and its nullable `extraction_draft` JSONB (migration 0006).
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

Current constrained CPU runtime/live evidence is recorded below after execution.

A separate synthetic supervisor scenario confirmed that a reported incomplete
completion remains an error and cancellation leaves no child process group.
It uses no model and makes no inference-quality claim.
