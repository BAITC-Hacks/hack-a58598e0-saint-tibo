# API-60 Meeting canvas

## Current Behavior

- `modules/meetings/router.py` exposes owner-scoped GET current, PUT new version,
  and GET exact version at `/api/v1/meetings/{meeting_id}/canvas`.
- PUT requires all seven nullable sections and `base_revision`. Null means unknown;
  `""` means explicitly empty. A stale revision returns 409 `canvas_conflict`.
- `create_recording` pins the latest canvas ID (or null); `publish_transcript`
  copies that ID to ResultVersion. Result read exposes `canvas_version_id`.
- OpenAPI and generated TypeScript SDK are regenerated from these operations.

## Known Gaps

- #61 templates are intentionally untouched. This branch is not merged or deployed.
- Browser proof covered canvas save/reopen/two-tab conflict; a real processed result
  was not rendered in the browser. The integration check publishes a synthetic
  transcript through the real service and verifies the exact canvas ID.

Last commit: `1f344997069541a5d3a34a9fa2766b512682673e` (isolated #60 lane).
