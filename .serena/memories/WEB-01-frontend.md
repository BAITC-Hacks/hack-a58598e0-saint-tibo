# WEB-01 Canonical meeting workspace

## Current Behavior

- Artem's full UI is integrated (`117d9b8`, merge `6988054`).
  Canonical entry is `/meetings`; `pages/meeting-workspace/` owns list,
  creation, recording upload/jobs, transcript/review and authenticated export.
- `_app.index.tsx` currently renders SurfacesPage(kind=today), not a redirect.
  Protected routes include meetings, player, capture and auxiliary surfaces;
  ask/admin data surfaces explicitly show unavailable when not implemented.
- `api/meetings.ts` uses the generated backend SDK and polls active jobs
  every 3s. `api/review.ts` selects the latest result across fetched recordings,
  loads all segment pages, then fetches version-scoped persisted review.
- Real review adapts summary strings/source IDs/action items into the editor;
  speakers are empty in core 6ed682e; shared #12 is not deployed. Save sends revision
  and human data; export downloads a JWT-authenticated Blob with explicit revision.
- #107 `a8886bd` clears approval on content edits; search/playback do not.
  Save/reload disable controls. Conflict409 preserves draft and offers explicit
  reload of the same recording/result; failed reload preserves local fields.
  Background focus/reconnect review refresh is off to avoid losing drafts.
- Mock review paths run only in explicit Vite DEV mode; production fails closed
  (API-03). /player is now protected server recordings only (#110).
- Shared auth is Better Auth plus effective /me permissions. Existing dev
  automatic login is guarded; DEMO.md documents owner-authorized ordinary
  persistent demo accounts and /meetings entry without infrastructure secrets.
- UI dictionaries live in `messages/{ru,kk,en}.json` and the workspace's
  `lib/{ru,kk,en}.ts`; preserve all locales/shared UI and local brand assets.
  Architecture: `docs/ui-architecture.md`, `docs/ui-kit.md`.

## Known Gaps

- [Browser PASS 6ed682e](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5794265640)
  confirms the real case2/54-segment flow, manual approval/edit reset, two-tab 409
  draft preservation/explicit reload, PDF/DOCX and seek 44.9→play 52.1s. #107 CLOSED.
  Production 7d5b481 is LIVE-OK (TEST-01); coordinator also reports login/UI PASS.
- #107 fallback b095035 remains UNMERGED; don't reintroduce a second workspace.
- Diarization/automatic extraction and complete auxiliary backend surfaces are
  not supplied by the presence of their UI tabs. Owner claims stay in GitHub.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
