from datetime import datetime
from typing import Optional, List
from sqlalchemy import select, func, and_, or_, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.log import Log, LogLevel
from app.schemas.log import LogCreate


class CRUDLog(CRUDBase[Log, LogCreate, LogCreate]):
    async def get_multi_filtered(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        level: Optional[LogLevel] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None
    ) -> List[Log]:
        """
        Get multiple logs with filtering and pagination.
        Results are ordered by timestamp in descending order (newest first).
        """
        query = select(self.model)
        
        # Build filter conditions
        filters = []
        
        if level:
            filters.append(self.model.level == level)
            
        if start_date:
            filters.append(self.model.timestamp >= start_date)
            
        if end_date:
            filters.append(self.model.timestamp <= end_date)
            
        if search:
            # Fuzzy search across message and source fields
            search_pattern = f"%{search}%"
            filters.append(
                or_(
                    self.model.message.ilike(search_pattern),
                    self.model.source.ilike(search_pattern)
                )
            )
        
        # Apply filters if any
        if filters:
            query = query.where(and_(*filters))
        
        # Order by timestamp descending and apply pagination
        query = query.order_by(desc(self.model.timestamp)).offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def count_filtered(
        self,
        db: AsyncSession,
        *,
        level: Optional[LogLevel] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None
    ) -> int:
        """
        Count logs based on the same filtering criteria as get_multi_filtered.
        """
        query = select(func.count()).select_from(self.model)
        
        # Build filter conditions (same as in get_multi_filtered)
        filters = []
        
        if level:
            filters.append(self.model.level == level)
            
        if start_date:
            filters.append(self.model.timestamp >= start_date)
            
        if end_date:
            filters.append(self.model.timestamp <= end_date)
            
        if search:
            # Fuzzy search across message and source fields
            search_pattern = f"%{search}%"
            filters.append(
                or_(
                    self.model.message.ilike(search_pattern),
                    self.model.source.ilike(search_pattern)
                )
            )
        
        # Apply filters if any
        if filters:
            query = query.where(and_(*filters))
        
        result = await db.execute(query)
        return result.scalar_one()
    
    async def cleanup_logs(
        self,
        db: AsyncSession,
        *,
        keep_count: int = 100000
    ) -> int:
        """
        Delete oldest logs to maintain a maximum of keep_count logs.
        Returns the number of deleted logs.
        """
        # Get current total count
        total_count = await db.execute(select(func.count()).select_from(self.model))
        total = total_count.scalar_one()
        
        if total <= keep_count:
            return 0
        
        # Calculate how many logs to delete
        delete_count = total - keep_count
        
        # Find the timestamp threshold
        # Get the timestamp of the (keep_count)th newest log
        threshold_query = (
            select(self.model.timestamp)
            .order_by(desc(self.model.timestamp))
            .offset(keep_count - 1)
            .limit(1)
        )
        threshold_result = await db.execute(threshold_query)
        threshold_timestamp = threshold_result.scalar_one_or_none()
        
        if not threshold_timestamp:
            return 0
        
        # Delete logs older than the threshold
        delete_query = delete(self.model).where(
            self.model.timestamp < threshold_timestamp
        )
        result = await db.execute(delete_query)
        await db.commit()
        
        return result.rowcount


log = CRUDLog(Log)