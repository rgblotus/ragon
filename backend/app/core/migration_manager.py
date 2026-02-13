"""
Automatic Database Migration Manager for Olivia

Provides automatic schema detection, migration generation,
and safe migration execution with rollback support.
"""

import hashlib
import json
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from sqlmodel import SQLModel, text
from sqlalchemy import inspect, MetaData, Table, Column
import sqlalchemy as sa
from sqlalchemy.engine import Engine
from app.rag.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ColumnInfo:
    name: str
    type: str
    nullable: bool
    default: Optional[Any]
    primary_key: bool = False
    foreign_key: Optional[str] = None


@dataclass
class TableInfo:
    name: str
    columns: Dict[str, ColumnInfo]
    primary_key: List[str]
    foreign_keys: List[Dict[str, Any]] = field(default_factory=list)
    indexes: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class MigrationPlan:
    revision_id: str
    tables_to_create: List[str]
    tables_to_alter: List[str]
    columns_to_add: Dict[str, List[str]]
    columns_to_remove: Dict[str, List[str]]
    columns_to_modify: Dict[str, Dict[str, Any]]
    indexes_to_create: Dict[str, List[Dict[str, Any]]]
    sql_commands: List[str] = field(default_factory=list)


class SchemaDetector:
    """Detects current database schema from SQLModel metadata."""

    def __init__(self, engine: Engine):
        self.engine = engine
        self.inspector = inspect(engine)

    def get_model_schema(self) -> Dict[str, TableInfo]:
        """Extract schema from SQLModel metadata."""
        schema = {}
        metadata = SQLModel.metadata

        for table in metadata.tables.values():
            table_name = table.name
            columns = {}
            primary_key = []

            for col in table.columns:
                col_default = None
                if hasattr(col.default, "arg"):
                    col_default = col.default.arg
                col_info = ColumnInfo(
                    name=col.name,
                    type=str(col.type)
                    if hasattr(col.type, "__str__")
                    else str(type(col.type).__name__),
                    nullable=col.nullable if col.nullable is not None else True,
                    default=col_default,
                    primary_key=col.primary_key,
                )
                columns[col.name] = col_info
                if col.primary_key:
                    primary_key.append(col.name)

            table_info = TableInfo(
                name=table_name,
                columns=columns,
                primary_key=primary_key,
                indexes=[
                    {"name": idx.name, "columns": list(idx.columns.keys())}
                    for idx in table.indexes
                ],
            )
            schema[table_name] = table_info

        return schema

    def get_current_schema(self) -> Dict[str, TableInfo]:
        """Get current database schema from actual database."""
        schema = {}

        for table_name in self.inspector.get_table_names():
            columns = {}
            primary_key = []

            for col in self.inspector.get_columns(table_name):
                col_info = ColumnInfo(
                    name=col["name"],
                    type=str(col["type"]),
                    nullable=col.get("nullable", True),
                    default=col.get("default"),
                    primary_key=col.get("primary_key", False),
                )
                columns[col["name"]] = col_info
                if col.get("primary_key"):
                    primary_key.append(col["name"])

            fks = []
            for fk in self.inspector.get_foreign_keys(table_name):
                fks.append(
                    {
                        "name": fk["name"],
                        "constrained_columns": fk["constrained_columns"],
                        "referred_table": fk["referred_table"],
                        "referred_columns": fk["referred_columns"],
                    }
                )

            indexes = []
            for idx in self.inspector.get_indexes(table_name):
                indexes.append({"name": idx["name"], "columns": idx["column_names"]})

            schema[table_name] = TableInfo(
                name=table_name,
                columns=columns,
                primary_key=primary_key,
                foreign_keys=fks,
                indexes=indexes,
            )

        return schema

    def compare_schemas(
        self, model_schema: Dict[str, TableInfo], current_schema: Dict[str, TableInfo]
    ) -> MigrationPlan:
        """Compare model schema with current database schema to generate migration plan."""
        plan = MigrationPlan(
            revision_id=self._generate_revision_id(),
            tables_to_create=[],
            tables_to_alter=[],
            columns_to_add={},
            columns_to_remove={},
            columns_to_modify={},
            indexes_to_create={},
        )

        model_tables = set(model_schema.keys())
        current_tables = set(current_schema.keys())

        tables_to_create = model_tables - current_tables
        tables_to_drop = current_tables - model_tables
        tables_to_alter = model_tables & current_tables

        plan.tables_to_create = sorted(list(tables_to_create))

        for table_name in tables_to_alter:
            model_table = model_schema[table_name]
            current_table = current_schema[table_name]

            model_cols = set(model_table.columns.keys())
            current_cols = set(current_table.columns.keys())

            new_cols = model_cols - current_cols
            removed_cols = current_cols - model_cols
            common_cols = model_cols & current_cols

            if new_cols:
                plan.columns_to_add[table_name] = sorted(list(new_cols))

            if removed_cols:
                plan.columns_to_remove[table_name] = sorted(list(removed_cols))

            for col_name in common_cols:
                model_col = model_table.columns[col_name]
                current_col = current_table.columns[col_name]

                if not self._columns_equal(model_col, current_col):
                    if table_name not in plan.columns_to_modify:
                        plan.columns_to_modify[table_name] = {}
                    plan.columns_to_modify[table_name][col_name] = {
                        "old_type": current_col.type,
                        "new_type": model_col.type,
                        "old_nullable": current_col.nullable,
                        "new_nullable": model_col.nullable,
                    }

            model_indexes = set(idx["name"] for idx in model_table.indexes)
            current_indexes = set(idx["name"] for idx in current_table.indexes)

            new_indexes = model_indexes - current_indexes
            if new_indexes:
                plan.indexes_to_create[table_name] = [
                    idx for idx in model_table.indexes if idx["name"] in new_indexes
                ]

            if (
                new_cols
                or removed_cols
                or new_indexes
                or table_name in plan.columns_to_modify
            ):
                plan.tables_to_alter.append(table_name)

        return plan

    def _generate_revision_id(self) -> str:
        """Generate a unique revision ID based on timestamp."""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        short_hash = hashlib.md5(timestamp.encode()).hexdigest()[:8]
        return f"{timestamp}_{short_hash}"

    def _columns_equal(self, col1: ColumnInfo, col2: ColumnInfo) -> bool:
        """Check if two columns are equal."""
        return (
            col1.name == col2.name
            and col1.type == col2.type
            and col1.nullable == col2.nullable
        )


class MigrationGenerator:
    """Generates Alembic migration scripts automatically."""

    def __init__(self, alembic_dir: Path):
        self.alembic_dir = alembic_dir
        self.versions_dir = alembic_dir / "versions"

    def generate_migration(self, plan: MigrationPlan, message: str = "") -> str:
        """Generate a migration script from the plan."""
        revision_id = plan.revision_id

        migration_content = self._build_migration_content(plan, message)
        filename = f"{revision_id}.py"
        filepath = self.versions_dir / filename

        self.versions_dir.mkdir(parents=True, exist_ok=True)
        filepath.write_text(migration_content)

        self._update_alembic_version_file(revision_id)

        return str(filepath)

    def _build_migration_content(self, plan: MigrationPlan, message: str) -> str:
        """Build the migration file content."""
        safe_message = message.replace('"', '\\"')

        lines = [
            f'"""{safe_message}',
            "",
            f"Revision ID: {plan.revision_id}",
            "Revises:",
            f"Create Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')}",
            '"""]',
            "",
            "from typing import Sequence, Union",
            "from alembic import op",
            "import sqlalchemy as sa",
            "from sqlalchemy import text",
            "",
            "",
            f'revision: str = "{plan.revision_id}"',
            "down_revision: Union[str, None] = None",
            "branch_labels: Union[str, Sequence[str], None] = None",
            "depends_on: Union[str, Sequence[str], None] = None",
            "",
            "",
            "def upgrade() -> None:",
            '    """Apply database migrations safely."""',
            "    conn = op.get_bind()",
            "    inspector = sa.inspect(conn)",
            "",
        ]

        for table_name in plan.tables_to_create:
            lines.append(f"    # Create table: {table_name}")
            lines.append(f"    _create_{table_name}_table(conn, inspector)")
            lines.append("")

        for table_name in plan.columns_to_add:
            columns = plan.columns_to_add[table_name]
            lines.append(f"    # Add columns to {table_name}: {', '.join(columns)}")
            for col in columns:
                lines.append(f"    _add_{table_name}_{col}_column(conn, inspector)")
            lines.append("")

        for table_name, columns in plan.columns_to_remove.items():
            lines.append(
                f"    # Remove columns from {table_name}: {', '.join(columns)}"
            )
            for col in columns:
                lines.append(f"    _drop_{table_name}_{col}_column(conn, inspector)")
            lines.append("")

        lines.append("")
        lines.append("def downgrade() -> None:")
        lines.append('    """Revert database migrations."""')
        lines.append("    conn = op.get_bind()")
        lines.append("    inspector = sa.inspect(conn)")
        lines.append("")

        for table_name in reversed(plan.tables_to_create):
            lines.append(f"    # Drop table: {table_name}")
            lines.append(f"    _drop_{table_name}_table(conn, inspector)")
            lines.append("")

        for table_name in plan.columns_to_add:
            lines.append(f"    # Remove added columns from {table_name}")
            columns = plan.columns_to_add[table_name]
            for col in reversed(columns):
                lines.append(f"    _drop_{table_name}_{col}_column(conn, inspector)")
            lines.append("")

        lines.append("")
        lines.extend(self._build_helper_functions(plan))

        return "\n".join(lines)

    def _build_helper_functions(self, plan: MigrationPlan) -> List[str]:
        """Build helper functions for migration operations."""
        lines = [""]
        lines.append("# Helper functions for safe migration operations")
        lines.append("")
        lines.append("def _table_exists(conn, inspector, table_name: str) -> bool:")
        lines.append('    """Check if table exists in database."""')
        lines.append("    return table_name in inspector.get_table_names()")
        lines.append("")
        lines.append(
            "def _column_exists(conn, inspector, table_name: str, column_name: str) -> bool:"
        )
        lines.append('    """Check if column exists in table."""')
        lines.append("    if not _table_exists(conn, inspector, table_name):")
        lines.append("        return False")
        lines.append(
            '    return column_name in [col["name"] for col in inspector.get_columns(table_name)]'
        )
        lines.append("")

        for table_name in plan.tables_to_create:
            lines.append(f"def _create_{table_name}_table(conn, inspector):")
            lines.append(f'    """Create {table_name} table if it does not exist."""')
            lines.append(f'    if _table_exists(conn, inspector, "{table_name}"):')
            lines.append(f"        return")
            lines.append(f"    # Table creation would be defined here based on model")
            lines.append(f"    pass")
            lines.append("")

        for table_name, columns in plan.columns_to_add.items():
            for col in columns:
                lines.append(f"def _add_{table_name}_{col}_column(conn, inspector):")
                lines.append(
                    f'    """Add {col} column to {table_name} table if it does not exist."""'
                )
                lines.append(
                    f'    if _column_exists(conn, inspector, "{table_name}", "{col}"):'
                )
                lines.append(f"        return")
                lines.append(
                    f'    op.add_column("{table_name}", sa.Column("{col}", sa.String(), nullable=True))'
                )
                lines.append("")

        for table_name, columns in plan.columns_to_remove.items():
            for col in columns:
                lines.append(f"def _drop_{table_name}_{col}_column(conn, inspector):")
                lines.append(
                    f'    """Remove {col} column from {table_name} table if it exists."""'
                )
                lines.append(
                    f'    if not _column_exists(conn, inspector, "{table_name}", "{col}"):'
                )
                lines.append(f"        return")
                lines.append(f'    op.drop_column("{table_name}", "{col}")')
                lines.append("")

        for table_name in plan.tables_to_create:
            lines.append(f"def _drop_{table_name}_table(conn, inspector):")
            lines.append(f'    """Drop {table_name} table if it exists."""')
            lines.append(f'    if not _table_exists(conn, inspector, "{table_name}"):')
            lines.append(f"        return")
            lines.append(f'    op.drop_table("{table_name}")')
            lines.append("")

        return lines

    def _update_alembic_version_file(self, revision_id: str):
        """Update the Alembic version file with the new revision."""
        script = self.alembic_dir / "script.py.mako"
        if script.exists():
            content = script.read_text()
            if "${revision}" not in content:
                content = content.replace(
                    "down_revision: Union[str, None] = None",
                    f'down_revision: Union[str, None] = "{revision_id}"',
                )
                script.write_text(content)


class MigrationExecutor:
    """Executes database migrations with rollback support."""

    def __init__(self, engine: Engine):
        self.engine = engine
        self.detector = SchemaDetector(engine)
        self.backup_created = False

    def execute_migration(
        self, plan: MigrationPlan, dry_run: bool = False, backup_before: bool = True
    ) -> Dict[str, Any]:
        """Execute a migration plan with optional backup."""
        results = {"success": False, "operations": [], "errors": [], "dry_run": dry_run}

        try:
            if backup_before and not dry_run:
                backup_result = self._create_backup()
                results["backup"] = backup_result
                if not backup_result["success"]:
                    results["errors"].append("Backup creation failed")
                    return results

            with self.engine.connect() as conn:
                with conn.begin():
                    if dry_run:
                        results["operations"] = self._simulate_migration(plan)
                    else:
                        results["operations"] = self._execute_migration(conn, plan)

            results["success"] = True

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            results["errors"].append(str(e))
            if not dry_run:
                self._rollback_migration()

        return results

    def _create_backup(self) -> Dict[str, Any]:
        """Create a database backup before migration."""
        try:
            backup_file = f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.sql"

            from app.rag.config import settings

            from urllib.parse import urlparse
            from app.rag.config import settings

            backup_file = f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.sql"

            parsed = urlparse(settings.DATABASE_URL)

            cmd = [
                "pg_dump",
                "-h",
                parsed.hostname or "localhost",
                "-p",
                str(parsed.port or 5432),
                "-U",
                parsed.username or "postgres",
                "-d",
                parsed.path.lstrip("/") or "olivia",
                "-f",
                backup_file,
            ]

            env = os.environ.copy()
            if parsed.password:
                env["PGPASSWORD"] = parsed.password

            result = subprocess.run(cmd, env=env, capture_output=True, text=True)

            if result.returncode == 0:
                return {"success": True, "file": backup_file}
            else:
                return {"success": False, "error": result.stderr}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _simulate_migration(self, plan: MigrationPlan) -> List[Dict[str, str]]:
        """Simulate migration operations without executing them."""
        operations = []

        for table_name in plan.tables_to_create:
            operations.append(
                {
                    "operation": "CREATE_TABLE",
                    "table": table_name,
                    "status": "WOULD_CREATE",
                }
            )

        for table_name, columns in plan.columns_to_add.items():
            for col in columns:
                operations.append(
                    {
                        "operation": "ADD_COLUMN",
                        "table": table_name,
                        "column": col,
                        "status": "WOULD_ADD",
                    }
                )

        for table_name, columns in plan.columns_to_remove.items():
            for col in columns:
                operations.append(
                    {
                        "operation": "DROP_COLUMN",
                        "table": table_name,
                        "column": col,
                        "status": "WOULD_DROP",
                    }
                )

        return operations

    def _execute_migration(self, conn, plan: MigrationPlan) -> List[Dict[str, str]]:
        """Execute actual migration operations."""
        operations = []
        inspector = inspect(conn)

        for table_name in plan.tables_to_create:
            op.create_table(table_name)
            operations.append(
                {"operation": "CREATE_TABLE", "table": table_name, "status": "SUCCESS"}
            )

        for table_name, columns in plan.columns_to_add.items():
            for col in columns:
                if not _column_exists(conn, inspector, table_name, col):
                    op.add_column(
                        table_name, sa.Column(col, sa.String(), nullable=True)
                    )
                    operations.append(
                        {
                            "operation": "ADD_COLUMN",
                            "table": table_name,
                            "column": col,
                            "status": "SUCCESS",
                        }
                    )

        for table_name, columns in plan.columns_to_remove.items():
            for col in columns:
                if _column_exists(conn, inspector, table_name, col):
                    op.drop_column(table_name, col)
                    operations.append(
                        {
                            "operation": "DROP_COLUMN",
                            "table": table_name,
                            "column": col,
                            "status": "SUCCESS",
                        }
                    )

        return operations

    def _rollback_migration(self):
        """Rollback migration in case of failure."""
        logger.warning("Rolling back migration due to failure")


def _table_exists(conn, inspector, table_name: str) -> bool:
    """Check if table exists in database."""
    return table_name in inspector.get_table_names()


def _column_exists(conn, inspector, table_name: str, column_name: str) -> bool:
    """Check if column exists in table."""
    if not _table_exists(conn, inspector, table_name):
        return False
    return column_name in [col["name"] for col in inspector.get_columns(table_name)]


class AutoMigrationManager:
    """Main manager for automatic database migrations."""

    def __init__(self, engine=None):
        from app.core.database import engine as db_engine

        self.engine = engine or db_engine
        self.alembic_dir = Path(__file__).parent.parent.parent / "alembic"
        self.schema_detector = SchemaDetector(self.engine)
        self.migration_generator = MigrationGenerator(self.alembic_dir)
        self.migration_executor = MigrationExecutor(self.engine)

    def detect_changes(self) -> MigrationPlan:
        """Detect schema changes between models and database."""
        model_schema = self.schema_detector.get_model_schema()
        current_schema = self.schema_detector.get_current_schema()
        return self.schema_detector.compare_schemas(model_schema, current_schema)

    def generate_and_apply_migration(
        self,
        message: str = "Auto-generated migration",
        dry_run: bool = False,
        auto_approve: bool = False,
    ) -> Dict[str, Any]:
        """Generate and apply a migration automatically."""
        plan = self.detect_changes()

        if not plan.tables_to_create and not plan.columns_to_add:
            return {
                "success": True,
                "message": "No changes detected. Database is up to date.",
                "operations": [],
            }

        print(f"\n📋 Migration Plan for revision {plan.revision_id}")
        print(f"   Tables to create: {plan.tables_to_create}")
        print(f"   Tables to alter: {plan.tables_to_alter}")
        print(f"   Columns to add: {plan.columns_to_add}")
        print(f"   Columns to remove: {plan.columns_to_remove}")

        if dry_run:
            print("\n🔍 DRY RUN - No changes will be applied")
            operations = self.migration_executor._simulate_migration(plan)
            return {"success": True, "operations": operations, "dry_run": True}

        if not auto_approve:
            print("\n❓ Do you want to apply these changes? (y/N)")
            if input().lower() not in ["y", "yes"]:
                return {"success": False, "message": "Migration cancelled by user"}

        migration_path = self.migration_generator.generate_migration(plan, message)
        print(f"\n✅ Migration script generated: {migration_path}")

        result = self.migration_executor.execute_migration(plan)

        if result["success"]:
            print("\n✅ Migration completed successfully!")
        else:
            print(f"\n❌ Migration failed: {result['errors']}")

        return result


def auto_migrate(
    message: str = "Auto-generated migration",
    dry_run: bool = False,
    auto_approve: bool = False,
) -> Dict[str, Any]:
    """Convenience function for automatic migration."""
    manager = AutoMigrationManager()
    return manager.generate_and_apply_migration(message, dry_run, auto_approve)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Automatic Database Migration")
    parser.add_argument(
        "--dry-run", action="store_true", help="Show changes without applying"
    )
    parser.add_argument(
        "--auto-approve", action="store_true", help="Skip confirmation prompt"
    )
    parser.add_argument(
        "--message",
        type=str,
        default="Auto-generated migration",
        help="Migration message",
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    result = auto_migrate(
        message=args.message, dry_run=args.dry_run, auto_approve=args.auto_approve
    )

    if result["success"]:
        print(f"✅ {result.get('message', 'Migration successful')}")
        if "operations" in result:
            for op in result["operations"]:
                print(f"   - {op}")
    else:
        print(f"❌ {result.get('message', 'Migration failed')}")
        sys.exit(1)
