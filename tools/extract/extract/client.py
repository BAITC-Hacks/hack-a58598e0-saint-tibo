"""Loopback only, no proxies, redirects, retries, cloud fallback, or content logging."""

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from extract.schema import ExtractionError, parse_and_validate, response_format


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ExtractionError("extraction_redirect_rejected")


def local_request(server_url: str, path: str, body: dict | None = None, timeout: float = 5) -> dict:
    parsed = urllib.parse.urlsplit(server_url)
    if (parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "::1")
            or parsed.username or parsed.password or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment):
        raise ExtractionError("extraction_nonlocal_url")
    request = urllib.request.Request(
        server_url.rstrip("/") + path,
        data=None if body is None else json.dumps(body, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=timeout) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise ExtractionError("extraction_output_too_large")
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ExtractionError("invalid_extraction_output")
        return result
    except (urllib.error.URLError, OSError, ValueError) as exc:
        if isinstance(exc, ExtractionError):
            raise
        raise ExtractionError("extraction_runtime_failed") from exc


def chat_extraction(
    server_url: str, system_prompt: str, user_prompt: str, known_segment_ids: set[int], *,
    model_label: str = "local", temperature: float = 0.0, max_tokens: int = 2048,
    timeout_s: float = 1800,
) -> tuple[dict[str, Any], dict[str, Any]]:
    result = local_request(server_url, "/v1/chat/completions", {
        "model": model_label,
        "messages": [{"role": "system", "content": system_prompt},
                     {"role": "user", "content": user_prompt}],
        "temperature": temperature, "max_tokens": max_tokens,
        "response_format": response_format(), "stream": False, "cache_prompt": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }, timeout_s)
    choices = result.get("choices")
    if not isinstance(choices, list) or len(choices) != 1 or not isinstance(choices[0], dict):
        raise ExtractionError("invalid_extraction_output")
    choice = choices[0]
    if choice.get("finish_reason") != "stop":
        raise ExtractionError("extraction_incomplete")
    message = choice.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        raise ExtractionError("invalid_extraction_output")
    payload = parse_and_validate(content, known_segment_ids)
    # Return numeric metrics only; an untrusted runtime cannot smuggle content into logs.
    usage = result.get("usage", {})
    return payload, {"usage": {k: usage[k] for k in ("prompt_tokens", "completion_tokens")
                               if isinstance(usage, dict) and type(usage.get(k)) is int}}
