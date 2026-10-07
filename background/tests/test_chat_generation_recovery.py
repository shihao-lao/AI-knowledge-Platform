"""Real SQL transactions around provider failure, retry, disconnect and replay."""

import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import httpx
from fastapi import FastAPI
from langchain_core.runnables import RunnableLambda
from sqlalchemy import select

from app.infrastructure.database.models import Conversation, Message, _utcnow
from app.infrastructure.llm.config import LLMConfig
from app.models.schemas import RetrievalResult
from app.models.schemas import UserResponse
from app.api.routes.chat import router
from app.api.routes.auth import get_current_user_dependency
from app.services import chat_service as chat_module
from app.services.chat_generation_service import claim_generation, persist_generation
from app.services.chat_service import ChatService
from app.services.conversation_service import get_messages_by_conversation


@pytest.fixture
def provider(monkeypatch):
    config = AsyncMock(return_value=LLMConfig(base_url='https://test.invalid/v1', api_key='dummy', model='dummy'))
    monkeypatch.setattr(chat_module, 'resolve_llm_config', config)
    return config


async def seed_conversation(factory):
    async with factory() as session:
        session.add(Conversation(id='conv', knowledge_id='kb'))
        await session.commit()


async def consume(service, request_id, question='Question', owner='owner', search=False):
    response = await service.handle_chat('conv', question, owner, enable_search=search, request_id=request_id)
    return b''.join([chunk async for chunk in response.body_iterator]).decode()


async def stored(factory):
    async with factory() as session:
        messages = list((await session.scalars(select(Message).order_by(Message.message_index))).all())
        conversation = await session.get(Conversation, 'conv')
        return messages, conversation.message_count


@pytest.mark.asyncio
async def test_failed_answer_reload_retry_and_completed_replay(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    request_id = str(uuid4())
    service = ChatService()

    async def failed(prompt):
        yield 'partial answer [1]'
        raise RuntimeError('provider offline')

    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(failed))
    monkeypatch.setattr(service, '_retrieve', AsyncMock(return_value=[RetrievalResult(
        id='chunk', content='Verified context', metadata={'document_id': 'doc', 'type': 'doc'},
    )]))
    output = await consume(service, request_id, search=True)
    assert 'partial answer' in output and 'error' in output and '[DONE]' not in output
    rows, count = await stored(backend_database)
    assert [row.role for row in rows] == ['user', 'assistant']
    assert count == 2 and rows[1].content == 'partial answer [1]'
    assert rows[1].generation_status == 'failed'
    original_id = rows[1].id
    reloaded = await get_messages_by_conversation('conv', 'owner')
    assert reloaded[1].error and reloaded[1].retry_question == 'Question'
    assert reloaded[1].request_id == request_id
    assert reloaded[1].citations[0]['documentId'] == 'doc'

    def succeeded(prompt):
        assert 'partial answer' not in prompt.to_string()
        assert prompt.to_string().count('Question') == 1
        return 'Complete answer [1]'

    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(succeeded))
    assert '[DONE]' in await consume(service, request_id, search=True)
    rows, count = await stored(backend_database)
    assert len(rows) == count == 2
    assert rows[1].id == original_id and rows[1].generation_status == 'completed'
    assert rows[1].content == 'Complete answer [1]'
    provider.reset_mock()
    replay = await consume(service, request_id, search=True)
    assert 'Complete answer' in replay and '[DONE]' in replay
    provider.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_config_keeps_a_retryable_pair_without_retrieval(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    provider.return_value = LLMConfig(base_url='', api_key='', model='')
    service = ChatService()
    retrieve = AsyncMock()
    monkeypatch.setattr(service, '_retrieve', retrieve)
    request_id = str(uuid4())
    assert 'error' in await consume(service, request_id, search=True)
    retrieve.assert_not_awaited()
    rows, count = await stored(backend_database)
    assert len(rows) == count == 2
    assert rows[1].generation_status == 'failed'


@pytest.mark.asyncio
async def test_active_generation_cannot_be_duplicated(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    started, release = asyncio.Event(), asyncio.Event()
    calls = []

    async def blocked(prompt):
        calls.append(prompt)
        yield 'partial'
        started.set()
        await release.wait()
        yield ' completed'

    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(blocked))
    service = ChatService()
    request_id = str(uuid4())
    first = asyncio.create_task(consume(service, request_id))
    try:
        await asyncio.wait_for(started.wait(), 3)
        assert 'error' in await consume(service, request_id)
        assert 'error' in await consume(service, str(uuid4()), question='Another question')
    finally:
        release.set()
        first_output = await first
    assert '[DONE]' in first_output and len(calls) == 1
    rows, count = await stored(backend_database)
    assert len(rows) == count == 2


@pytest.mark.asyncio
async def test_request_payload_and_owner_are_checked(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(lambda prompt: 'Answer'))
    service = ChatService()
    request_id = str(uuid4())
    assert '[DONE]' in await consume(service, request_id)
    assert 'error' in await consume(service, request_id, question='Different')
    assert 'error' in await consume(service, request_id, search=True)
    assert 'error' in await consume(service, request_id, owner='other')
    rows, count = await stored(backend_database)
    assert len(rows) == count == 2
    assert rows[1].content == 'Answer'


@pytest.mark.asyncio
async def test_disconnect_preserves_partial_answer(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)

    async def answer(prompt):
        yield 'Visible partial answer'
        await asyncio.Event().wait()

    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(answer))
    response = await ChatService().handle_chat('conv', 'Question', 'owner', enable_search=False, request_id=str(uuid4()))
    assert b'"request"' in await anext(response.body_iterator)
    assert b'Visible partial answer' in await anext(response.body_iterator)
    await response.body_iterator.aclose()
    rows, count = await stored(backend_database)
    assert count == 2 and rows[1].content == 'Visible partial answer'
    assert rows[1].generation_status == 'interrupted'
    assert rows[1].generation_token is None


@pytest.mark.asyncio
async def test_expired_lease_is_retryable_and_stale_writer_cannot_overwrite(backend_database):
    await seed_conversation(backend_database)
    request_id = str(uuid4())
    old = await claim_generation('conv', 'owner', 'Question', request_id, False, 180)
    await persist_generation(old, 'Saved before process crash')
    async with backend_database() as session:
        message = await session.get(Message, old.assistant_id)
        message.generation_expires_at = _utcnow() - timedelta(seconds=1)
        await session.commit()
    reloaded = await get_messages_by_conversation('conv', 'owner')
    assert reloaded[1].generation_status == 'interrupted'
    assert reloaded[1].retry_question == 'Question'
    new = await claim_generation('conv', 'owner', 'Question', request_id, False, 180)
    assert old.token != new.token
    assert not await persist_generation(old, 'Stale answer', status='completed')
    assert await persist_generation(new, 'Recovered answer', status='completed')
    rows, count = await stored(backend_database)
    assert len(rows) == count == 2 and rows[1].content == 'Recovered answer'


@pytest.mark.asyncio
async def test_failed_retry_before_new_delta_retains_existing_partial(backend_database):
    await seed_conversation(backend_database)
    request_id = str(uuid4())
    old = await claim_generation('conv', 'owner', 'Question', request_id, False, 180)
    await persist_generation(old, 'Original partial', status='failed', error='offline')
    retry = await claim_generation('conv', 'owner', 'Question', request_id, False, 180)
    await persist_generation(retry, status='failed', error='Still offline')
    rows, count = await stored(backend_database)
    assert count == 2 and rows[1].content == 'Original partial'


@pytest.mark.asyncio
async def test_generation_timeout_preserves_partial_and_releases_claim(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    monkeypatch.setenv('CHAT_GENERATION_TIMEOUT', '1')

    async def stuck(prompt):
        yield 'Partial before timeout'
        await asyncio.Event().wait()

    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(stuck))
    output = await consume(ChatService(), str(uuid4()))
    assert 'error' in output and '[DONE]' not in output
    rows, count = await stored(backend_database)
    assert count == 2 and rows[1].content == 'Partial before timeout'
    assert rows[1].generation_status == 'failed' and rows[1].generation_token is None


@pytest.mark.asyncio
async def test_http_request_id_is_validated_and_replayed(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(lambda prompt: 'Answer'))
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user_dependency] = lambda: UserResponse(
        id='owner', name='Owner', email='owner@test.com', created_at='2026-10-07',
    )
    data = {'conversation_id': 'conv', 'question': 'Question', 'request_id': str(uuid4()), 'enable_search': False}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
        first = await client.post('/chat', json=data)
        second = await client.post('/chat', json=data)
        assert '[DONE]' in first.text and '[DONE]' in second.text
        data['request_id'] = 'invalid'
        assert (await client.post('/chat', json=data)).status_code == 422
    rows, count = await stored(backend_database)
    assert len(rows) == count == 2
    assert provider.await_count == 1


@pytest.mark.asyncio
async def test_failed_turn_does_not_enter_future_chat_history(backend_database, provider, monkeypatch):
    await seed_conversation(backend_database)
    old = await claim_generation('conv', 'owner', 'Failed old question', str(uuid4()), False, 180)
    await persist_generation(old, 'Unfinished old answer', status='failed')

    def answer(prompt):
        assert 'Failed old question' not in prompt.to_string()
        assert 'Unfinished old answer' not in prompt.to_string()
        return 'New answer'

    monkeypatch.setattr(chat_module, 'build_chat_model', lambda *args, **kwargs: RunnableLambda(answer))
    assert '[DONE]' in await consume(ChatService(), str(uuid4()))
