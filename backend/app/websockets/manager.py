# This module re-exports the singleton ConnectionManager instance
# defined in connection_manager.py to provide a consistent import path.

from .connection_manager import manager

# Ensure the manager instance is explicitly exported if needed,
# although direct import usually works.
__all__ = ["manager"]