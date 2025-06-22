from sqlalchemy import Column, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.sqlite import TEXT as SQLITE_TEXT

from app.db.base_class import Base

class Setting(Base):
    """
    Database model for storing application settings as key-value pairs.
    The 'key' should be unique.
    """
    # Using Integer ID although key is the logical primary identifier
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(SQLITE_TEXT, nullable=True) # Store values as strings or JSON strings

    # Optional: Add a constraint to ensure key is unique
    __table_args__ = (UniqueConstraint('key', name='uq_setting_key'),)

    def __repr__(self):
        # Truncate long values in representation
        value_repr = f"'{self.value[:50]}...'" if self.value and len(self.value) > 53 else f"'{self.value}'"
        return f"<Setting(id={self.id}, key='{self.key}', value={value_repr})>"