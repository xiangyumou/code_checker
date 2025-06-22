import enum
import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum, ForeignKey, Boolean, Text # Add Text import if not already present implicitly
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
# from sqlalchemy.dialects.sqlite import TEXT as SQLITE_TEXT, JSON as SQLITE_JSON # Remove SQLite specific imports
from sqlalchemy.dialects.postgresql import JSONB # Import JSONB for PostgreSQL

from app.db.base_class import Base
# from app.db.custom_types import JsonEncodedList # Remove custom type import

class RequestStatus(str, enum.Enum):
    QUEUED = "Queued"
    PROCESSING = "Processing"
    COMPLETED = "Completed"
    FAILED = "Failed"

class Request(Base):
    """
    Database model for analysis requests.
    """
    id = Column(Integer, primary_key=True, index=True)
    user_prompt = Column(Text, nullable=True)
    # images_base64 = Column(JSON, nullable=True) # REMOVED: Replaced by image_references
    image_references = Column(JSONB, nullable=True) # ADDED: Stores list of relative image paths

    status = Column(SQLEnum(RequestStatus), default=RequestStatus.QUEUED, nullable=False, index=True)
    error_message = Column(String, nullable=True) # Store failure reason

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Analysis Results (moved from AnalysisVersion)
    gpt_raw_response = Column(JSONB, nullable=True) # Changed to JSONB for PostgreSQL
    # Removed: organized_problem_json, modified_code, modification_analysis_json
    is_success = Column(Boolean, default=False, nullable=False) # Indicates if GPT call and parsing were successful

    def __repr__(self):
        return f"<Request(id={self.id}, status='{self.status.value}')>"