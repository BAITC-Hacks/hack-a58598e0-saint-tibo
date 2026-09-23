"""Local integration check against running frontend/backend/mock containers.

Run: uv run --directory backend --env-file ../.env python ../tools/mock-api/smoke_site.py
"""

import asyncio
import os
import secrets

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main():
    base = f"http://localhost:{os.environ.get('FRONTEND_PORT', '3000')}"
    backend = f"http://localhost:{os.environ.get('BACKEND_PORT', '8000')}"
    email = f"mock-smoke-{secrets.token_hex(6)}@example.invalid"
    password = secrets.token_urlsafe(24)
    engine = create_async_engine(os.environ["BACKEND_DATABASE_URL"])
    try:
        async with httpx.AsyncClient(base_url=base, timeout=15, headers={"Origin": base}) as client:
            assert (await client.get("/api/mock-mode")).status_code == 401
            assert (await client.get("/api/mock/api/v1/meetings")).status_code == 401
            signup = await client.post("/api/auth/sign-up/email", json={"name": "Mock smoke", "email": email, "password": password})
            assert signup.status_code == 200, signup.text
            mode = await client.get("/api/mock-mode")
            assert mode.status_code == 200 and mode.json()["mode"] == "real", mode.text
            assert mode.json().get("realConnected", True) and mode.json().get("mockConnected", True)
            assert (await client.get("/api/mock/api/v1/meetings")).status_code == 403
            token = (await client.get("/api/auth/token")).json()["token"]
            real = await client.get(f"{backend}/api/v1/me", headers={"Authorization": f"Bearer {token}"})
            assert real.status_code == 200 and real.json()["id"] == signup.json()["user"]["id"]
            switched = await client.post("/api/mock-mode", json={"mode": "mock"})
            assert switched.status_code == 200, switched.text
            created = await client.post("/api/mock/api/v1/meetings", json={"title": "Proxy POST smoke", "started_at": "2026-09-23T12:00:00Z", "timezone": "UTC"})
            assert created.status_code == 201 and created.json()["title"] == "Proxy POST smoke", created.text
            assert (await client.delete(f"/api/mock/api/v1/meetings/{created.json()['id']}")).status_code == 204
            meetings = await client.get("/api/mock/api/v1/meetings?limit=100")
            assert meetings.status_code == 200 and meetings.json()["total"] == 12, meetings.text
            meeting = "10000000-0000-4000-8000-000000000001"
            recording = "20000000-0000-4000-8000-000000000001"
            media = await client.get(f"/api/media/meetings/{meeting}/recordings/{recording}", headers={"Range": "bytes=0-43"})
            assert media.status_code == 206 and len(media.content) == 44 and media.content.startswith(b"RIFF"), media.status_code
            version = "40000000-0000-4000-8000-000000000001"
            export = await client.get(f"/api/mock/api/v1/meetings/{meeting}/recordings/{recording}/results/{version}/export?format=pdf&revision=2")
            assert export.status_code == 200 and export.content.startswith(b"%PDF"), export.text[:200]
            reset = await client.post("/api/mock/api/v1/demo/reset")
            assert reset.status_code == 200
            assert (await client.get("/api/mock/api/v1/meetings")).json()["total"] == 12
            assert (await client.post("/api/mock-mode", json={"mode": "real"})).status_code == 200
            assert (await client.get("/api/mock/api/v1/meetings")).status_code == 403
        print("site smoke: real session, real backend, mock switch, media range, export, reset, authorization OK")
    finally:
        async with engine.begin() as connection:
            await connection.execute(text('DELETE FROM auth."user" WHERE email = :email'), {"email": email})
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
