"""
ConPort database schema for initialization
"""
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.sql import func
import sqlite3
import os

def create_conport_tables():
    """Create basic ConPort tables"""
    
    # Create database file if it doesn't exist
    db_path = "./conport.db"
    
    # Create connection
    engine = create_engine(f"sqlite:///{db_path}")
    metadata = MetaData()
    
    # Product Context table
    product_context = Table(
        'product_context',
        metadata,
        Column('id', Integer, primary_key=True),
        Column('workspace_id', String(500), nullable=False),
        Column('content', JSON),
        Column('version', Integer, default=1),
        Column('created_at', DateTime, default=func.now()),
        Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
    )
    
    # Active Context table
    active_context = Table(
        'active_context',
        metadata,
        Column('id', Integer, primary_key=True),
        Column('workspace_id', String(500), nullable=False),
        Column('content', JSON),
        Column('version', Integer, default=1),
        Column('created_at', DateTime, default=func.now()),
        Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
    )
    
    # Decisions table
    decisions = Table(
        'decisions',
        metadata,
        Column('id', Integer, primary_key=True),
        Column('workspace_id', String(500), nullable=False),
        Column('summary', Text, nullable=False),
        Column('rationale', Text),
        Column('implementation_details', Text),
        Column('tags', JSON),
        Column('created_at', DateTime, default=func.now()),
        Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
    )
    
    # Progress table
    progress = Table(
        'progress',
        metadata,
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
    
    # System Patterns table
    system_patterns = Table(
        'system_patterns',
        metadata,
        Column('id', Integer, primary_key=True),
        Column('workspace_id', String(500), nullable=False),
        Column('name', String(500), nullable=False),
        Column('description', Text),
        Column('tags', JSON),
        Column('created_at', DateTime, default=func.now()),
        Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
    )
    
    # Custom Data table
    custom_data = Table(
        'custom_data',
        metadata,
        Column('id', Integer, primary_key=True),
        Column('workspace_id', String(500), nullable=False),
        Column('category', String(200), nullable=False),
        Column('key', String(500), nullable=False),
        Column('value', JSON, nullable=False),
        Column('created_at', DateTime, default=func.now()),
        Column('updated_at', DateTime, default=func.now(), onupdate=func.now())
    )
    
    # Links table
    links = Table(
        'links',
        metadata,
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
    
    # Create all tables
    metadata.create_all(engine)
    print(f"ConPort database created successfully at {db_path}")
    
    return engine

if __name__ == "__main__":
    create_conport_tables()
