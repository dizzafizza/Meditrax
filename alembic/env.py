from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from sqlalchemy import MetaData, Table, Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.sql import func

metadata = MetaData()

# Define ConPort tables for Alembic
product_context = Table(
    'product_context', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('content', JSON),
    Column('version', Integer, default=1),
    Column('created_at', DateTime, default=func.now()),
    Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
)

active_context = Table(
    'active_context', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('content', JSON),
    Column('version', Integer, default=1),
    Column('created_at', DateTime, default=func.now()),
    Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
)

decisions = Table(
    'decisions', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('summary', Text, nullable=False),
    Column('rationale', Text),
    Column('implementation_details', Text),
    Column('tags', JSON),
    Column('created_at', DateTime, default=func.now()),
    Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
)

progress = Table(
    'progress', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('status', String(100), nullable=False),
    Column('description', Text, nullable=False),
    Column('parent_id', Integer),
    Column('linked_item_type', String(100)),
    Column('linked_item_id', String(500)),
    Column('link_relationship_type', String(100), default='relates_to_progress'),
    Column('created_at', DateTime, default=func.now()),
    Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
)

system_patterns = Table(
    'system_patterns', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('name', String(500), nullable=False),
    Column('description', Text),
    Column('tags', JSON),
    Column('created_at', DateTime, default=func.now()),
    Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
)

custom_data = Table(
    'custom_data', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('category', String(200), nullable=False),
    Column('key', String(500), nullable=False),
    Column('value', JSON, nullable=False),
    Column('created_at', DateTime, default=func.now()),
    Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
)

links = Table(
    'links', metadata,
    Column('id', Integer, primary_key=True),
    Column('workspace_id', String(500), nullable=False),
    Column('source_item_type', String(100), nullable=False),
    Column('source_item_id', String(500), nullable=False),
    Column('target_item_type', String(100), nullable=False),
    Column('target_item_id', String(500), nullable=False),
    Column('relationship_type', String(200), nullable=False),
    Column('description', Text),
    Column('created_at', DateTime, default=func.now())
)

target_metadata = metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
