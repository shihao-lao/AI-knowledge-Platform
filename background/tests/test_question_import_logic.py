"""Import regression tests using production session behavior and real row locks."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select

from app.infrastructure.database.models import Question, _utcnow
from app.models.schemas import QuestionCreate, QuestionImportRequest
from app.services import question_service


def batch(*questions):
    return QuestionImportRequest(questions=[QuestionCreate(question=q, answer='Answer') for q in questions])


@pytest.fixture
def index_stub(monkeypatch):
    monkeypatch.setattr(question_service.retrieval_service, 'sync_knowledge', AsyncMock(return_value=True))


@pytest.mark.asyncio
async def test_batch_duplicates_and_later_import_are_skipped(backend_database, index_stub):
    first = await question_service.import_questions('kb', 'owner', batch('Redis?', 'Redis?', 'TCP?'))
    repeat = await question_service.import_questions('kb', 'owner', batch('Redis?'))
    assert (first.imported, first.skipped, first.errors) == (2, 1, [])
    assert (repeat.imported, repeat.skipped, repeat.errors) == (0, 1, [])
    async with backend_database() as session:
        assert await session.scalar(select(func.count()).select_from(Question)) == 2


@pytest.mark.asyncio
async def test_legacy_duplicates_do_not_break_import(backend_database, index_stub):
    async with backend_database() as session:
        session.add_all([Question(knowledge_id='kb', question='Redis?', answer='Old') for _ in range(2)])
        await session.commit()
    result = await question_service.import_questions('kb', 'owner', batch('Redis?', 'New?'))
    assert (result.imported, result.skipped, result.errors) == (1, 1, [])


@pytest.mark.asyncio
async def test_concurrent_imports_only_insert_once(backend_database, index_stub):
    results = await asyncio.gather(*[
        question_service.import_questions('kb', 'owner', batch('Concurrent?')) for _ in range(4)
    ])
    assert sum(result.imported for result in results) == 1
    assert sum(result.skipped for result in results) == 3
    assert all(not result.errors for result in results)
    async with backend_database() as session:
        assert await session.scalar(select(func.count()).select_from(Question)) == 1


@pytest.mark.asyncio
async def test_deleted_question_can_be_imported_again(backend_database, index_stub):
    async with backend_database() as session:
        session.add(Question(knowledge_id='kb', question='Redis?', answer='Old', deleted_at=_utcnow()))
        await session.commit()
    result = await question_service.import_questions('kb', 'owner', batch('Redis?'))
    assert (result.imported, result.skipped) == (1, 0)
