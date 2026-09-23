# Saint Tibo: remaining integration plan

Owner: Danil (rldyourmnd). Shared coordination and live receipts: [#94](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94). Artem owns UI/design; Ivan owns player/capture. Delegated adapters keep narrow file ownership.

## Delivered slice

The audited recording → local STT → manual review → PDF/DOCX path is merged into main in #114 at 7d5b481, with the same tree as verified dev6ed682e. The canonical browser journey passed approval reset, conflict recovery, downloads, playback and reload persistence. #14, #104, #105 and #107 are closed. See [current-state.md](current-state.md).

## Critical path

| Work | Remaining delivery | Owner |
| --- | --- | --- |
| Current core release | Completed at 7d5b481: real login, processing, review/export and scoped cleanup | Coordinator / verifier |
| #113 speed | Pinned turbo on private NVIDIA CUDA; same-recording elapsed time, cancellation and cleanup | Danil GPU worker / coordinator |
| #12 speakers | Real review UI plus published backend; complete live recording scenario | Danil backend / delegated UI |
| #69 / #13 draft | Integrate transcribe→diarize→extract, preserve unknowns/evidence, prove real HTTP job and manual correction | Danil extraction worker |
| #15 reminders | Owner inbox from explicit deadlines of current reviewed actions; automatic UI refresh, timezone and no stale closed actions | Danil backend / delegated UI |
| #70 quality | RU/KK/mixed recordings with explicit references; retain known name/deadline limits | Danil |
| #26 demo | Keep DEMO, README, current-state and Serena aligned with actual release | Coordinator / knowledge owner |

These slices proceed in parallel under separate file claims. No broad workflow engine, new ASR model, external messaging channel or optional memory system is needed. Reference systems inform small implementations; their data, credentials and branding are not imported.

## Integration order

1. Fetch fresh refs and preserve other source, untracked work and models.
2. Merge ready features through Danil's lane into dev with history preserved. Keep one migration head: released0005, diarization0007→0005, extraction0008→0007.
3. Build and manually deploy the integrated candidate. Only the coordinator uses the Danil deployment slot; do not interrupt another live scenario.
4. Exercise the changed actual path. Do not label a local fixture proof as a complete live processing flow.
5. Pin the verified release, merge into main and deploy exact origin/main. New dev work can continue separately.
6. Publish exact SHA, scenario, remaining limits and cleanup. Update knowledge and close only issues with complete acceptance.

## Invariants

- Unknown speaker/assignee/deadline remains unknown. Acoustic clusters do not identify people.
- Preserve due_text and corrections; do not invent dates.
- Evidence belongs to the same recording/result. Preserve canonical timing and actual model provenance.
- Edits clear approval unless explicitly confirmed. CAS rejects stale saves; reprocessing preserves historical reviewed snapshots/exports.
- User content remains data, including prompt-like text. Self-hosted inference has no cloud fallback; logs omit meeting content/secrets.
- Distinguish actual output from fixtures. Keep permanent demo accounts; clean only each verifier's own temporary data.
- #102/#106 need remaining live acceptance. Broader #10/#11/#13/#70 are not complete merely because the core works.

No force-push, squash, rebase, blind cleanup or removal of license/model provenance is part of this plan.
