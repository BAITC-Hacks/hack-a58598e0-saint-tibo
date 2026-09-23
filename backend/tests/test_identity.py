import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from saint_tibo.auth.identity import load_current_user
from saint_tibo.auth.policy import Permission, Role
from saint_tibo.auth.schemas import TokenIdentity
from saint_tibo.core.errors import APIError

pytestmark = pytest.mark.integration


@pytest.fixture
async def identity_session():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL and apply auth migrations to the disposable database")
    engine = create_async_engine(url)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(bind=connection, join_transaction_mode="create_savepoint")
        identifier = uuid.uuid4().hex
        await session.execute(
            text("""
            INSERT INTO auth."user" (id, email, name, role)
            VALUES (:id, :email, 'RBAC test', 'user')
        """),
            {"id": identifier, "email": f"{identifier}@example.com"},
        )
        await session.execute(
            text("""
            INSERT INTO auth.session (id, token, user_id, expires_at)
            VALUES (:id, :id, :id, CURRENT_TIMESTAMP + INTERVAL '1 hour')
        """),
            {"id": identifier},
        )
        try:
            yield TokenIdentity(id=identifier, session_id=identifier), session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


async def test_role_changes_take_effect_on_the_same_identity(identity_session):
    identity, session = identity_session
    assert (await load_current_user(identity, session)).role == Role.USER
    await session.execute(
        text('UPDATE auth."user" SET role = :role WHERE id = :id'),
        {"role": "admin", "id": identity.id},
    )
    assert Permission.USERS_MANAGE in (await load_current_user(identity, session)).permissions
    await session.execute(
        text('UPDATE auth."user" SET role = :role WHERE id = :id'),
        {"role": "user", "id": identity.id},
    )
    assert Permission.USERS_MANAGE not in (await load_current_user(identity, session)).permissions


@pytest.mark.parametrize(
    "mutation",
    [
        "DELETE FROM auth.session WHERE id = :id",
        "UPDATE auth.session SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = :id",
        'DELETE FROM auth."user" WHERE id = :id',
    ],
)
async def test_invalidated_identity_is_rejected(identity_session, mutation):
    identity, session = identity_session
    await session.execute(text(mutation), {"id": identity.id})
    with pytest.raises(APIError) as error:
        await load_current_user(identity, session)
    assert error.value.status == 401


async def test_session_cannot_be_used_for_another_subject(identity_session):
    identity, session = identity_session
    with pytest.raises(APIError) as error:
        await load_current_user(
            TokenIdentity(id="another-user", session_id=identity.session_id), session
        )
    assert error.value.status == 401


async def test_active_and_expired_bans(identity_session):
    identity, session = identity_session
    await session.execute(
        text('UPDATE auth."user" SET banned = true WHERE id = :id'), {"id": identity.id}
    )
    with pytest.raises(APIError) as error:
        await load_current_user(identity, session)
    assert error.value.status == 403
    await session.execute(
        text("""
        UPDATE auth."user" SET ban_expires = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = :id
    """),
        {"id": identity.id},
    )
    assert (await load_current_user(identity, session)).role == Role.USER
