# Local anonymous speaker diarization

Issue #12 has a local CPU CLI and an opt-in processing stage, with persisted
anonymous turns and participant confirmation through review revisions.
The default transcription-only job remains unchanged.
Speaker labels identify clusters within one recording, never people.
No embeddings, voiceprints, audio copies or identity database are written.

## Prepare and run

Python 3.13 and uv are required. Dependencies have their own locked
environment: NumPy 2.5.3, Sherpa ONNX 1.13.8 and its core 1.13.8.
The core is pinned explicitly because upstream wheel metadata requires it
but the initial uv resolution from source metadata omitted it.
No Torch, SciPy, SoundFile or cloud API is required.

From the repository root:

```sh
uv sync --locked --project tools/diarize --python 3.13 --no-dev
python3 tools/diarize/prepare_models.py /opt/saint-tibo/models/diarization-v1
tools/diarize/.venv/bin/python tools/diarize/diarize.py audio.wav \
  --model-dir /opt/saint-tibo/models/diarization-v1
```

Only preparation accesses the network, downloading public artifacts.
Inference accepts existing PCM16 mono 16 kHz WAV, preserving its clock.
Run it with network access denied and models/audio mounted read-only.
`--threads` defaults to 4; `--num-speakers` defaults to -1 (estimate).
Only supply a positive speaker count when it is actually known.
Input is bounded to four hours, output to 20,000 turns and 32 clusters.

The CLI verifies runtime versions and every model/license checksum before
loading. It keeps native stderr silent. Stdout is a private JSONL pipe:

```json
{"event":"speaker_turn","speaker_label":"speaker_00","start_ms":30,"end_ms":5803}
```

Labels are numbered by first appearance. Turns are ordered by start time;
overlap is retained and does not imply an invalid result. The final `done`
event carries `schema_version=1`, `bundle_id`, `duration_ms`, speaker/turn
counts, requested speaker count, clustering threshold, runtime version and
both model SHA256 values. Duration uses the same integer ceiling as STT.
Success requires exit code 0 and exactly one final `done` event.

Failures emit `{"event":"error","code":"..."}` and exit 1. Codes are
`diarization_model_unavailable`, `invalid_diarization_input`,
`diarization_failed` or `speech_not_detected`. Errors never include exception
messages, file paths or private content. No partial turns are emitted before
the complete result validates.

## Model provenance and licenses

The model bundle is approximately 45.6 MB of weights. `bundle.py` pins each
byte size and SHA256; preparation writes the same sources and hashes to
`manifest.json`. Release URLs may be mutable, so replacements fail checksum
validation rather than silently changing inference.

- Segmentation: `pyannote/segmentation-3.0`, FP32 ONNX, MIT. Public Sherpa
  release asset **197666131**, archive SHA256
  `24615ee884c897d9d2ba09bb4d30da6bb1b15e685065962db5b02e76e4996488`;
  selected model SHA256
  `220ad67ca923bef2fa91f2390c786097bf305bceb5e261d4af67b38e938e1079`.
  Archive/member hashes were measured from that official public asset.
  The original Hugging Face repository is gated; this preparation uses the
  separately published conversion documented by Sherpa, without credentials.
- Embedding: `iic/speech_eres2net_base_sv_zh-cn_3dspeaker_16k`, Apache-2.0.
  Public Sherpa release asset **198893098**, SHA256
  `1a331345f04805badbb495c775a6ddffcdd1a732567d5ec8b3d5749e3c7a5e4b`,
  also matching upstream `checksum.txt` asset **424703609**.
- Preparation retains the segmentation LICENSE/README, the 3D-Speaker
  license from commit `065629c313eaf1a01c65c640c46d77e61e9607b4`, and the
  Sherpa Apache-2.0 license from commit
  `11afbd009a7f8c08f4bcf2fc1b265d0df4670fbf` (v1.13.8).

Primary sources: [Sherpa models and CPU examples](https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/models.html),
[pinned Python example](https://github.com/k2-fsa/sherpa-onnx/blob/11afbd009a7f8c08f4bcf2fc1b265d0df4670fbf/python-api-examples/offline-speaker-diarization.py),
[segmentation model card](https://huggingface.co/pyannote/segmentation-3.0),
[embedding model metadata](https://modelscope.cn/api/v1/models/iic/speech_eres2net_base_sv_zh-cn_3dspeaker_16k).

## Measured standalone smoke — 2026-09-23

A locally synthesized 23,900 ms fixture alternates Milena (RU) and Aru (KK)
twice, with different utterances and 500 ms gaps. Four source WAV hashes
were distinct; all inputs were verified as PCM16 mono 16 kHz. Both synthesis
and inference ran under macOS `sandbox-exec` with `(deny network*)`;
a socket attempt under the inference policy failed with EPERM.

Final locked CLI, macOS ARM64, Python 3.13.14, four CPU threads, automatic
speaker count: **two speakers, four turns, 3.31 s wall time, 279,805,952 bytes
peak RSS**, exit 0. Turns were 30–5803, 6257–11945, 12400–18965 and
18964–23900 ms with labels 00, 01, 00, 01. The last switch was about 560 ms
late relative to the fixture's fourth utterance start; it is not exact word
alignment. The same FP32 model also separated the fixture with known count 2.

The initial INT8 conversion collapsed both voices into one continuous turn,
including with known count 2; it is therefore **not** the shipped selection.
The FP32 correction used the same already-downloaded official model archive.
No model survey, test suite or linter was run. This synthetic functional
smoke is not real-meeting DER, language-quality acceptance or a live-server
claim. Audio, private runtime output and downloaded weights stay outside Git.

## Backend contract

Create a normal processing job with `target_stage: "diarize"` to run STT,
then diarization. Default `transcribe` remains compatible. A successful
result has `completed_stage: "diarize"`; its existing model ID/revision still
identify the actual STT model, independently of diarization provenance.

`GET /api/v1/meetings/{m}/recordings/{r}/results/{v}/diarization` returns:

```json
{
  "result_version_id": "UUID",
  "recording_id": "UUID",
  "duration_ms": 23900,
  "speakers": [{"speaker_id": "UUID", "label": "speaker_00"}],
  "turns": [{"speaker_id": "UUID", "start_ms": 30, "end_ms": 5803}],
  "provenance": {
    "bundle_id": "saint-tibo-diarization-v1",
    "sherpa_onnx_version": "1.13.8",
    "model_sha256": {"segmentation.onnx": "SHA256", "embedding.onnx": "SHA256"},
    "requested_num_speakers": -1,
    "cluster_threshold": 0.5
  }
}
```

The endpoint uses the existing owner ACL; a result without diarization
returns 409 `diarization_not_available`. Raw turns, speaker UUIDs and model
provenance are immutable in `ResultVersion.diarization` JSONB. Migration
`0007` adds this nullable column after current revision `0005`; the pending
extraction migration must be ordered by the coordinator before integration.

Transcript `Segment.speaker_id` is assigned only when its interval intersects
exactly one voice. Cross-voice and unvoiced segments stay null. No sentence
is copied or falsely split; raw diarization intervals remain available.

Existing GET/PATCH `.../results/{v}/review` gains `speakers`:

```json
{
  "revision": 1,
  "speakers": [
    {"speaker_id": "UUID-A", "participant_id": "PARTICIPANT-UUID"},
    {"speaker_id": "UUID-B", "merged_into_speaker_id": "UUID-A"}
  ]
}
```

Read rows additionally include their anonymous `label`; PATCH omits that
read-only field. The array replaces assignments: omitted speaker IDs become
unknown, `[]` clears all, and omitting the entire field preserves it. A merge
source must have null participant and point directly at another canonical
speaker; self-merges, chains/cycles and foreign IDs are rejected with 422.
Participants must belong to this meeting. Resolve a source speaker through
its canonical row to the confirmed participant in the review's participant
snapshot; names are never inferred. Action-item assignees remain independent.

These changes use existing CAS (stale revision 409), immutable review
snapshots and approval rules: edits clear approval unless `reviewed=true`
is explicit. Raw segment/turn speaker IDs remain stable after a human merge.

## Deployment and proof boundary

The processing Dockerfile installs the separate locked diarization runtime
and copies its two inference scripts. The worker uses the existing read-only
`/models` mount and internal network. Before enabling diarization jobs,
prepare `diarization-v1` inside the host `STT_MODELS_PATH` directory.
`BACKEND_DIARIZATION_MODEL_PATH` defaults to `/models/diarization-v1`.
Executable/script settings default to `/app/diarize/.venv/bin/python` and
`/app/diarize/diarize.py`. Nothing downloads during jobs.

The supervisor discards stderr, bounds output to 8 MiB/20,000 turns, checks
ordered timestamps, duration and completion counts, and kills the process
group on cancellation. The existing job timeout and lease cover both stages.
Result publication occurs only after the requested stages finish successfully.

A bounded local integration scenario passed 45 checks with the real offline
Sherpa supervisor (3.629 s), isolated PostgreSQL upgraded to `0007`, actual
EdDSA JWT verification, local JWKS and auth/session tables. Requests used the
ASGI application, not a production server. Two anonymous voices/four turns,
provenance, stable UUIDs, ambiguous-null attribution, participant confirmation,
independent assignee, merge/clear/omit semantics, immutable history and ACL/
CAS/422 rejection were verified. Transcript text was a controlled synthetic
fixture, explicitly marked `synthetic-fixture-not-asr`, not an STT result.
The backend wheel/sdist built, and OpenAPI/TypeScript SDK were regenerated.

The review UI consumer, a real uploaded STT-to-diarization job and server
release remain separate integration steps. This evidence does not close #12
or establish real-meeting diarization quality. No test suites or linters ran.
