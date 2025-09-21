from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Enum as SQLEnum,
    Index,
    JSON,
)
from sqlalchemy.sql import func

from app.db.base_class import Base


class LogLevel(str, PyEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    level = Column(SQLEnum(LogLevel), nullable=False, index=True)
    message = Column(Text, nullable=False)
    source = Column(String(255), nullable=True, index=True)
    context = Column(JSON, nullable=True)

    __table_args__ = (
        Index("idx_logs_timestamp_desc", timestamp.desc()),
    )
