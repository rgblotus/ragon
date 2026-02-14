"""add sources column to chatmessage

Revision ID: a1b2c3d4
Revises:
Create Date: 2026-01-17 19:38:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sources column to chat_message table."""
    conn = op.get_bind()
    table_name = "chat_message"

    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if table_name in tables:
        columns = [col["name"] for col in inspector.get_columns(table_name)]
        if "sources" not in columns:
            op.add_column(table_name, sa.Column("sources", sa.JSON(), nullable=True))
    else:
        print(f"Table '{table_name}' does not exist, skipping migration")


def downgrade() -> None:
    """Remove sources column from chat_message table."""
    op.drop_column("chat_message", "sources")
