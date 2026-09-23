from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from saint_tibo.auth.identity import load_current_user
from saint_tibo.auth.jwt import TokenVerifier
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import APIError
from saint_tibo.db.session import DatabaseSession

bearer = HTTPBearer(
    auto_error=False,
    description="Short-lived JWT from Better Auth /api/auth/token (not the session cookie)",
)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: DatabaseSession,
) -> CurrentUser:
    if credentials is None:
        raise APIError(401, "unauthorized", "A bearer access token is required")
    verifier: TokenVerifier = request.app.state.token_verifier
    identity = await verifier.verify(credentials.credentials)
    return await load_current_user(identity, session)


AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]


def require_permissions(
    *permissions: Permission,
) -> Callable[[CurrentUser], Awaitable[CurrentUser]]:
    """Require every listed permission. Authentication alone never implies authorization."""
    if not permissions:
        raise ValueError("Specify at least one permission")

    async def dependency(user: AuthenticatedUser) -> CurrentUser:
        if not set(permissions).issubset(user.permissions):
            raise APIError(403, "forbidden", "Insufficient permissions")
        return user

    return dependency
