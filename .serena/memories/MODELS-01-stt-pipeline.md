# MODELS-01 STT and ML pipeline

Hard constraint (case): audio/text processed ONLY by local/self-hosted
models. No external API, no hidden fallback, no transcript to external
LLM. Must work with egress disabled after model bundle is prepared.
`models/` is gitignored — weights never enter git.

## Feasibility (docs/stt-feasibility.md, verified 2026-09-23)

- First CPU baseline: `Systran/faster-whisper-small` (MIT), CTranslate2,
  `device=cpu`, `compute_type=int8`, 4 threads, one file at a time.
- STT runs in a SEPARATE worker process — never inside FastAPI/uvicorn.
- KK candidate: `shyngys879/kazakh-whisper-large-v3-turbo`
  (author claims Apache-2.0, ~0.8B params, needs CT2 conversion);
  control: `openai/whisper-large-v3-turbo` (MIT). Author-reported
  FLEURS WER (11.8% vs 70.45%) is NOT our measurement.
- Upstream reference only: small INT8 ~102 s / ~1.5 GB RAM on 13-min
  audio (i7-12700K). Our AMD CPU needs own RTF/RSS numbers.
- `scripts/benchmark-stt.py` = reproducible offline benchmark;
  run RU/KK/mixed matrix on `saint-dev-danil` before choosing prod model.

## Fixtures

`input-audio/Совещание №1.mp3` 274.25 s and `№2` 206.03 s — 48 kHz mono
MP3 with embedded PNG cover → decoder must select the audio stream
explicitly. Text protocols ≠ verbatim transcripts of the audio
(#13 note: recording №2 changes supplier-search deadline at the end).
Case audio in git is a one-off owner exception (#32).

## Pipeline order (#10→#13)

decode (explicit audio stream) → STT → diarize/align → extract →
ResultVersion. #12 diarization is self-hosted; `speaker_id` ≠ identity,
human confirms participant mapping; NO voiceprint DB this task.
#13: keep original deadline phrasing; normalize relatives only with
meeting date+timezone; never invent assignee/date/year.
