from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class AdminUser(Base):
    """
    Database model for Admin Users.
    """
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True) # Optional: for disabling accounts

    # Add relationships here if needed, e.g., if admins create specific items
    # items = relationship("Item", back_populates="owner")

    def __repr__(self):
        return f"<AdminUser(id={self.id}, username='{self.username}')>"