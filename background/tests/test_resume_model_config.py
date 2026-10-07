"""Reparse must resolve the same personal provider as the initial upload."""

import json

import httpx
import pytest
from openai import AsyncOpenAI

from app.infrastructure.database.models import Resume, UserLLMConfig
from app.infrastructure.llm import resume_structure
from app.services import resume_service


@pytest.mark.asyncio
async def test_reparse_uses_saved_personal_provider(backend_database, monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv('MIMO_API_KEY', raising=False)
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    async with backend_database() as session:
        session.add(Resume(id='resume', user_id='owner', filename='cv.txt',
                           content='张三\n专业技能\nReact', analysis=''))
        session.add(UserLLMConfig(user_id='owner', base_url='https://personal.invalid/v1',
                                 api_key='personal-test-key', model='personal-model'))
        await session.commit()
    calls = []

    def handle(request):
        body = json.loads(request.content)
        calls.append(body)
        assert request.headers['authorization'] == 'Bearer personal-test-key'
        assert body['model'] == 'personal-model'
        return httpx.Response(200, json={
            'id': 'test', 'object': 'chat.completion', 'created': 0, 'model': 'personal-model',
            'choices': [{'index': 0, 'finish_reason': 'stop', 'message': {
                'role': 'assistant', 'content': json.dumps({'basics': {'name': '张三'}}),
            }}],
        })

    def build_client(config, timeout=None):
        assert config.source == 'user'
        return AsyncOpenAI(api_key=config.api_key, base_url=config.base_url,
                           http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)))

    monkeypatch.setattr(resume_structure, 'build_async_client', build_client)
    assert await resume_service.reparse_resume_structure('resume', 'other') is None
    result = await resume_service.reparse_resume_structure('resume', 'owner')
    assert len(calls) == 1
    assert result.structured['basics']['name'] == '张三'
    async with backend_database() as session:
        stored = await session.get(Resume, 'resume')
        assert stored.structured == result.structured
