# MODELS-01 Local speech and extraction pipeline

## Current Behavior

- Case constraint: audio/text processing only by local/self-hosted models.
  No external STT/LLM fallback; offline operation after bundle preparation.
- `tools/transcribe/` has its own Python environment, lock and Dockerfile:
  faster-whisper 1.2.1 / CTranslate2 4.8.2; CPU INT8, 4 threads, beam 5,
  one worker job at a time; no VAD or word alignment.
- `prepare_model.py` pins `Systran/faster-whisper-small` at
  `536b0662742c02347bc0e980a01041f333bce120`, verifies weights SHA256
  and saves manifest/license. Model preparation downloads before processing.
- `transcribe.py` uses local-only model loading and private JSONL output.
  Worker launches a separate process, discards stderr and bounds output
  (32 MiB / about 20k segments); cancellation kills the process group.
- Runtime network is internal-only; models and recordings mount read-only.
  API-10 describes result publication and provenance; operational recipe:
  `docs/transcription.md`. Model weights/transcripts do not belong in Git.
- Languages auto/ru/kk/mixed are accepted; mixed enables multilingual mode.
  These options are not proof of multilingual recognition accuracy.
- [#11 independent functional proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/11#issuecomment-5793356155)
  at `58ee537`: 274250ms RU audio → 71.03s → 76 persisted nonempty
  timecoded segments. Earlier 81.06s run and offline-network evidence are
  separate observations, not one benchmark average.
- `scripts/benchmark-stt.py` and `docs/stt-feasibility.md` support further
  evaluation. Owner-approved `input-audio/` fixtures contain MP3 cover art;
  decoder must select audio. Written protocols are not verbatim transcripts.

## Known Gaps

- Manual reference-based RU/KK/mixed quality/error assessment (#11/#70/#89)
  remains open; upstream model-card claims are not team measurements.
- Preliminary local MLX small synthetic KK/mixed checks raised concerns;
  server CT2 comparison is pending. Keep runtimes and synthetic/reference
  evidence distinct; no multilingual quality pass is established.
- #12 diarization and participant confirmation are absent; speaker UUID is
  not identity and not an action-item executor.
- #69 continues in `feat/69-extraction-continuation`; original Devin WIP
  remains preserved. The new worker owns extractor/benchmark and coordinated
  processing/results integration and codegen. No automatic summary is yet
  integrated or accepted; the [claim](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/69#issuecomment-5793619040)
  is an implementation plan, not CPU quality or live evidence.
- Intended downstream order is transcription → diarization/alignment →
  extraction → human review. Retain original deadline wording; normalize
  relatives only with meeting date/timezone, never invent missing facts.

Last commit: `97e804ed7c941408ecf22145d72497214b5002c4` (audited tree, 2026-09-23; not a live assertion).
