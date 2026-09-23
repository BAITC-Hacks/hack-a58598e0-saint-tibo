"""Exercise authorization and revocation using temporary accounts."""

import argparse
import asyncio
import secrets
from contextlib import AsyncExitStack

import httpx
from smoke_auth import wait_ready
from sqlalchemy import text

from saint_tibo.auth.policy import Role, permissions_for
from saint_tibo.core.config import Settings
from saint_tibo.db.session import create_engine


def expect(response: httpx.Response, status: int) -> None:
    if response.status_code != status:
        # Responses may contain tokens: never include response bodies in test output.
        raise RuntimeError(
            f"{response.request.url.path}: expected {status}, got {response.status_code}"
        )


async def login(client: httpx.AsyncClient, email: str, password: str) -> str:
    response = await client.post(
        "/api/auth/sign-in/email", json={"email": email, "password": password}
    )
    expect(response, 200)
    return str(response.json()["user"]["id"])


async def token(client: httpx.AsyncClient) -> dict[str, str]:
    response = await client.get("/api/auth/token")
    expect(response, 200)
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def check(auth_url: str, api_url: str) -> None:
    engine = create_engine(Settings())
    suffix = secrets.token_hex(8)
    admin_email = f"rbac-admin-{suffix}@example.com"
    user_email = f"rbac-user-{suffix}@example.com"
    temporary_email = f"rbac-smoke-{suffix}@example.com"
    signup_email = f"rbac-signup-{suffix}@example.com"
    async with AsyncExitStack() as stack:
        clients = [
            await stack.enter_async_context(
                httpx.AsyncClient(base_url=auth_url, headers={"Origin": auth_url}, timeout=5)
            )
            for _ in range(4)
        ]
        admin, user, temporary, signup = clients
        await wait_ready(admin, f"{auth_url}/api/auth/get-session")
        await wait_ready(admin, f"{api_url}/health/ready")
        try:
            password = secrets.token_urlsafe(24)
            for client, email in [(admin, admin_email), (user, user_email)]:
                expect(
                    await client.post(
                        "/api/auth/sign-up/email",
                        json={"email": email, "name": "RBAC check", "password": password},
                    ),
                    200,
                )
            # Bootstrap only this temporary administrator, never an existing account.
            async with engine.begin() as connection:
                await connection.execute(
                    text('UPDATE auth."user" SET role = :role WHERE email = :email'),
                    {"role": "admin", "email": admin_email},
                )
            admin_id = await login(admin, admin_email, password)
            user_id = await login(user, user_email, password)
            admin_token, user_token = await token(admin), await token(user)
            admin_me = await admin.get(f"{api_url}/api/v1/me", headers=admin_token)
            user_me = await user.get(f"{api_url}/api/v1/me", headers=user_token)
            expect(admin_me, 200)
            expect(user_me, 200)
            if admin_me.json()["role"] != "admin" or user_me.json()[
                "permissions"
            ] != permissions_for(Role.USER):
                raise RuntimeError("Unexpected effective roles/permissions")
            expect(await admin.get(f"{api_url}/api/v1/admin/access", headers=admin_token), 200)
            expect(await user.get(f"{api_url}/api/v1/admin/access", headers=user_token), 403)
            expect(await user.get("/api/auth/admin/list-users"), 403)
            expect(
                await user.post(
                    "/api/auth/admin/set-role", json={"userId": user_id, "role": "admin"}
                ),
                403,
            )
            expect(
                await admin.post(
                    "/api/auth/admin/set-role", json={"userId": admin_id, "role": "user"}
                ),
                403,
            )
            expect(
                await admin.post(
                    "/api/auth/admin/set-role", json={"userId": user_id, "role": ["user", "admin"]}
                ),
                400,
            )
            print(
                "PASS: admin/user permissions; no self-escalation, self-demotion or multiple roles"
            )

            password = secrets.token_urlsafe(24)
            response = await admin.post(
                "/api/auth/admin/create-user",
                json={
                    "email": temporary_email,
                    "name": "RBAC smoke test",
                    "password": password,
                    "role": "user",
                },
            )
            expect(response, 200)
            temporary_id = await login(temporary, temporary_email, password)
            old_token = await token(temporary)
            expect(
                await admin.post(
                    "/api/auth/admin/set-role", json={"userId": temporary_id, "role": "admin"}
                ),
                200,
            )
            expect(await temporary.get(f"{api_url}/api/v1/admin/access", headers=old_token), 200)
            expect(
                await admin.post(
                    "/api/auth/admin/set-role", json={"userId": temporary_id, "role": "user"}
                ),
                200,
            )
            expect(await temporary.get(f"{api_url}/api/v1/admin/access", headers=old_token), 403)
            expect(
                await admin.post("/api/auth/admin/impersonate-user", json={"userId": temporary_id}),
                403,
            )
            expect(
                await admin.post(
                    "/api/auth/admin/ban-user",
                    json={"userId": temporary_id, "banReason": "Smoke test"},
                ),
                200,
            )
            denied = await temporary.get(f"{api_url}/api/v1/me", headers=old_token)
            if denied.status_code not in {401, 403}:
                raise RuntimeError("A banned account retained API access")
            print("PASS: role changes and account blocking affect already-issued JWTs immediately")

            # Public signup rejects role injection and preserves the normal password policy.
            body = {"email": signup_email, "name": "Signup test", "password": "user"}
            expect(await signup.post("/api/auth/sign-up/email", json=body), 400)
            body["password"] = password
            expect(
                await signup.post("/api/auth/sign-up/email", json={**body, "role": "admin"}), 400
            )
            expect(await signup.post("/api/auth/sign-up/email", json=body), 200)
            response = await signup.get(f"{api_url}/api/v1/me", headers=await token(signup))
            expect(response, 200)
            if response.json()["role"] != "user":
                raise RuntimeError("Public signup escalated privileges")
            expect(await user.post("/api/auth/sign-out", json={}), 200)
            expect(await user.get(f"{api_url}/api/v1/me", headers=user_token), 401)
            print("PASS: signup cannot set roles or use short passwords; logout revokes JWT access")
        finally:
            async with engine.begin() as connection:
                await connection.execute(
                    text('DELETE FROM auth."user" WHERE email IN (:a, :b, :c, :d)'),
                    {"a": temporary_email, "b": signup_email, "c": admin_email, "d": user_email},
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
