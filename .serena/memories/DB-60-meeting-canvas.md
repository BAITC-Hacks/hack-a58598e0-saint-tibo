# DB-60 Meeting canvas versions

## Current Behavior

- Migration `0009_meeting_canvas.py` follows 0008 and creates
  `app.meeting_canvases` with unique `(meeting_id, revision)`, seven nullable
  text fields, and a trigger rejecting UPDATE. Saves append rows only.
- Nullable FK `recordings.canvas_version_id` pins the canvas at recording
  creation; nullable FK `result_versions.canvas_version_id` records provenance.
  Existing rows remain null. Meeting deletion still cascades its data.
- A fresh isolated PostgreSQL upgrade plus `alembic check` passed.

## Known Gaps

- No backfill is intended: old meetings/results must remain usable with null.
- This branch is not merged or deployed.

Last commit: `1f344997069541a5d3a34a9fa2766b512682673e` (isolated #60 lane).
