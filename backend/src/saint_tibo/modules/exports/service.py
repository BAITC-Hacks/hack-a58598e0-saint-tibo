from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.errors import APIError
from saint_tibo.modules.exports.schemas import ProtocolExport
from saint_tibo.modules.results.service import get_review


async def export_payload(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version_id: UUID,
    revision: int,
) -> ProtocolExport:
    review = await get_review(
        session, owner_id, meeting_id, recording_id, version_id, revision
    )
    if not review.reviewed or review.saved_at is None:
        raise APIError(409, "result_not_reviewed", "Save a reviewed revision before exporting")
    # Never hydrate names/dates from current metadata: later edits must not change
    # a previously reviewed protocol. The snapshot contains all renderer inputs.
    payload = ProtocolExport.model_validate(review.model_dump())
    await session.commit()
    return payload
