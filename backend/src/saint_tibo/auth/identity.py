"""Read-only boundary to Better Auth. Drizzle owns these tables and migrations."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.auth.policy import Role, permissions_for
from saint_tibo.auth.schemas import CurrentUser, TokenIdentity
from saint_tibo.core.errors import APIError

IDENTITY_QUERY = text("""
    SELECT u.id, u.email, u.name, u.role,
           (u.banned AND (u.ban_expires IS NULL OR u.ban_expires > CURRENT_TIMESTAMP)) AS banned
    FROM auth."user" AS u
    JOIN auth.session AS s ON s.user_id = u.id
    WHERE u.id = :user_id AND s.id = :session_id AND s.expires_at > CURRENT_TIMESTAMP
""")


async def load_current_user(identity: TokenIdentity, session: AsyncSession) -> CurrentUser:
    result = await session.execute(
        IDENTITY_QUERY, {"user_id": identity.id, "session_id": identity.session_id}
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise APIError(401, "session_revoked", "Session has expired or was revoked")
    if row["banned"]:
        raise APIError(403, "account_banned", "Account is blocked")
    try:
        role = Role(row["role"])
    except ValueError as exc:
        raise APIError(403, "unknown_role", "Account has no supported role") from exc
    return CurrentUser(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        role=role,
        permissions=permissions_for(role),
    )
