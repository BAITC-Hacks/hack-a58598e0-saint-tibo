# API client generator

Use Bun 1.4.2 for dependencies and runtime. The local `bunfig.toml` also forces tool subprocesses to run with Bun.

Hey API uses the TypeScript Compiler API. It runs with its own pinned TypeScript
6 dependency, independently of the frontend's TypeScript 7 type checker.

From `frontend/`, run `bun run api:generate`. The command installs this tool's
locked dependencies and regenerates `src/shared/api/generated/` from the shared
OpenAPI contract. Do not edit generated files.
