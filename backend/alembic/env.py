from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from sqlalchemy.pool import NullPool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.chat.models import ChatMessage, ChatSession
from app.auth.models import User, UserSettings
from app.collection.models import Collection
from app.document.models import Document
from sqlmodel import SQLModel

target_metadata = SQLModel.metadata


def get_sync_url():
    """Get sync database URL for migrations."""
    import os

    default_url = "postgresql://postgres:postgres@localhost:5432/neodb"
    url = os.environ.get("DATABASE_URL", default_url)
    if "+asyncpg" in url:
        url = url.replace("postgresql+asyncpg", "postgresql")
    elif "+psycopg2" in url:
        url = url.replace("+psycopg2", "")
    return url


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    if not url:
        url = get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    sync_url = get_sync_url()
    connectable = create_engine(sync_url, poolclass=NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
