import json
import os
import time

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from saint_tibo.auth.dependencies import get_current_user
from saint_tibo.auth.policy import Role, permissions_for
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.config import Settings
from saint_tibo.db.session import get_session
from saint_tibo.main import create_api

TEST_DATABASE_URL = "postgresql+asyncpg://saint_tibo:saint_tibo@127.0.0.1:5432/saint_tibo_unit"


@pytest.fixture
def settings():
    return Settings(_env_file=None, database_url=TEST_DATABASE_URL)


@pytest.fixture
def signing_key():
    return Ed25519PrivateKey.generate()


@pytest.fixture
def jwks(signing_key):
    key = json.loads(jwt.algorithms.OKPAlgorithm.to_jwk(signing_key.public_key()))
    key.update(kid="test-key", alg="EdDSA", use="sig")
    return {"keys": [key]}


@pytest.fixture
def make_token(signing_key, settings):
    def build(claims=None, *, key=None, kid="test-key", omit=()):
        now = int(time.time())
        payload = {
            "sub": "user-123",
            "sid": "session-123",
            "email": "user@example.com",
            "name": "Test User",
            "iat": now,
            "exp": now + 300,
            "iss": settings.auth_issuer,
            "aud": settings.auth_audience,
        }
        payload.update(claims or {})
        for field in omit:
            payload.pop(field, None)
        return jwt.encode(payload, key or signing_key, algorithm="EdDSA", headers={"kid": kid})

    return build


@pytest.fixture
def current_user():
    """Identity used by `api_client`. Override in a test to change role or id."""
    return user_with(Role.USER)


def user_with(role: Role, user_id: str = "user-123") -> CurrentUser:
    return CurrentUser(
        id=user_id,
        email=f"{user_id}@example.com",
        name="Test User",
        role=role,
        permissions=permissions_for(role),
    )


@pytest.fixture
def make_user():
    """Build a `CurrentUser` for any role, e.g. a second account or an administrator."""
    return user_with


@pytest.fixture
async def db_session():
    """Session on a transaction that is rolled back after the test. Integration only."""
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable PostgreSQL database")
    engine = create_async_engine(url)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
async def make_api_client(settings, db_session):
    """Build an HTTP client authenticated as any user, sharing the rolled-back session.

    Authentication is replaced rather than faked at the token level: `test_auth.py` already
    covers JWT verification, so endpoint tests can focus on behaviour and permissions.
    """
    clients: list[httpx.AsyncClient] = []

    def build(user: CurrentUser) -> httpx.AsyncClient:
        app = create_api(settings)
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_session] = lambda: db_session
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test")
        clients.append(client)
        return client

    yield build
    for client in clients:
        await client.aclose()


@pytest.fixture
def api_client(make_api_client, current_user):
    return make_api_client(current_user)
