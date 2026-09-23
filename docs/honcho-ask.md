# Temporary organization questions

`POST /api/v1/org/questions` accepts `{ "query": "..." }` with the normal app bearer token. It reads only the caller's meetings and participants. Each owner receives a separate Honcho workspace and workspace-scoped token. The browser never receives Honcho credentials. `/ask` sends the question through that protected API and shows the answer or unavailable state.

This narrow slice answers from participant names, roles, and meeting titles. It does not yet ingest full transcripts or create persistent person identities across meetings; those remain in #103/#83. A role edit after initial ingestion may leave stale Honcho memory until the full sync/retry adapter lands. The UI states its source scope.

## Temporary API provider

The owner authorized a temporary external model API for this flow. **Participant names, roles, meeting titles, and questions can leave the server to that provider through Honcho.** This is not the final closed-contour deployment. Set `tools/honcho/.env` with a private key and OpenAI-compatible chat and embedding URLs/models. Never commit or print that file. For the temporary mode, start Honcho with:

```sh
cd tools/honcho
docker compose -f compose.yaml -f external-api.compose.yaml up -d
```

The overlay gives only Honcho API/deriver outbound network access. Set `BACKEND_HONCHO_URL=http://api:8000` and `BACKEND_HONCHO_JWT_SECRET` to the **same** private secret in the main app's `.env`. Once both stacks are running on the host, join the app backend to the private Honcho network with `docker network connect saint-honcho_honcho saint_tibo-backend-1`. The default app deployment leaves these settings empty; `/ask` answers 503 until this bridge is configured.

Replace the external URLs and model names with local chat/embedding endpoints, omit `external-api.compose.yaml`, and keep the network private to finish the closed-contour migration. This still needs an actual model compatibility and derivation run before #96 can close.
