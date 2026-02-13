"""
Database Migration API Router

Provides endpoints for automatic database migrations,
schema detection, and migration status.
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text

from app.auth.router import get_current_user
from app.auth.models import User
from app.rag.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/migrations", tags=["migrations"])


class MigrationPlanResponse(BaseModel):
    revision_id: str
    tables_to_create: List[str]
    tables_to_alter: List[str]
    columns_to_add: Dict[str, List[str]]
    columns_to_remove: Dict[str, List[str]]
    has_changes: bool


class MigrationExecuteRequest(BaseModel):
    message: str = "Auto-generated migration"
    dry_run: bool = False
    auto_approve: bool = True


class MigrationResultResponse(BaseModel):
    success: bool
    message: str
    operations: Optional[List[Dict[str, Any]]] = None
    errors: Optional[List[str]] = None
    backup: Optional[Dict[str, Any]] = None


@router.get("/plan", response_model=MigrationPlanResponse)
async def get_migration_plan(
    current_user: User = Depends(get_current_user),
) -> MigrationPlanResponse:
    """Get the current migration plan without applying changes."""
    try:
        from app.core.migration_manager import AutoMigrationManager

        manager = AutoMigrationManager()
        plan = manager.detect_changes()

        return MigrationPlanResponse(
            revision_id=plan.revision_id,
            tables_to_create=plan.tables_to_create,
            tables_to_alter=plan.tables_to_alter,
            columns_to_add=plan.columns_to_add,
            columns_to_remove=plan.columns_to_remove,
            has_changes=bool(
                plan.tables_to_create or plan.columns_to_add or plan.columns_to_remove
            ),
        )

    except Exception as e:
        logger.error(f"Failed to get migration plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate migration plan: {str(e)}",
        )


@router.post("/execute", response_model=MigrationResultResponse)
async def execute_migration(
    request: MigrationExecuteRequest, current_user: User = Depends(get_current_user)
) -> MigrationResultResponse:
    """Execute automatic database migration."""
    try:
        from app.core.migration_manager import AutoMigrationManager

        manager = AutoMigrationManager()

        result = manager.generate_and_apply_migration(
            message=request.message,
            dry_run=request.dry_run,
            auto_approve=request.auto_approve,
        )

        return MigrationResultResponse(
            success=result.get("success", False),
            message=result.get("message", "Migration completed"),
            operations=result.get("operations"),
            errors=result.get("errors"),
            backup=result.get("backup"),
        )

    except Exception as e:
        logger.error(f"Migration execution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Migration execution failed: {str(e)}",
        )


@router.get("/status")
async def get_migration_status(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get current migration status and history."""
    try:
        from sqlalchemy import inspect
        from app.core.database import engine

        inspector = inspect(engine)
        tables = inspector.get_table_names()

        table_info = {}
        for table in sorted(tables):
            columns = inspector.get_columns(table)
            table_info[table] = {
                "columns": [
                    {
                        "name": col["name"],
                        "type": str(col["type"]),
                        "nullable": col.get("nullable", True),
                        "primary_key": col.get("primary_key", False),
                    }
                    for col in columns
                ],
                "row_count": _get_table_row_count(engine, table),
            }

        return {
            "status": "healthy",
            "database_connected": True,
            "tables_count": len(tables),
            "tables": table_info,
        }

    except Exception as e:
        logger.error(f"Failed to get migration status: {e}")
        return {"status": "error", "database_connected": False, "error": str(e)}


@router.get("/compare")
async def compare_schemas(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Compare model schema with current database schema."""
    try:
        from app.core.migration_manager import AutoMigrationManager

        manager = AutoMigrationManager()
        plan = manager.detect_changes()

        return {
            "model_schema": {
                "tables": list(manager.schema_detector.get_model_schema().keys())
            },
            "current_schema": {
                "tables": list(manager.schema_detector.get_current_schema().keys())
            },
            "differences": {
                "tables_to_create": plan.tables_to_create,
                "tables_to_alter": plan.tables_to_alter,
                "columns_to_add": plan.columns_to_add,
                "columns_to_remove": plan.columns_to_remove,
            },
            "revision_id": plan.revision_id,
        }

    except Exception as e:
        logger.error(f"Failed to compare schemas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Schema comparison failed: {str(e)}",
        )


def _get_table_row_count(engine, table_name: str) -> int:
    """Get approximate row count for a table."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            return result.scalar() or 0
    except Exception:
        return 0
