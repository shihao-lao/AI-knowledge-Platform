"""Regression checks using an isolated in-memory database; no live services."""
import json
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.infrastructure.database import session as db
from app.infrastructure.database.models import Base, User, Knowledge, Question, PracticeRecord
from app.services import practice_service


@pytest_asyncio.fixture
async def database(monkeypatch):
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
