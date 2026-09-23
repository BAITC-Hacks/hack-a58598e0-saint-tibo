"""Exercise real Better Auth sessions and JWT authentication."""

import argparse
import asyncio
import secrets

import httpx
from sqlalchemy import text

from saint_tibo.core.config import Settings
from saint_tibo.db.session import create_engine


async def wait_ready(client: httpx.AsyncClient, url: str) -> None:
    for _ in range(30):
        try:
            response = await client.get(url)
            if response.is_success:
                return
        except httpx.HTTPError:
            pass
        await asyncio.sleep(0.5)
    raise RuntimeError(f"Service did not become ready: {url}")


async def check(auth_url: str, api_url: str) -> None:
    email = f"backend-smoke-{secrets.token_hex(8)}@example.com"
    password = secrets.token_urlsafe(24)
    engine = create_engine(Settings())
    async with httpx.AsyncClient(timeout=5, headers={"Origin": auth_url}) as client:
        await wait_ready(client, f"{auth_url}/api/auth/get-session")
        await wait_ready(client, f"{api_url}/health/ready")
        try:
            response = await client.post(
                f"{auth_url}/api/auth/sign-up/email",
                json={"email": email, "password": password, "name": "Backend smoke test"},
            )
            response.raise_for_status()
            user_id = response.json()["user"]["id"]
            response = await client.post(
                f"{auth_url}/api/auth/sign-in/email", json={"email": email, "password": password}
            )
            response.raise_for_status()
            response = await client.get(f"{auth_url}/api/auth/token")
            response.raise_for_status()
            token = response.json()["token"]
            response = await client.get(
                f"{api_url}/api/v1/me", headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            if response.json()["id"] != user_id:
                raise RuntimeError("Backend returned a different user")
            response = await client.get(f"{api_url}/api/v1/me")
            if response.status_code != 401:
                raise RuntimeError("Backend accepted an unauthenticated request")
            print("PASS: signup → login → JWT → FastAPI; anonymous request rejected")
        finally:
            # Delete only the uniquely named test account, including its cascading sessions.
            async with engine.begin() as connection:
                await connection.execute(
                    text('DELETE FROM auth."user" WHERE email = :email'), {"email": email}
                )
            await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--auth-url", default="http://localhost:3000")
    parser.add_argument("--api-url", default="http://localhost:8000")
    args = parser.parse_args()
    asyncio.run(check(args.auth_url.rstrip("/"), args.api_url.rstrip("/")))


if __name__ == "__main__":
    main()
