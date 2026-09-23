# TEST-01 Verification — how "done" is proven

No CI pipeline; manual gates only.

## Local gates

- `bun run verify` — types, existing checks, build (the pre-push gate).
- `bun run test:integration` — auth + migrations on disposable PG (Docker).
- `frontend/src/shared/auth/permissions.test.ts` — only unit test so far.
- `bun run fix && bun run check` after frontend changes (conventions.md).

## Live gate (the real one)

1. From a clean checkout: `sh scripts/dev-deploy.sh saint-dev-<you>`.
2. Exercise the actual flow on your dev server (register → meeting →
   upload → …). No fake/static proof counts.
3. Comment on the issue: `done: <sha>` after merging to your lane;
   `integrated: <sha>` after your lane → `dev` + redeploy from `dev`
   + live check; `LIVE-OK <sha>` closes it.
4. `dev` is shared: after merging, everyone redeploys their own server
   from fresh `dev` — breakage on dev is on the merger.

## Acceptance style (per issues #9–#26)

Checkboxes demand evidence: resend-no-dup, foreign-access 404,
seek on long file, offline-after-bundle STT, corrupt file ≠ "done",
no replica text/tokens in logs. UI must distinguish empty / processing /
error / ready — never show "done" on unknown status.

## Prod

Danil only: deploy.sh `saint-prod` from `main` == `origin/main`,
after the same flow is green on dev. Then verify prod live.
