# MODELS-01 Local speech and pending ML work

Latest release: [GPU/speakers/extraction/inbox delta](RELEASE-94-runtime-wave.md).
The core snapshot below retains its original audit boundary.

## Current Behavior

- Audio/text processing stays local/self-hosted with no external fallback.
  `tools/transcribe/` is a separate environment (faster-whisper 1.2.1 /
  CT2 4.8.2), CPU INT8, four threads, beam 5, one job; no VAD/word alignment.
- Integrated pinned bundle support (`52efb76`) allows small and turbo:
  small revision 536b0662742c02347bc0e980a01041f333bce120;
  `dropbox-dash/faster-whisper-large-v3-turbo` revision
  `0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf`.
- `prepare_model.py --model small|turbo` downloads before processing;
  manifest/allowlist and actual file hashes are checked offline for each job.
  Unknown/corrupted bundles fail. Default remains /models/small;
  BACKEND_STT_MODEL_PATH=/models/turbo explicitly selects prepared turbo.
- Actual model ID/revision passes through the private done event to stored
  ResultVersion; provenance is no longer hardcoded to small.
- Worker network is internal-only; audio/model mounts are read-only; subprocess
  output is bounded and stopped on cancellation. Logs omit user text.
  Canonical duration uses exact integer ceil from WAV frames (API-10).
- [#104 live b1e33cb](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/104#issuecomment-5793915724)
  proves a fractional-ms source succeeds through STT/review/export.
  Coordinator later reports actual 206s case2→turbo54 segments/persistence/player
  on d80d1da; this is functional evidence, not a semantic benchmark.
- Synthetic RU/KK/mixed CER improved small 7.11/12.60/53.16% to
  turbo 6.28/5.91/12.24%; Kazakh clauses retained, names still need review.
  See `docs/transcription.md` and [#11 implementation proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/11#issuecomment-5794027871).

## Known Gaps

- #11/#70/#89 real-speech/reference acceptance stays open. TTS comparisons
  and local MLX experiments are different evidence; no multilingual quality pass.
- Original Devin sources preserved at 590aaf4 (not in fetched main/dev).
- #69 first Qwen attempt failed at 820.4s. R2 completed 2435 tokens/16 actions
  in 925.271s, 6.37GB RSS; private draft-v1→corrected-v2/CAS proof passed and
  was cleaned. Semantics remain unaccepted: superseded/final deadlines duplicate,
  event deadline missing, one text sentinel and only 9/16 literal due phrases.
- #12 published feature 1b6843e with 45 local Sherpa/PostgreSQL/JWT checks
  ([receipt](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/12#issuecomment-5794179920));
  Backend and UI e99f43a are in dev 269fcbb; production UI acceptance is pending.
  It is not deployed; pinned core release 6ed682e still has speaker_id=null.
- Parent reports Brev L4 READY, image building; approved cap $25.
  Root owns provisioning. #113 1c7da97 is in dev 269fcbb, remote off; GPU unverified.
- Pinned core schema ends 0005; shared dev adds 0007 diarization, not deployed.
  Dev 269fcbb includes #69 via 63a34f8, extraction 0008→0007; not deployed.
- Never invent missing assignee/deadline/year; preserve original deadline text
  and recording timeline. Fixtures are explicit owner exceptions, not user uploads.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
