#!/usr/bin/env python3
"""Smoke the self-hosted Honcho API with synthetic data only."""

import base64
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def token(secret: str, *, workspace: Optional[str] = None, admin: bool = False) -> str:
    claims = {"t": "", "ad": admin}
    if workspace is not None:
        claims["w"] = workspace
    head = b64url(b'{"alg":"HS256","typ":"JWT"}')
    body = b64url(json.dumps(claims, separators=(",", ":")).encode())
    signing = f"{head}.{body}".encode()
    signature = hmac.new(secret.encode(), signing, hashlib.sha256).digest()
    return f"{head}.{body}.{b64url(signature)}"


def request(url: str, bearer: str, payload: Optional[Dict[str, Any]] = None) -> Tuple[int, Any]:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"},
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        return error.code, json.loads(raw) if raw else None


def require_success(result: Tuple[int, Any], operation: str) -> object:
    status, body = result
    if not 200 <= status < 300:
        raise RuntimeError(f"{operation} returned HTTP {status}: {body}")
    return body


def main() -> None:
    base = os.environ.get("HONCHO_URL", "http://127.0.0.1:18000").rstrip("/")
    secret = os.environ["HONCHO_JWT_SECRET"]
    workspace = "honcho-smoke-fixture"
    peer = "synthetic-participant"
    session = "synthetic-meeting-fixture"
    source_id = "fixture-segment-0001"
    synthetic_text = "Synthetic smoke only: the meeting agreed to review the sample next week."

    admin_token = token(secret, admin=True)
    require_success(
        request(f"{base}/v3/workspaces", admin_token, {"id": workspace, "metadata": {"fixture": "synthetic"}}),
        "create workspace",
    )
    scoped_token = token(secret, workspace=workspace)
    require_success(
        request(f"{base}/v3/workspaces/{workspace}/peers", scoped_token, {"id": peer, "metadata": {"fixture": "synthetic"}}),
        "create peer",
    )
    require_success(
        request(
            f"{base}/v3/workspaces/{workspace}/sessions",
            scoped_token,
            {"id": session, "metadata": {"fixture": "synthetic"}, "peers": {peer: {}}},
        ),
        "create session",
    )

    list_url = f"{base}/v3/workspaces/{workspace}/sessions/{session}/messages/list?page=1&size=100"
    items = require_success(request(list_url, scoped_token, {"filters": {}}), "list messages")["items"]
    existing = [item for item in items if item.get("metadata", {}).get("source_id") == source_id]
    if not existing:
        payload = {
            "messages": [{
                "content": synthetic_text,
                "peer_id": peer,
                "metadata": {"source_id": source_id, "fixture": "synthetic"},
            }]
        }
        require_success(
            request(f"{base}/v3/workspaces/{workspace}/sessions/{session}/messages", scoped_token, payload),
            "create synthetic message",
        )
        items = require_success(request(list_url, scoped_token, {"filters": {}}), "verify message")["items"]
        existing = [item for item in items if item.get("metadata", {}).get("source_id") == source_id]
    if len(existing) != 1:
        raise RuntimeError(f"expected one stable source_id after repeatable smoke run, found {len(existing)}")

    denied_status, _ = request(
        f"{base}/v3/workspaces/another-organization/peers/{peer}/card", scoped_token
    )
    if denied_status not in (401, 403):
        raise RuntimeError(f"workspace-scoped token crossed organization boundary: HTTP {denied_status}")

    print(f"PASS synthetic ingestion (one message, stable source_id={source_id})")
    print(f"PASS workspace scope denies cross-organization read (HTTP {denied_status})")


if __name__ == "__main__":
    main()
