"""Regression checks using an isolated in-memory database; no live services."""
import json
import asyncio
from collections import defaultdict
from unittest.mock import AsyncMock
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.infrastructure.database import session as db
from app.infrastructure.database.models import Base, User, Knowledge, Question, PracticeRecord
from app.services import practice_service


@pytest_asyncio.fixture
async def database(monkeypatch, vector_store):
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(db, 'async_session_factory', factory)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as session:
        session.add_all([User(id='owner', name='Owner', email='o@test.com', password_hash='x'),
                         User(id='other', name='Other', email='a@test.com', password_hash='x')])
        await session.flush()
        session.add(Knowledge(id='kb', user_id='owner', name='KB'))
        await session.flush()
        session.add(Question(id='q', knowledge_id='kb', question='Explain Python', answer='A language',
                             category='Python', keywords=json.dumps(['Python', 'language'])))
        await session.commit()
    yield factory
    await engine.dispose()


class FakeVectorStore:
    """External-service double; the database and application queries remain real."""
    def __init__(self):
        self.collections = {}
        self.writes = 0
        self.searches = []

    async def create_collection(self, name, dim):
        self.collections.setdefault(name, {})

    async def ensure_connection(self):
        pass

    async def upsert(self, collection, vectors, metadata):
        self.writes += 1
        self.collections[collection].update({row['id']: v for row, v in zip(metadata, vectors)})

    async def delete(self, collection, ids):
        for key in ids:
            self.collections[collection].pop(key, None)

    async def search(self, collection, vector, top_k, ids):
        self.searches.append((collection, ids))
        return [{'id': key, 'distance': 0.1} for key in self.collections[collection] if key in ids][:top_k]


@pytest.fixture
def vector_store(monkeypatch):
    from app.services.retrieval_service import retrieval_service
    store = FakeVectorStore()
    monkeypatch.setattr(retrieval_service, '_manager', store)
    monkeypatch.setattr(retrieval_service, '_indexed', {})
    monkeypatch.setattr(retrieval_service, '_locks', defaultdict(asyncio.Lock))
    async def embed(texts):
        return [[1.0, 0.0] for _ in texts]
    monkeypatch.setattr(retrieval_service, '_embed', embed)
    return store


@pytest.mark.asyncio
async def test_practice_rejects_other_owner(database, monkeypatch):
    evaluator = AsyncMock(return_value=(80, 'ok'))
    monkeypatch.setattr(practice_service, '_evaluate_answer_with_llm', evaluator)
    with pytest.raises(ValueError, match='题目不存在'):
        await practice_service.evaluate_answer('q', 'other', 'Python language')
    evaluator.assert_not_awaited()
    async with database() as session:
        assert await session.scalar(select(func.count()).select_from(PracticeRecord)) == 0


@pytest.mark.asyncio
async def test_empty_stats_contract(database):
    result = (await practice_service.get_practice_stats('owner', 'kb')).model_dump()
    assert result['total'] == 0
    assert result['by_category'] == []
    assert result['by_difficulty'] == []
    assert result['recent'] == []


@pytest.mark.asyncio
async def test_evaluation_contract_keywords_and_statistics(database, monkeypatch):
    from app.infrastructure.llm.evaluation import AnswerEvaluation
    evaluator = AsyncMock(return_value=AnswerEvaluation(score=83, feedback='Good',
        key_points=['types'], reference_summary='A language'))
    monkeypatch.setattr(practice_service, '_evaluate_answer_with_llm', evaluator)
    result = await practice_service.evaluate_answer('q', 'owner', 'Python language')
    assert evaluator.await_args.args[3] == ['Python', 'language']
    assert result.record_id == result.id
    assert result.key_points == ['types']
    stats = await practice_service.get_practice_stats('owner', 'kb')
    assert stats.total == 1 and stats.average_score == 83
    assert stats.by_category == [{'key': 'Python', 'count': 1, 'average_score': 83.0}]
    assert stats.recent[0]['question'] == 'Explain Python'
    with pytest.raises(ValueError):
        await practice_service.get_practice_stats('other', 'kb')


@pytest.mark.asyncio
async def test_failed_llm_does_not_save_grade(database, monkeypatch):
    monkeypatch.setattr(practice_service, '_evaluate_answer_with_llm', AsyncMock(side_effect=RuntimeError('offline')))
    with pytest.raises(RuntimeError):
        await practice_service.evaluate_answer('q', 'owner', 'answer')
    async with database() as session:
        assert await session.scalar(select(func.count()).select_from(PracticeRecord)) == 0


@pytest.mark.asyncio
async def test_document_detail_and_toggle(database):
    from app.infrastructure.database.models import Document, Chunk
    from app.services import document_service as service
    async with database() as session:
        session.add(Document(id='doc', knowledge_id='kb', filename='a.txt'))
        await session.flush()
        session.add(Chunk(id='chunk', document_id='doc', content='Hello', chunk_index=0))
        await session.commit()
    detail = await service.get_document('doc', 'owner')
    assert detail.chunks[0]['content'] == 'Hello'
    assert await service.get_document('doc', 'other') is None
    assert await service.update_document_enabled('doc', 'other', False) is None
    await service.update_document_enabled('doc', 'owner', False)
    assert (await service.get_document('doc', 'owner')).enabled is False


@pytest.mark.asyncio
async def test_resume_delete_ownership(database, tmp_path, monkeypatch):
    from app.infrastructure.database.models import Resume
    from app.services import resume_service as service
    monkeypatch.chdir(tmp_path)
    path = tmp_path / 'uploads' / 'resumes' / 'r_cv.txt'
    path.parent.mkdir(parents=True)
    path.write_text('CV')
    async with database() as session:
        session.add(Resume(id='r', user_id='owner', filename='cv.txt', content='CV', analysis='Report'))
        await session.commit()
    assert await service.delete_resume('r', 'other') is False
    assert path.exists()
    assert (await service.get_resume('r', 'owner')).analysis == 'Report'
    assert await service.delete_resume('r', 'owner') is True
    assert not path.exists()
    assert await service.get_resume('r', 'owner') is None


@pytest.mark.asyncio
async def test_citations_aggregate_persisted_owned_records(database):
    from app.infrastructure.database.models import Document, Conversation, Message
    from app.services.citation_service import get_citation_stats
    async with database() as session:
        session.add(Document(id='doc', knowledge_id='kb', filename='a.txt'))
        session.add(Conversation(id='conv', knowledge_id='kb'))
        await session.flush()
        session.add(Message(conversation_id='conv', role='assistant', content='Answer [1]',
            citations=json.dumps([{'documentId': 'doc', 'chunkIndex': 2, 'confidenceScore': 0.8}])))
        await session.commit()
    result = await get_citation_stats('kb', 'owner')
    assert result['summary']['total_citations'] == 1
    assert result['summary']['total_assistant_messages'] == 1
    assert result['documents'][0]['chunk_breakdown'] == [{'chunk_index': 2, 'count': 1}]
    with pytest.raises(ValueError):
        await get_citation_stats('kb', 'other')


@pytest.mark.asyncio
async def test_rag_indexes_documents_questions_and_filters_disabled(database, vector_store):
    from app.infrastructure.database.models import Document, Chunk
    from app.services.document_service import update_document_enabled, delete_document
    from app.services.retrieval_service import retrieval_service
    async with database() as session:
        session.add(Knowledge(id='foreign-kb', user_id='other', name='Private'))
        session.add(Document(id='doc', knowledge_id='kb', filename='Python.txt', parse_status='ready'))
        await session.flush()
        session.add(Document(id='foreign-doc', knowledge_id='foreign-kb', filename='Secret.txt', parse_status='ready'))
        session.add(Chunk(id='chunk', document_id='doc', content='Python language', chunk_index=3))
        await session.flush()
        session.add(Chunk(id='secret', document_id='foreign-doc', content='Python private'))
        await session.commit()
    rows = await retrieval_service.retrieve('Python', 'kb', 'owner')
    assert {r.id for r in rows} == {'q', 'chunk'}
    assert next(r for r in rows if r.id == 'chunk').metadata['document_id'] == 'doc'
    assert vector_store.writes == 1
    await retrieval_service.retrieve('Python', 'kb', 'owner')
    assert vector_store.writes == 1  # no duplicate embeddings or vector writes
    with pytest.raises(ValueError):
        await retrieval_service.retrieve('Python', 'kb', 'other')
    await update_document_enabled('doc', 'owner', False)
    rows = await retrieval_service.retrieve('Python', 'kb', 'owner')
    assert [r.id for r in rows] == ['q']
    assert 'chunk' not in vector_store.collections[retrieval_service._collection('kb')]
    await update_document_enabled('doc', 'owner', True)
    assert 'chunk' in {r.id for r in await retrieval_service.retrieve('Python', 'kb', 'owner')}
    await delete_document('doc', 'owner')
    assert 'chunk' not in {r.id for r in await retrieval_service.retrieve('Python', 'kb', 'owner')}


@pytest.mark.asyncio
async def test_rag_keeps_real_keyword_hits_when_vector_service_fails(database, monkeypatch):
    from app.services.retrieval_service import retrieval_service
    monkeypatch.setattr(retrieval_service, '_embed', AsyncMock(side_effect=RuntimeError('offline')))
    rows = await retrieval_service.retrieve('Python', 'kb', 'owner')
    assert rows[0].id == 'q' and rows[0].source == 'keyword'
    assert 'A language' in rows[0].content


@pytest.mark.asyncio
async def test_chinese_keyword_fallback(database, monkeypatch):
    from app.services.retrieval_service import retrieval_service
    async with database() as session:
        question = await session.get(Question, 'q')
        question.question = '什么是闭包'
        question.answer = '闭包可以保留外部函数的变量'
        await session.commit()
    monkeypatch.setattr(retrieval_service, '_embed', AsyncMock(side_effect=RuntimeError('offline')))
    rows = await retrieval_service.retrieve('闭包作用', 'kb', 'owner')
    assert rows and rows[0].id == 'q'


@pytest.mark.asyncio
async def test_invalid_document_leaves_no_file_or_record(database, tmp_path, monkeypatch):
    from app.services.document_service import upload_document
    from app.infrastructure.database.models import Document
    monkeypatch.chdir(tmp_path)
    with pytest.raises(RuntimeError, match='没有可提取的文本'):
        await upload_document('kb', b' \n', 'empty.txt', 'text/plain', 'owner')
    assert list((tmp_path / 'uploads').iterdir()) == []
    async with database() as session:
        assert await session.scalar(select(func.count()).select_from(Document)) == 0


@pytest.mark.asyncio
async def test_upload_and_import_write_vectors(database, vector_store, tmp_path, monkeypatch):
    from app.services import document_service, question_service
    from app.services.retrieval_service import retrieval_service
    from app.models.schemas import QuestionImportRequest, QuestionCreate
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(document_service.ETLPipeline, 'run_bytes', AsyncMock(
        return_value=SimpleNamespace(chunks=['A new document about Redis'])))
    uploaded = await document_service.upload_document('kb', b'file', 'new.txt', 'text/plain', 'owner')
    assert uploaded.status == 'ready'
    result = await question_service.import_questions('kb', 'owner', QuestionImportRequest(
        questions=[QuestionCreate(question='What is Redis?', answer='A cache', keywords=['Redis'])]))
    assert result.imported == 1
    records = await retrieval_service._corpus('kb', 'owner')
    assert len(records) == 3
    assert set(records) == set(vector_store.collections[retrieval_service._collection('kb')])


@pytest.mark.asyncio
async def test_chat_uses_owned_rag_context_and_correct_document_citations(database, monkeypatch):
    from app.services.chat_service import ChatService
    from app.services.retrieval_service import retrieval_service
    from app.infrastructure.database.models import Conversation, Message
    from app.models.schemas import RetrievalResult
    from langchain_core.runnables import RunnableLambda
    async with database() as session:
        session.add(Conversation(id='conv', knowledge_id='kb'))
        await session.commit()
    retrieve = AsyncMock(return_value=[RetrievalResult(id='chunk', content='Verified knowledge',
        score=0.9, metadata={'type': 'doc', 'document_id': 'doc', 'filename': 'a.txt', 'chunk_index': 3})])
    monkeypatch.setattr(retrieval_service, 'retrieve', retrieve)
    def answer(prompt):
        assert 'Verified knowledge' in prompt.to_string()
        return 'Grounded answer [1]'
    service = ChatService()
    monkeypatch.setattr(service, '_get_llm', lambda streaming=False: RunnableLambda(answer))
    response = await service.handle_chat('conv', 'question', 'owner')
    output = b''.join([chunk async for chunk in response.body_iterator]).decode()
    assert '[DONE]' in output
    retrieve.assert_awaited_once_with('question', 'kb', 'owner')
    async with database() as session:
        message = await session.scalar(select(Message).where(Message.role == 'assistant'))
        citation = json.loads(message.citations)[0]
        assert citation['documentId'] == 'doc' and citation['chunkIndex'] == 3
    retrieve.reset_mock()
    response = await service.handle_chat('conv', 'question', 'other')
    output = b''.join([chunk async for chunk in response.body_iterator]).decode()
    assert 'error' in output
    retrieve.assert_not_awaited()


@pytest.mark.asyncio
async def test_http_contracts_and_ownership(database, monkeypatch):
    import httpx
    from fastapi import FastAPI
    from app.api.routes import citation, document, practice, resume
    from app.api.routes.auth import get_current_user_dependency
    from app.infrastructure.database.models import Document, Resume
    from app.infrastructure.llm.evaluation import AnswerEvaluation
    from app.models.schemas import UserResponse
    app = FastAPI()
    for route in (citation, document, practice, resume):
        app.include_router(route.router, prefix='/api/v1')
    user = UserResponse(id='owner', name='Owner', email='o@test.com', created_at='2026-01-01')
    app.dependency_overrides[get_current_user_dependency] = lambda: user
    monkeypatch.setattr(practice_service, '_evaluate_answer_with_llm', AsyncMock(
        return_value=AnswerEvaluation(score=90, feedback='Good', key_points=[], reference_summary='Summary')))
    async with database() as session:
        session.add(Document(id='doc', knowledge_id='kb', filename='a.txt'))
        session.add(Resume(id='r', user_id='owner', filename='cv.txt', content='CV', analysis='Report'))
        await session.commit()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/v1/practice/evaluate', json={'question_id': 'q', 'user_answer': 'Answer'})
        assert response.status_code == 201
        assert response.json()['data']['key_points'] == []
        stats = (await client.get('/api/v1/practice/stats?knowledge_id=kb')).json()['data']
        assert stats['total'] == 1 and stats['by_category'][0]['average_score'] == 90
        response = await client.put('/api/v1/document/doc', json={'enabled': False})
        assert response.status_code == 200 and response.json()['data']['enabled'] is False
        response = await client.put('/api/v1/document/doc', json={'enabled': 'false'})
        assert response.status_code == 422
        user.id = 'other'
        assert (await client.post('/api/v1/practice/evaluate', json={
            'question_id': 'q', 'user_answer': 'Answer'})).status_code == 404
        assert (await client.get('/api/v1/practice/stats?knowledge_id=kb')).status_code == 404
        assert (await client.get('/api/v1/citations/stats?knowledge_id=kb')).status_code == 404
        assert (await client.put('/api/v1/document/doc', json={'enabled': True})).status_code == 404
        assert (await client.delete('/api/v1/resumes/r')).status_code == 404
