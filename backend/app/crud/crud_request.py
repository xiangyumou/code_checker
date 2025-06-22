from typing import List, Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, load_only

from app.crud.base import CRUDBase
from app.models.request import Request, RequestStatus
from app.schemas.request import RequestCreate, RequestUpdate
from app.core.exceptions import NotFoundError # Import custom exception

class CRUDRequest(CRUDBase[Request, RequestCreate, RequestUpdate]):

    async def get_multi_with_status(
        self, db: AsyncSession, *, status: Optional[RequestStatus] = None, skip: int = 0, limit: int = 100
    ) -> List[Request]:
        """
        Get multiple requests, optionally filtering by status, ordered by creation date descending.
        No longer loads related versions.
        """
        statement = (
            select(self.model)
            .options(
                load_only(
                    self.model.id,
                    self.model.status,
                    self.model.created_at,
                    self.model.updated_at,
                    self.model.image_references, # Needed to derive filename later
                    self.model.error_message
                )
            )
            .order_by(desc(self.model.created_at)) # Show newest first
            .offset(skip)
            .limit(limit)
        )
        if status:
            statement = statement.filter(self.model.status == status)

        result = await db.execute(statement)
        return result.scalars().all()

    async def get_or_404(self, db: AsyncSession, id: int) -> Request:
        """
        Get a single object by ID, raising NotFoundError if not found.
        Overrides the base method to ensure consistent 404 handling.
        """
        db_obj = await super().get(db, id)
        if not db_obj:
            raise NotFoundError(resource=f"Request with ID {id}")
        return db_obj

    # Removed get_with_versions as it's now equivalent to get_or_404 or base get

    async def get_processing_requests(self, db: AsyncSession) -> List[Request]:
        """
        Get all requests currently in the 'Processing' state.
        Useful for checking status on application startup.
        """
        statement = select(self.model).filter(self.model.status == RequestStatus.PROCESSING)
        result = await db.execute(statement)
        return result.scalars().all()

    async def update_status(
        self, db: AsyncSession, *, db_obj: Request, status: RequestStatus, error_message: Optional[str] = None
    ) -> Request:
        """
        Helper method to update the status and optionally the error message of a request.
        """
        update_data = {"status": status}
        if error_message is not None: # Allow clearing error message by passing None explicitly? Or handle differently?
            update_data["error_message"] = error_message
        elif status != RequestStatus.FAILED:
             # Clear error message if status is not Failed
             update_data["error_message"] = None

        return await super().update(db, db_obj=db_obj, obj_in=update_data)

    # Removed set_current_version as version concept is removed


# Create an instance of the CRUD class
crud_request = CRUDRequest(Request)