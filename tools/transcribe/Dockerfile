FROM python:3.13-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.13 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app/api
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-install-project
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-editable
WORKDIR /app/stt
COPY tools/transcribe/pyproject.toml tools/transcribe/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev
WORKDIR /app/diarize
COPY tools/diarize/pyproject.toml tools/diarize/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app
WORKDIR /app/api
COPY --from=builder /app/api/.venv /app/api/.venv
COPY --from=builder /app/stt/.venv /app/stt/.venv
COPY --from=builder /app/diarize/.venv /app/diarize/.venv
COPY tools/transcribe/transcribe.py tools/transcribe/prepare_model.py /app/stt/
COPY tools/diarize/diarize.py tools/diarize/bundle.py /app/diarize/
COPY tools/extract/extract /app/extract/extract
COPY tools/extract/run.py /app/extract/run.py
ENV PATH="/app/api/.venv/bin:$PATH" PYTHONUNBUFFERED=1 \
    HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 OMP_NUM_THREADS=4
USER app
CMD ["python", "-m", "saint_tibo.modules.processing.worker"]
