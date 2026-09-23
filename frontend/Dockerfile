# Dependencies and sources. `auth-migrate` in compose.yaml stops here to run drizzle-kit.
FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
RUN bun install --frozen-lockfile
COPY . .

FROM deps AS builder
# Client-side env is baked into the bundle, so it must be a browser-reachable URL.
ARG VITE_API_URL=http://localhost:8000
ARG VITE_APP_TITLE="Хаттама"
ARG VITE_TRANSCRIPT_EXTRACTION_ENABLED=false
# Prerendering the shell boots the server bundle, so the build needs the server variables to
# exist. Real values are injected at runtime.
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_TITLE=$VITE_APP_TITLE \
    VITE_TRANSCRIPT_EXTRACTION_ENABLED=$VITE_TRANSCRIPT_EXTRACTION_ENABLED \
    AUTH_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_URL=http://localhost:3000 \
    BETTER_AUTH_SECRET=build-time-placeholder-unused-at-runtime \
    BETTER_AUTH_JWT_AUDIENCE=saint_tibo-api
RUN bun run generate && bun run build

FROM oven/bun:1.4.2-alpine
WORKDIR /app
RUN addgroup -g 10001 app && adduser -D -u 10001 -G app app
COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
RUN bun install --frozen-lockfile --production
COPY server.ts ./
COPY --from=builder /app/dist ./dist
USER app
EXPOSE 3000
ENV FRONTEND_PORT=3000
CMD ["bun", "run", "server.ts"]
