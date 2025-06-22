import json
import logging

logger = logging.getLogger(__name__)
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.setting import Setting
from app.schemas.setting import SettingCreate, SettingUpdate

class CRUDSetting(CRUDBase[Setting, SettingCreate, SettingUpdate]):

    async def get_by_key(self, db: AsyncSession, *, key: str) -> Optional[Setting]:
        """
        Get a setting by its unique key.
        """
        statement = select(self.model).filter(self.model.key == key)
        result = await db.execute(statement)
        return result.scalars().first()

    async def get_value_by_key(self, db: AsyncSession, *, key: str, default: Any = None) -> Any:
        """
        Get the value of a setting by key, returning a default if not found.
        Attempts to parse JSON strings into Python objects.
        """
        setting = await self.get_by_key(db, key=key)
        if not setting or setting.value is None:
            return default
        try:
            # Attempt to parse if it looks like JSON (starts with { or [)
            if isinstance(setting.value, str) and (setting.value.startswith('{') or setting.value.startswith('[')):
                return json.loads(setting.value)
            # TODO: Add handling for boolean strings 'true'/'false' or numbers if needed
            return setting.value
        except json.JSONDecodeError:
            # Return the raw string if JSON parsing fails
            return setting.value

    async def create_or_update(self, db: AsyncSession, *, key: str, value: Any) -> Setting:
        """
        Creates a setting if the key doesn't exist, or updates it if it does.
        Serializes complex values (dicts, lists) to JSON strings before saving.
        """
        db_obj = await self.get_by_key(db, key=key)
        # Serialize value if it's a dict or list
        if isinstance(value, (dict, list)):
            value_to_save = json.dumps(value)
        elif isinstance(value, bool):
             value_to_save = str(value).lower() # Store booleans as 'true'/'false' strings
        else:
            value_to_save = str(value) # Store other types as strings

        if db_obj:
            # Update existing setting
            update_schema = SettingUpdate(value=value_to_save)
            return await super().update(db, db_obj=db_obj, obj_in=update_schema)
        else:
            # Create new setting
            create_schema = SettingCreate(key=key, value=value_to_save)
            return await super().create(db, obj_in=create_schema)

    async def get_all_settings_as_dict(self, db: AsyncSession) -> Dict[str, Any]:
        """
        Retrieves all settings and returns them as a dictionary {key: parsed_value}.
        """
        settings_list = await self.get_multi(db, limit=1000) # Assume reasonable number of settings
        settings_dict = {}
        for setting in settings_list:
            # Corrected indentation for the first log
            try:
                if isinstance(setting.value, str) and (setting.value.startswith('{') or setting.value.startswith('[')):
                     settings_dict[setting.key] = json.loads(setting.value)
                elif isinstance(setting.value, str) and setting.value in ['true', 'false']:
                     settings_dict[setting.key] = setting.value == 'true'
                # TODO: Add number parsing if needed
                else:
                     settings_dict[setting.key] = setting.value
            except json.JSONDecodeError:
                settings_dict[setting.key] = setting.value # Store raw value on parse error
        # Added the second log before return
        return settings_dict

# Create an instance of the CRUD class
crud_setting = CRUDSetting(Setting)