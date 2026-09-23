from typing import Annotated

from fastapi import APIRouter, Depends

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import ErrorResponse
from saint_tibo.core.pagination import Pagination
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.reminders import service
from saint_tibo.modules.reminders.schemas import ReminderPage

ReadUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_READ))]
router = APIRouter(
    prefix="/reminders",
    tags=["reminders"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 503)},
)


@router.get("", operation_id="listReminders")
async def list_reminders(
    session: DatabaseSession, user: ReadUser, pagination: Pagination
) -> ReminderPage:
    """Refresh the owner's in-app inbox from current confirmed actions; no delivery side effects."""
    return await service.list_reminders(session, user.id, pagination)
