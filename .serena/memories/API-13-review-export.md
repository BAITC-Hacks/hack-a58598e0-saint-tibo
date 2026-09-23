# API-13 Reviewed results and protocol export

## Current Behavior

- Integrated dev `97e804e` contains #13/#14 feature `0203111`
  (implementation `fadf4bc`), `modules/results/`, `modules/exports/`,
  migration 0005 and generated OpenAPI/SDK. Details: `docs/reviewed-results.md`.
- Prefix `R=/api/v1/meetings/{meeting_id}/recordings/{recording_id}/results/{result_version_id}`.
  `GET R/review[?revision=N]`, `PATCH R/review` and
  `GET R/export?format=pdf|docx&revision=N` require owner JWT.
  Read/export need meeting:read; PATCH needs meeting:write; foreign admin →404.
- GET returns source=persisted, IDs/revision/reviewed/incomplete/saved_at,
  meeting/participants, action_items and summary; no speakers/segments.
  Initial revision=1 is empty manual draft; saved history starts at revision=2.
- PATCH requires current revision plus a change; stale →409 version_conflict.
  Arrays/summary replace whole supplied fields; omitted fields persist.
  Explicit null is rejected. Content changes clear approval unless the
  same save explicitly includes reviewed=true.
- Action items keep ID, nullable participant/free-text assignee, original
  due_text, nullable due_date, status and source_segment_ids. PATCH excludes
  read-only result_version_id. Server does not infer assignee or date.
- Same-meeting assignee and same-recording/result source IDs are validated.
  Summary has topics/decisions/open_questions and one shared source-ID list.
  Manual notes may have empty sources; they are not evidence of model output.
- Each save freezes metadata/participants, review fields and approval in
  ResultReview JSONB; later metadata edits do not change old exports.
  New processing creates another result version; deletion cascades reviews.
- Limits: 200 action items, 100 summary entries per list/100 sources per object,
  2000-character text, 500-character labels, 512 KiB snapshot.
  Whitespace-only/invalid document characters are rejected.
- Explicit export revision is required: saved reviewed snapshot → PDF/DOCX,
  draft →409 result_not_reviewed, missing revision →404. Older approved
  snapshots remain exportable after current approval is cleared.
- Export renders in a threadpool with attachment/no-store/nosniff headers;
  generated SDK uses authenticated fetch with parseAs=blob. Never put JWT in URL.
- PDF embeds vendored DejaVu; DOCX specifies the font without embedding TTF.
  Incomplete source is marked; local table/page/character checks are linked
  in [#14 evidence](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793605774).
- Independent [LIVE-OK 97e804e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793710152)
  proves real JWT/save/reload/conflict/ACL/422 validation and authenticated
  PDF/DOCX downloads; historical r2 JSON/decoded documents stayed immutable.
  Targeted continuation passed 57/57, own app/auth cleanup counts=0.

## Known Gaps

- #14 is closed for backend downloads/renderer; UI button integration stays
  with Artem. Local identity-substituted proof and real live proof are separate.
- completed_stage stays transcribe after human review. Automatic extraction
  (#69), diarization/speaker confirmation (#12), STT text edits and reminders
  (#15) are separate work. #13 is only partially delivered.
- Renderer headings are RU; summary sources are shared, manual duplicate
  merging remains manual, and JSONB actions lack cross-meeting query projection.
- #85 meeting-level review/export mock paths are not real API. Select a
  recording/result and use the version routes; fetch transcript separately.

Last commit: `ab3d3312c3bafb3892bde93539383cea9e48b6de` (audited tree, 2026-09-23; live evidence is separate).
