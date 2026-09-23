#!/usr/bin/env python3
"""Exercise one synthetic, stable-ID message against a running local Honcho."""

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
import uuid


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def token(secret: str) -> str:
    expires = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 900))
    head = b64url(b'{"alg":"HS256","typ":"JWT"}')
    body = b64url(json.dumps({"t": "", "ad": True, "exp": expires}, separators=(",", ":")).encode())
    signing = f"{head}.{body}".encode()
    sig = hmac.new(secret.encode(), signing, hashlib.sha256).digest()
    return f"{head}.{body}.{b64url(sig)}"


def request(url: str, bearer: str, payload: dict | None = None) -> tuple[int, object]:
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
        raise RuntimeError(f"Honcho {error.code} at {url}: {error.read().decode()[:500]}") from error


def main() -> None:
    base = os.environ.get("HONCHO_URL", "http://127.0.0.1:18000").rstrip("/")
    bearer = token(os.environ["HONCHO_JWT_SECRET"])
    workspace = "smoke-" + uuid.uuid4().hex[:12]
    peer = "synthetic-participant"
    session = "synthetic-meeting-" + uuid.uuid4().hex[:8]
    stable_id = "fixture-segment-0001"
    text = "Synthetic smoke only: the meeting agreed to review the sample next week."

    request(f"{base}/v3/workspaces", bearer, {"id": workspace, "metadata": {"fixture": "synthetic"}})
    request(f"{base}/v3/workspaces/{workspace}/peers", bearer, {"id": peer, "metadata": {"fixture": "synthetic"}})
    request(f"{base}/v3/workspaces/{workspace}/sessions", bearer, {"id": session, "metadata": {"fixture": "synthetic"}, "peers": [peer]})
    payload = {"messages": [{"content": text, "peer_id": peer, "metadata": {"source_id": stable_id, "fixture": "synthetic"}}]}
    request(f"{base}/v3/workspaces/{workspace}/sessions/{session}/messages", bearer, payload)
    request(f"{base}/v3/workspaces/{workspace}/sessions/{session}/messages", bearer, payload)
    _, result = request(f"{base}/v3/workspaces/{workspace}/sessions/{session}/messages/list?page=1&size=100", bearer, {"filters": {}})
    messages = result.get("items", []) if isinstance(result, dict) else result
    found = [item for item in messages if item.get("metadata", {}).get("source_id") == stable_id]
    if len(found) != 1:
        raise SystemExit(f"idempotency check failed: expected one {stable_id}, found {len(found)}")
    print(f"PASS synthetic ingestion idempotent: workspace={workspace} session={session} source_id={stable_id}")


if __name__ == "__main__":
    main()
