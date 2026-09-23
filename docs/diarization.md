# Local anonymous speaker diarization

Issue #12 now has a standalone CPU CLI in `tools/diarize/`. It does not
yet run in the processing worker or provide participant confirmation.
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

## Integration handoff

The integration owner must install this lock into the processing image,
copy `diarize.py` and `bundle.py` together, and configure explicit executable,
script and read-only model directory paths. Use the existing subprocess
supervision pattern: discard stderr, bound stdout/time, terminate the entire
process group on cancellation, and reject incomplete/invalid event streams.
Validate the returned duration against the normalized recording.

Persist anonymous turns/model provenance per result version, assign stable
speaker UUIDs within that version, and retain unknown participant identity.
Whisper segments can span speaker changes: preserve ambiguous labels as
unknown until alignment or correction; do not copy a whole sentence onto
multiple speakers. Extend the existing review revisions for confirmation
and label merging, retaining owner ACLs, CAS and historical export snapshots.
An action item's assignee remains independent of the person speaking.

The current #69 owner controls processing/results/config/Compose/codegen;
this standalone feature changes none of those files. Backend wiring,
participant mapping, review UI, real two-voice evaluation and live proof
remain required before closing #12. Shared stack metadata should record this
new locked environment when that integration lands.
