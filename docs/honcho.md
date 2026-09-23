# Self-hosted Honcho slice

This isolated stack starts the upstream Honcho server and its deriver beside
our main Compose project. It publishes only the API on loopback, keeps Postgres
and Redis private, and places all services on a Docker `internal` network. The
closed-contour configuration points every enabled LLM feature at explicitly
configured OpenAI-compatible local endpoints and disables Honcho CloudEvents
telemetry. No real meeting records belong in the smoke run.

The upstream image is Honcho v3.2.0 (`ghcr.io/plastic-labs/honcho:v3.2.0`),
matching upstream tag `v3.2.0`. Its API image digest is resolved by the registry
at pull time; set `HONCHO_IMAGE` to an approved digest to pin a specific
platform image in deployment.

## Start locally

```sh
cd tools/honcho
cp .env.example .env
# Replace all passwords/JWT secret with locally generated values.
# Point LOCAL_LLM_BASE_URL and LOCAL_EMBEDDING_BASE_URL to local compatible
# endpoints reachable from Docker; they must support tool calling and the
# configured embedding model. Never configure a cloud URL here.
docker compose config -q
docker compose up -d
```

`AUTH_USE_AUTH=true` requires `HONCHO_JWT_SECRET`. The JWT used by an
application adapter must be minted with the same secret and scoped to the
intended Honcho workspace. An admin JWT has full instance access; keep it
server-only. The smoke script creates a short-lived admin JWT locally and uses
only synthetic fixture data:

```sh
HONCHO_JWT_SECRET="$(sed -n 's/^HONCHO_JWT_SECRET=//p' .env)" python3 smoke.py
```

Check `docker compose ps`, `docker compose logs api deriver`, and the smoke
output. Stop without deleting the persistent database with `docker compose
down`.

## Synthetic smoke scope

`smoke.py` creates a uniquely named synthetic workspace, participant and
meeting session, then repeats one attributed transcript-segment message. It
checks Honcho's stored message list contains exactly one message with the
stable synthetic `source_id`. This demonstrates the upstream API and its
idempotent message handling. It does not connect the app pipeline, authorize
app users, or prove cross-user access control; those require the isolated
backend adapter and API endpoints in a follow-up slice.

## Optional OpenAI development opt-in

Cloud use is off by default and is not the closed-contour configuration. Only
for development with **synthetic fixture data**, copy
`dev/openai-cloud.env.example` to an ignored `.env.openai-dev`, set a dev-only API
key, and layer `dev/openai-cloud.compose.yaml` with `--env-file .env.openai-dev`.
This sends Honcho prompts and synthetic messages to OpenAI. Never use
meeting transcripts or real person data with this profile. Do not put keys in
Git, shell history, logs, issue comments, or browser code.

## Limits of this first slice

No backend adapter, UI, shared Compose, or processing pipeline changes are
included. Honcho has its own storage, auth, retries, and queue; the app has not
yet established an idempotent outbox or app-owner authorization bridge. API
read/query access must remain behind a future server-side adapter that checks
meeting ownership before it calls Honcho. Honcho work units may fail if the
selected local model lacks the required tool-call/embedding behavior; inspect
the deriver logs and queue status before considering ingestion complete.
