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

## Local model endpoints

Honcho can use self-hosted OpenAI-compatible models for both chat **and embeddings**. For example, run a local model server such as [LM Studio](https://lmstudio.ai/docs/developer/openai-compat) with a chat model and a compatible embedding endpoint, then set these values in the private `tools/honcho/.env` (replace model names with identifiers served by your server):

```dotenv
LOCAL_LLM_BASE_URL=http://host.docker.internal:1234/v1
LOCAL_EMBEDDING_BASE_URL=http://host.docker.internal:1234/v1
LOCAL_LLM_API_KEY=local-only-placeholder
DERIVER_MODEL_CONFIG__MODEL=<local-chat-model>
SUMMARY_MODEL_CONFIG__MODEL=<local-chat-model>
EMBEDDING_MODEL_CONFIG__MODEL=<local-embedding-model>
DIALECTIC_LEVELS__minimal__MODEL_CONFIG__MODEL=<local-chat-model>
DIALECTIC_LEVELS__low__MODEL_CONFIG__MODEL=<local-chat-model>
DREAM_DEDUCTION_MODEL_CONFIG__MODEL=<local-chat-model>
DREAM_INDUCTION_MODEL_CONFIG__MODEL=<local-chat-model>
```

On macOS and Windows Docker Desktop, `host.docker.internal` points from a container to the host; [LM Studio must listen on an address reachable from those containers](https://lmstudio.ai/docs/developer/core/server/serve-on-network). On Linux, use a private Compose service name or configure the host gateway for the Honcho containers. If chat and embedding models are served separately, use different URLs. Keep the values and any real API keys private. Start without `external-api.compose.yaml` so the Honcho containers stay on the private network.

Before using real participant data, test `/v1/chat/completions` and `/v1/embeddings` from inside the Honcho network with synthetic input, then run `tools/honcho/smoke.sh`. Check that the selected models and embedding dimensions work with Honcho's derivation. The URL switch has not yet been validated end to end for the closed-contour migration; that compatibility check is still required for #96.
