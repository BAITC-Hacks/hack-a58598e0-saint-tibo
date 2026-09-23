# API-13 Reviewed results and protocol export

## Current Behavior

- Audited dev has read-only transcript ResultVersion/Segment storage (API-10).
  Human corrections, summary/action-item persistence and review HTTP routes
  are absent from this tree.
- Existing `backend/src/saint_tibo/modules/exports/{schemas,render}.py`
  renders PDF/DOCX from `ProtocolExport` (implementation `2341256`).
  It accepts result ID/revision, meeting metadata, participants, speakers,
  segments, action items and optional summary.
- Action fields include assignee participant/text, original deadline text,
  nullable normalized date, status and source segment IDs.
  Summary contains topics, decisions and open questions.
- Vendored DejaVu fonts and license support Cyrillic/Kazakh output;
  keep attribution. Renderer existence does not imply an export endpoint.
- [#94 renderer proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510)
  verified PDF/DOCX generation and DOCX characters on the prior runtime;
  page layout and HTTP/UI downloads were not verified there.

## Known Gaps

- Active #13/#14 work is `feat/13-reviewed-export`; the
  [worker claim](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793502247)
  proposes owner-scoped version `/review`, revision CAS, immutable review
  snapshots and version `/export?format=pdf|docx&revision=N`.
  This is WIP until its commit is audited and integrated.
- #85's meeting-level `/meetings/{id}/review` and `/export` are UI mock
  contracts; do not advertise them as production API.
- Automated extraction/model selection (#69), speaker confirmation (#12),
  source-segment editing and reminders (#15) are separate acceptance.
  Do not invent assignee/deadline/year or equate speaker with executor.
- Relative dates require meeting date+timezone and retained original wording.
  Text/audio must remain within local/self-hosted processing.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
