# Self-hosted Honcho slice

This isolated stack starts the upstream Honcho server and its deriver beside
our main Compose project. It declares a loopback-only API port mapping (default
18000), keeps Postgres and Redis private, and places every service on a Docker
internal network. Closed-contour settings point LLM features at explicit local
OpenAI-compatible endpoints and disable Honcho CloudEvents telemetry. Smoke
uses only synthetic records.

The upstream image is Honcho v3.2.0, pinned in Compose to registry digest
`sha256:6369a1a8387f560fd71296866a5e109420e3442ce2ea9ffdcf9f38529de416c1`.
Set HONCHO_IMAGE only when intentionally changing the upstream version.

## Start locally

```sh
cd tools/honcho
cp .env.example .env
# Replace all passwords/JWT secret with locally generated values.
# Point LOCAL_LLM_BASE_URL and LOCAL_EMBEDDING_BASE_URL to local compatible
# endpoints reachable from Docker; they must support tool calling and the
# configured embedding model. Never configure a cloud URL here.
./prepare-tiktoken-cache.sh
docker compose config -q
docker compose up -d
```

`AUTH_USE_AUTH=true` requires `HONCHO_JWT_SECRET`. The JWT used by an
application adapter must be minted with the same secret and scoped to the
intended Honcho workspace. An admin JWT has full instance access and must stay
server-only. The smoke script creates an in-memory admin JWT only to get-or-create
its synthetic workspace, then uses a workspace-scoped token. It does not include an
`exp` claim because upstream expects an ISO timestamp while PyJWT rejects that
claim format; the token is never printed or saved. It uses only synthetic data:

```sh
./smoke.sh
```

Check `docker compose ps`, `docker compose logs api deriver`, and the smoke
output. Stop without deleting the persistent database with `docker compose
down`.

## Synthetic smoke scope

`smoke.py` get-or-creates a fixed synthetic workspace, participant and meeting
session, then lists messages before creating one attributed fixture segment.
Re-running the smoke confirms the stable `source_id` still occurs once; this is
sequential smoke idempotency, not race-safe ingestion. It also proves a
workspace-scoped token receives HTTP 401 when it attempts a peer-card read in
another workspace. The script prefers the loopback port; if an engine does not
publish ports from an internal network, it discovers the API container address.
It does not use or bind Saint Tibo's port 3000.

## Limits of this first slice

No backend adapter, UI, shared Compose, or processing pipeline changes are
included. Honcho has its own storage, auth, retries, and queue; the app has not
yet established an idempotent outbox or app-owner authorization bridge. API
read/query access must remain behind a future server-side adapter that checks
meeting ownership before it calls Honcho. Honcho work units may fail if the
selected local model lacks the required tool-call/embedding behavior. The live
smoke verified API ingestion and workspace scoping, and an outbound HTTPS
probe from the Honcho container failed DNS resolution as expected. This host had
no local OpenAI-compatible model listening at the configured endpoint: embedding
requests retried and derived cards/questions were not verified. Inspect deriver
logs and queue status before considering memory derivation complete.
