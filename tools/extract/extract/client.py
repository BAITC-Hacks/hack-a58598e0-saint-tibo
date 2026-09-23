"""Minimal OpenAI-compatible client for a local llama-server on loopback.

Stdlib only: the worker stage must not pull network-capable SDKs into the
offline processing environment. The server itself is expected to run with
no egress (network namespace or --network none container).
"""

import json
import urllib.error
import urllib.request
from typing import Any

from extract.schema import ExtractionError, parse_and_validate, response_format


def chat_extraction(
    server_url: str,
    system_prompt: str,
    user_prompt: str,
    known_segment_ids: set[int],
    *,
    model_label: str = "local",
    temperature: float = 0.0,
    max_tokens: int = 4096,
    timeout_s: float = 3600.0,
    attempts: int = 2,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Request a schema-constrained extraction. Returns (payload, meta).

    Retries only on invalid output; transport errors abort immediately —
    retrying a timed-out generation would double the bill.
    """
    body = {
        "model": model_label,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": response_format(),
        "stream": False,
        "cache_prompt": True,
    }
    request = urllib.request.Request(
        f"{server_url.rstrip('/')}/v1/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise ExtractionError(f"local server unreachable: {exc.reason}") from exc
        content = result.get("choices", [{}])[0].get("message", {}).get("content")
        if not isinstance(content, str):
            raise ExtractionError("empty completion content")
        try:
            payload = parse_and_validate(content, known_segment_ids)
        except ExtractionError as exc:
            last_error = exc
            continue
        meta = {
            "usage": result.get("usage", {}),
            "timings": result.get("timings", {}),
        }
        return payload, meta
    raise ExtractionError(f"extraction failed validation: {last_error}")
