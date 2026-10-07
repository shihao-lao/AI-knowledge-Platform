"""Upgrade/downgrade the cleanup schema against the isolated MySQL database."""

import asyncio
import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.infrastructure.database.models import KnowledgeVectorIndex, ResourceCleanupTask
from app.infrastructure.database.session import to_sync_database_url


@pytest.mark.asyncio
async def test_cleanup_migration_roundtrip(backend_database):
    def roundtrip():
        engine = create_engine(to_sync_database_url(os.environ['DATABASE_URL']))
        try:
            with engine.begin() as connection:
                ResourceCleanupTask.__table__.drop(connection)
                KnowledgeVectorIndex.__table__.drop(connection)
            config = Config('alembic.ini')
            command.stamp(config, 'f8249ba0c301')
            command.upgrade(config, 'a173db928b71')
            assert 'resource_cleanup_tasks' in inspect(engine).get_table_names()
            assert inspect(engine).get_foreign_keys('knowledge_vector_indexes')[0]['options']['ondelete'] == 'CASCADE'
            command.downgrade(config, 'f8249ba0c301')
            assert 'resource_cleanup_tasks' not in inspect(engine).get_table_names()
            command.upgrade(config, 'a173db928b71')
            columns = {column['name'] for column in inspect(engine).get_columns('resource_cleanup_tasks')}
            assert {'files', 'collections', 'attempts', 'next_attempt_at', 'last_error'} <= columns
        finally:
            engine.dispose()

    await asyncio.to_thread(roundtrip)
