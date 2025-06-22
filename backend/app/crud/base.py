from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select, desc, asc, inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base_class import Base

# Define TypeVars for generic CRUD operations
ModelType = TypeVar("ModelType", bound=Base) # The SQLAlchemy model type
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel) # Pydantic schema for creation
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel) # Pydantic schema for update

class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Generic CRUD base class with default methods to Create, Read, Update, Delete (CRUD).

    **Parameters**

    * `model`: A SQLAlchemy model class
    * `schema`: A Pydantic model (schema) class - Not directly used here but good for context
    """
    def __init__(self, model: Type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).

        :param model: A SQLAlchemy model class
        """
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        """
        Get a single record by ID.
        """
        result = await db.execute(select(self.model).filter(self.model.id == id))
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """
        Get multiple records with pagination.
        """
        query = select(self.model).offset(skip).limit(limit)
        if hasattr(self.model, 'created_at'):
            # Default ordering by creation date desc (newest first) if attribute exists
            query = query.order_by(desc(self.model.created_at))
        else:
            # If 'created_at' doesn't exist, order by primary key ascending
            # This assumes a single primary key column. Adjust if models have composite keys.
            try:
                pk_column = inspect(self.model).primary_key[0]
                query = query.order_by(asc(pk_column))
            except IndexError:
                # Handle cases where primary key inspection might fail or be empty
                # Optionally log a warning or fallback to no specific order
                pass # Or apply a default ordering if necessary

        result = await db.execute(query)
        return result.scalars().all()

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Create a new record.
        """
        # Use Pydantic's model_dump (V2) or dict() (V1) to get a dict with Python objects
        # Avoid jsonable_encoder here as SQLAlchemy's JSON type handles Python dicts/lists directly
        # Ensure compatibility if using Pydantic V1 vs V2 (assuming V2 with model_dump)
        if hasattr(obj_in, 'model_dump'):
            obj_in_data = obj_in.model_dump()
        else:
            # Fallback for Pydantic V1 (consider adding a check or standardizing on V2)
            obj_in_data = obj_in.dict()

        db_obj = self.model(**obj_in_data)  # Pass the dictionary directly
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """
        Update an existing record.
        """
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            # Use exclude_unset=True to only update fields that were explicitly passed
            update_data = obj_in.model_dump(exclude_unset=True)

        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, id: int) -> Optional[ModelType]:
        """
        Delete a record by ID.
        Returns the deleted object or None if not found.
        """
        obj = await self.get(db=db, id=id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj