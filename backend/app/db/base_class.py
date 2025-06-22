from typing import Any
from sqlalchemy.orm import DeclarativeBase, declared_attr # Import DeclarativeBase
import re # Import re here for cleaner code

class Base(DeclarativeBase): # Inherit from DeclarativeBase
    """
    Base class for all SQLAlchemy models.
    It automatically sets the table name based on the class name.
    """
    id: Any
    __name__: str

    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        # Converts CamelCase class names to snake_case table names
        # e.g., AnalysisVersion -> analysis_versions
        name = re.sub(r'(?<!^)(?=[A-Z])', '_', cls.__name__).lower()
        # Simple pluralization (add 's'), might need adjustment for irregular nouns
        if not name.endswith('s'):
            name += 's'
        return name