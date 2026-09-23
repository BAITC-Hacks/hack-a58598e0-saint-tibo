# Resume #22

Worktree branch: `ivan/22-capture-lifecycle`, based on `origin/dev` at
`007b2c1f6cac592f4702f05e691404015b38b02c`.

Current law: user authorized local commits only. Do not push/merge/deploy or
touch the main checkout, dev-ivan, UI/AppShell or backend/storage owners' files.
No cloud AI audio/text processing; no real platform access has been provided.

Done:

- `59a075fca5e4b340ff32d63424226bf76989673e`: URL policy, bounded adapter
  lifecycle, #8 statuses and #9 sink boundary, 26 synthetic scenarios.
- `190900d22c8ea3c99b522409d4fc730a6e642cab`: integration docs and blockers.
- Check: Bun 1.4.2 scenario runner passes; strict TypeScript 7.0.2 passes;
  diff whitespace check passes. These are kernel proofs, not platform evidence.
- Lifecycle/sink contract posted to #8. #22 remains open.

Next: integrate coordinator's `docs/meeting-connectors.md` separately; select
and prove one permitted real adapter in a controlled meeting. Confirm backend
service-auth/record allocation and build a real sink using #9's published SDK.
Obtain platform/provider accesses outside public issues. For Meeting BaaS use
the documented Kubernetes route unless a Compose port is separately proven;
do not install without vendor images/access and egress constraints.

Read `.serena/memories/INFRA-22-CAPTURE.md` and the module README for exact
interfaces, cancellation/finalization semantics and cleanup limitations.
