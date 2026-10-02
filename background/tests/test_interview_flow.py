"""真实 MySQL + HTTP 面试流程；仅替换外部模型评分。"""
import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import func, select

from app.api.routes import chat, interview
from app.api.routes.auth import get_current_user_dependency
from app.infrastructure.database.models import InterviewSession, PracticeRecord, Question
from app.infrastructure.llm.evaluation import AnswerEvaluation
from app.models.schemas import UserResponse
from app.services import practice_service
from tests.test_conversation_message_security import database  # noqa: F401

PATH = '/conversations/conv/interview'


@pytest_asyncio.fixture
async def client(database, monkeypatch):
    async with database() as session:
        session.add_all([
            Question(id='q1', knowledge_id='kb', question='React 是什么？', answer='UI 库',
                     category='React', difficulty='easy', keywords='["UI"]'),
            Question(id='q2', knowledge_id='kb', question='什么是闭包？', answer='捕获词法环境',
                     category='React', difficulty='medium', keywords='["词法环境"]'),
            Question(id='q3', knowledge_id='kb', question='Python 是什么？', answer='编程语言',
                     category='Python', difficulty='easy', keywords='[]'),
        ])
        await session.commit()
    evaluator = AsyncMock(return_value=AnswerEvaluation(
        score=85, feedback='解释基本正确', key_points=['补充实例'], reference_summary='参考要点',
    ))
    monkeypatch.setattr(practice_service, '_evaluate_answer_with_llm', evaluator)
    app = FastAPI()
    app.include_router(interview.router)
    app.include_router(chat.router)
    user = UserResponse(id='owner', name='Owner', email='o@test.com', created_at='2026-01-01')
    app.dependency_overrides[get_current_user_dependency] = lambda: user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as http:
        yield http, user, evaluator


async def start(http, **data):
    response = await http.post(PATH, json={'question_count': 2, **data})
    assert response.status_code == 200, response.text
    return response.json()['data']


@pytest.mark.asyncio
async def test_full_interview_restores_progress_and_counts_practice(client, database):
    http, _, evaluator = client
    assert (await http.get(PATH)).json()['data'] is None
    state = await start(http)
    assert state['status'] == 'answering' and len(state['turns']) == 2
    assert 'reference_answer' not in str(state) and 'UI 库' not in str(state)
    repeated = await start(http, question_count=3)
    assert repeated['id'] == state['id'] and len(repeated['turns']) == 2
    for position in range(2):
        turn = state['turns'][position]
        response = await http.post(PATH + '/answers', json={
            'turn_id': turn['id'], 'answer': f'第 {position} 题回答',
        })
        assert response.status_code == 200, response.text
        state = response.json()['data']
        assert state['status'] == 'reviewing'
        assert state['turns'][position]['evaluation']['score'] == 85
        # 新请求只读取数据库即可恢复，不依赖内存聊天历史。
        assert (await http.get(PATH)).json()['data'] == state
        response = await http.post(PATH + '/next', json={'turn_id': turn['id']})
        assert response.status_code == 200
        state = response.json()['data']
    assert state['status'] == 'completed' and state['completed_at']
    assert state['summary'] == {'question_count': 2, 'average_score': 85.0,
                                'key_points': ['补充实例']}
    assert (await http.get(PATH)).json()['data'] == state
    stats = await practice_service.get_practice_stats('owner', 'kb')
    assert stats.total == 2 and stats.average_score == 85
    assert all(record.mode == 'mock' for record in stats.recent_records)
    assert evaluator.await_count == 2


@pytest.mark.asyncio
async def test_duplicate_answers_and_next_are_idempotent(client, database):
    http, _, evaluator = client
    state = await start(http)
    first = state['turns'][0]['id']
    responses = await asyncio.gather(*[
        http.post(PATH + '/answers', json={'turn_id': first, 'answer': '同一回答'})
        for _ in range(2)
    ])
    assert all(r.status_code == 200 for r in responses)
    assert evaluator.await_count == 1
    assert responses[0].json() == responses[1].json()
    responses = await asyncio.gather(*[
        http.post(PATH + '/next', json={'turn_id': first}) for _ in range(2)
    ])
    assert all(r.json()['data']['current_position'] == 1 for r in responses)
    async with database() as session:
        assert await session.scalar(select(func.count()).select_from(PracticeRecord)) == 1


@pytest.mark.asyncio
async def test_invalid_transitions_and_overwriting_grade_are_rejected(client):
    http, _, _ = client
    state = await start(http)
    first, second = [turn['id'] for turn in state['turns']]
    assert (await http.post(PATH + '/next', json={'turn_id': first})).status_code == 409
    assert (await http.post(PATH + '/answers', json={
        'turn_id': second, 'answer': '跳题',
    })).status_code == 409
    assert (await http.post(PATH + '/answers', json={
        'turn_id': first, 'answer': '   ',
    })).status_code == 422
    await http.post(PATH + '/answers', json={'turn_id': first, 'answer': '原回答'})
    assert (await http.post(PATH + '/answers', json={
        'turn_id': first, 'answer': '篡改回答',
    })).status_code == 409


@pytest.mark.asyncio
async def test_scoring_failure_preserves_progress_and_retry_uses_snapshot(client, database):
    http, _, evaluator = client
    state = await start(http)
    async with database() as session:
        question = await session.get(Question, 'q1')
        question.answer = '修改后的参考答案'
        await session.commit()
    payload = {'turn_id': state['turns'][0]['id'], 'answer': '用户回答'}
    evaluator.side_effect = RuntimeError('Model unavailable')
    assert (await http.post(PATH + '/answers', json=payload)).status_code == 503
    assert (await http.get(PATH)).json()['data'] == state
    assert (await practice_service.get_practice_stats('owner', 'kb')).total == 0
    evaluator.side_effect = None
    assert (await http.post(PATH + '/answers', json=payload)).status_code == 200
    assert evaluator.await_args.args == ('React 是什么？', 'UI 库', '用户回答', ['UI'], 'owner')


@pytest.mark.asyncio
async def test_all_interview_operations_are_owner_scoped(client, database):
    http, user, evaluator = client
    state = await start(http)
    user.id = 'other'
    assert (await http.get(PATH)).status_code == 404
    assert (await http.post(PATH, json={})).status_code == 404
    assert (await http.post(PATH + '/answers', json={
        'turn_id': state['turns'][0]['id'], 'answer': '越权回答',
    })).status_code == 404
    assert (await http.post(PATH + '/next', json={
        'turn_id': state['turns'][0]['id'],
    })).status_code == 404
    evaluator.assert_not_awaited()


@pytest.mark.asyncio
async def test_filters_and_empty_bank(client, database):
    http, _, _ = client
    assert (await http.post(PATH, json={'difficulty': 'hard'})).status_code == 400
    async with database() as session:
        assert await session.scalar(select(func.count()).select_from(InterviewSession)) == 0
    state = await start(http, question_count=20, category='Python', difficulty='easy')
    assert len(state['turns']) == 1
    assert state['turns'][0]['question'] == 'Python 是什么？'


@pytest.mark.asyncio
async def test_legacy_chat_mode_cannot_bypass_interview_records(client):
    http, _, evaluator = client
    response = await http.post('/chat', json={
        'conversation_id': 'conv', 'question': '开始面试', 'mode': 'interview',
    })
    assert response.status_code == 409
    evaluator.assert_not_awaited()
