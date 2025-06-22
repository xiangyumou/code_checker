from typing import Any, Dict, List, Optional, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password # Security functions will be created later
from app.crud.base import CRUDBase
from app.models.admin_user import AdminUser
from app.schemas.admin_user import AdminUserCreate, AdminUserUpdate

class CRUDAdminUser(CRUDBase[AdminUser, AdminUserCreate, AdminUserUpdate]):
    async def get_by_username(self, db: AsyncSession, *, username: str) -> Optional[AdminUser]:
        """
        Get an admin user by username.
        """
        result = await db.execute(select(self.model).filter(self.model.username == username))
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[AdminUser]:
        """
        Get multiple admin users with pagination, ordered by ID.
        Overrides the base implementation to sort by ID as AdminUser lacks created_at.
        """
        result = await db.execute(
            select(self.model)
            .offset(skip)
            .limit(limit)
            .order_by(self.model.id) # Order by ID for AdminUser
        )
        return result.scalars().all()

    async def create(self, db: AsyncSession, *, obj_in: AdminUserCreate) -> AdminUser:
        """
        Create a new admin user, hashing the password.
        """
        # Use jsonable_encoder to convert Pydantic model to dict, excluding unset values if needed
        # obj_in_data = jsonable_encoder(obj_in) # Not needed if accessing fields directly
        hashed_password = get_password_hash(obj_in.password)
        db_obj = self.model(
            username=obj_in.username,
            hashed_password=hashed_password,
            is_active=obj_in.is_active # Use default from schema if not provided
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: AdminUser,
        obj_in: Union[AdminUserUpdate, Dict[str, Any]]
    ) -> AdminUser:
        """
        Update an admin user. If password is provided in obj_in, hash it.
        """
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # If password is being updated, hash it before setting
        if "password" in update_data and update_data["password"]:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"] # Remove plain password from update dict
            update_data["hashed_password"] = hashed_password # Add hashed password

        # Call the parent class update method with potentially modified update_data
        return await super().update(db, db_obj=db_obj, obj_in=update_data)

    async def authenticate(
        self, db: AsyncSession, *, username: str, password: str
    ) -> Optional[AdminUser]:
        """
        Authenticate an admin user.
        """
        user = await self.get_by_username(db, username=username)
        if not user:
            return None
        # Remove the is_active check here; let the endpoint handle it.
        # if not user.is_active:
        #     return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

# Create an instance of the CRUD class for easy import
crud_admin_user = CRUDAdminUser(AdminUser)