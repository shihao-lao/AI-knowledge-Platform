"""Migrate legacy messages without losing their content or breaking their reads."""

import asyncio
import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.infrastructure.database.models import Conversation, Message
from app.infrastructure.database.session import to_sync_database_url


@pytest.mark.asyncio
async def test_chat_generation_migration_preserves_legacy_message(backend_database):
    async with backend_database() as session:
        session.add(Conversation(id='conv', knowledge_id='kb'))
        await session.flush()
        session.add(Message(id='old', conversation_id='conv', role='assistant', content='Legacy answer'))
        await session.commit()

    def roundtrip():
        engine = create_engine(to_sync_database_url(os.environ['DATABASE_URL']))
        try:
            config = Config('alembic.ini')
            command.stamp(config, 'b284ec039c82')
            command.downgrade(config, 'a173db928b71')
            assert 'request_id' not in {c['name'] for c in inspect(engine).get_columns('messages')}
            command.upgrade(config, 'b284ec039c82')
            with engine.connect() as connection:
                row = connection.execute(text('SELECT content, request_id, generation_status FROM messages WHERE id = :id'),
                                         {'id': 'old'}).one()
                assert tuple(row) == ('Legacy answer', None, 'completed')
        finally:
            engine.dispose()

    await asyncio.to_thread(roundtrip)
