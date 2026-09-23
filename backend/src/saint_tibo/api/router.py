from typing import Annotated

from fastapi import APIRouter, Depends

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission, Role, permissions_for
from saint_tibo.auth.schemas import AccessPolicy, CurrentUser
from saint_tibo.core.errors import ErrorResponse
from saint_tibo.modules.meetings.router import router as meetings_router

router = APIRouter(prefix="/api/v1")
router.include_router(meetings_router)


@router.get(
    "/me",
    tags=["users"],
    operation_id="getCurrentUser",
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def me(
    user: Annotated[CurrentUser, Depends(require_permissions(Permission.PROFILE_READ))],
) -> CurrentUser:
    """Return the current database identity, role and effective application permissions."""
    return user


@router.get(
    "/admin/access",
    tags=["access"],
    operation_id="getAccessPolicy",
    dependencies=[Depends(require_permissions(Permission.ACCESS_READ))],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def access_policy() -> AccessPolicy:
    """Inspect the explicit role/permission matrix. Requires access:read."""
    return AccessPolicy(roles={role: permissions_for(role) for role in Role})
