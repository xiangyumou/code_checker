from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.models.log import LogLevel


class LogBase(BaseModel):
    level: LogLevel
    message: str
    source: Optional[str] = None
    context: Optional[dict[str, Any]] = None


class LogCreate(LogBase):
    pass


class LogInDBBase(LogBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class Log(LogInDBBase):
    pass


class PaginatedLogs(BaseModel):
    items: list[Log]
    total: int