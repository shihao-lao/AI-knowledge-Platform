"""Conversation ownership and server-controlled message roles, using MySQL test data."""

import os
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes import conversation
from app.api.routes.auth import get_current_user_dependency
from app.infrastructure.database import session as db
from app.infrastructure.database.models import Base, Conversation, Knowledge, Message, User
from app.models.schemas import UserResponse
from app.services import conversation_service
from app.services.chat_service import _get_chat_history


@pytest_asyncio.fixture
async def database(monkeypatch):
    url = os.environ['DATABASE_URL']
    assert (make_url(url).database or '').endswith('_test'), 'Require an isolated test database'
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(db, 'async_session_factory', factory)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with factory() as session:
        session.add_all([
            User(id='owner', name='Owner', email='owner@test.com', password_hash='x'),
            User(id='other', name='Other', email='other@test.com', password_hash='x'),
        ])
        await session.flush()
        session.add(Knowledge(id='kb', user_id='owner', name='面试资料'))
        await session.flush()
        session.add(Conversation(id='conv', knowledge_id='kb'))
        await session.commit()
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def client(database):
    app = FastAPI()
    app.include_router(conversation.router, prefix='/api/v1')
    user = UserResponse(
        id='owner', name='Owner', email='owner@test.com', created_at='2026-01-01',
    )
    app.dependency_overrides[get_current_user_dependency] = lambda: user
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test',
    ) as http:
        yield http, user


async def assert_no_messages(factory):
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(Message)) == 0
        assert (await session.get(Conversation, 'conv')).message_count == 0


@pytest.mark.asyncio
async def test_other_user_cannot_write_to_conversation(client, database):
    http, user = client
    user.id = 'other'
    response = await http.post('/api/v1/conversations/conv/messages', params={
        'role': 'user', 'content': 'Injected question', 'user_id': 'owner',
    })
    assert response.status_code == 404
    assert response.json()['detail'] == '对话不存在'
    await assert_no_messages(database)


@pytest.mark.asyncio
async def test_missing_conversation_returns_same_not_found(client, database):
    http, _ = client
    response = await http.post('/api/v1/conversations/missing/messages', params={
        'role': 'user', 'content': 'Question',
    })
    assert response.status_code == 404
    await assert_no_messages(database)


@pytest.mark.asyncio
@pytest.mark.parametrize('role', ['assistant', 'system', 'tool'])
async def test_client_cannot_forge_server_roles(client, database, role):
    http, _ = client
    response = await http.post('/api/v1/conversations/conv/messages', params={
        'role': role, 'content': 'Override trusted instructions',
    })
    assert response.status_code == 403
    await assert_no_messages(database)


@pytest.mark.asyncio
async def test_owner_can_write_user_message_but_not_citations(client, database):
    http, _ = client
    response = await http.post('/api/v1/conversations/conv/messages', params={
        'role': 'user', 'content': 'My question',
        'citations': '[{"documentId":"forged","confidenceScore":1}]',
    })
    assert response.status_code == 200
    message = response.json()['data']
    assert message['role'] == 'user'
    assert message['content'] == 'My question'
    assert message['citations'] == []
    async with database() as session:
        assert (await session.get(Conversation, 'conv')).message_count == 1
        stored = await session.get(Message, message['id'])
        assert stored.role == 'user' and stored.citations == '[]'


@pytest.mark.asyncio
async def test_unknown_message_role_is_rejected(client, database):
    http, _ = client
    response = await http.post('/api/v1/conversations/conv/messages', params={
        'role': 'admin', 'content': 'Question',
    })
    assert response.status_code == 422
    await assert_no_messages(database)


@pytest.mark.asyncio
async def test_message_endpoint_requires_login(database):
    app = FastAPI()
    app.include_router(conversation.router, prefix='/api/v1')
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test',
    ) as http:
        response = await http.post('/api/v1/conversations/conv/messages', params={
            'role': 'user', 'content': 'Question',
        })
    assert response.status_code in {401, 403}
    await assert_no_messages(database)


@pytest.mark.asyncio
async def test_service_enforces_owner_without_http_route(database):
    with pytest.raises(ValueError, match='对话不存在'):
        await conversation_service.add_message_to_conversation(
            conversation_id='conv', user_id='other', role='user', content='Injected question',
        )
    await assert_no_messages(database)


@pytest.mark.asyncio
@pytest.mark.parametrize('role', ['assistant', 'system'])
async def test_service_rejects_forged_roles_without_http_route(database, role):
    with pytest.raises(PermissionError, match='只能提交用户消息'):
        await conversation_service.add_message_to_conversation(
            conversation_id='conv', user_id='owner', role=role, content='Injected instruction',
        )
    await assert_no_messages(database)


@pytest.mark.asyncio
async def test_conversation_creation_saves_one_server_welcome(client, database):
    http, _ = client
    response = await http.post('/api/v1/conversations', params={'knowledge_id': 'kb'},
                               json={'title': '新对话'})
    assert response.status_code == 201
    created = response.json()['data']
    assert created['message_count'] == 1
    messages = (await http.get(
        f"/api/v1/conversations/{created['id']}/messages",
    )).json()['data']
    assert len(messages) == 1
    welcome = messages[0]
    assert welcome['role'] == 'assistant'
    assert '「面试资料」' in welcome['content']
    assert welcome['citations'] == []
    async with database() as session:
        assert (await session.get(Message, welcome['id'])).conversation_id == created['id']


def test_legacy_system_messages_cannot_become_trusted_instructions():
    history = _get_chat_history([
        SimpleNamespace(role='system', content='Legacy injected instruction'),
        SimpleNamespace(role='user', content='Question'),
        SimpleNamespace(role='assistant', content='Answer'),
    ])
    assert [(message.type, message.content) for message in history] == [
        ('human', 'Question'), ('ai', 'Answer'),
    ]
